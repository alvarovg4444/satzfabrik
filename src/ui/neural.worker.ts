/// <reference lib="webworker" />
/*
 * Piper text-to-speech, off the main thread: espeak-ng turns German text into phonemes
 * (piper_phonemize, WebAssembly) and the voice's neural network turns them into audio
 * (onnxruntime-web). Every file is kept in Cache Storage after the first download, so
 * speaking works offline.
 */
import { sentenceIds, VOICE_CACHE, type EngineFiles, type PhonemizeOutput, type PiperConfig } from "./piper";

declare const self: DedicatedWorkerGlobalScope;

interface OrtTensor {
  data: Float32Array;
}
interface OrtSession {
  run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensor>>;
}
interface Ort {
  env: { wasm: { numThreads: number; wasmPaths: Record<string, string> | string } };
  Tensor: new (type: string, data: BigInt64Array | Float32Array, dims: number[]) => unknown;
  InferenceSession: { create(model: ArrayBuffer, opts: object): Promise<OrtSession> };
}
interface PhonemizeModule {
  callMain(args: string[]): void;
}
declare const ort: Ort;
declare const createPiperPhonemize: (m: object) => Promise<PhonemizeModule>;

export type ToWorker =
  | { type: "init"; engine: EngineFiles; model: string; config: string; download: boolean }
  | { type: "speak"; id: number; text: string; length: number }
  | { type: "cancel" };

export type FromWorker =
  | { type: "progress"; bytes: number }
  | { type: "ready"; sampleRate: number }
  | { type: "missing" }
  | { type: "error"; message: string; id?: number }
  | { type: "chunk"; id: number; pcm: Float32Array; sampleRate: number; last: boolean };

const post = (m: FromWorker, transfer: Transferable[] = []) => self.postMessage(m, transfer);

class Missing extends Error {}

const STALL_MS = 30_000;

/** A file from the cache, or (when allowed) from the network into the cache. */
async function file(url: string, download: boolean): Promise<Blob> {
  const cache = await caches.open(VOICE_CACHE);
  const hit = await cache.match(url);
  if (hit) return hit.blob();
  if (!download) throw new Missing(url);
  // A download that stops sending data for half a minute is given up, not waited on forever.
  const abort = new AbortController();
  let watchdog = setTimeout(() => abort.abort(), STALL_MS);
  const parts: Uint8Array[] = [];
  let res: Response;
  try {
    res = await fetch(url, { signal: abort.signal });
    if (!res.ok || !res.body) throw new Error(`Download fehlgeschlagen (${res.status}): ${url.split("/").pop()}`);
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      clearTimeout(watchdog);
      watchdog = setTimeout(() => abort.abort(), STALL_MS);
      parts.push(value);
      post({ type: "progress", bytes: value.byteLength });
    }
  } catch (err) {
    if (abort.signal.aborted) throw new Error("Der Download ist hängen geblieben. Versuch es noch einmal, am besten im WLAN.");
    throw err;
  } finally {
    clearTimeout(watchdog);
  }
  const blob = new Blob(parts as BlobPart[], { type: res.headers.get("content-type") ?? "application/octet-stream" });
  await cache.put(url, new Response(blob, { headers: { "content-type": blob.type } }));
  return blob;
}

const script = async (blob: Blob) => {
  const url = URL.createObjectURL(new Blob([blob], { type: "text/javascript" }));
  try {
    self.importScripts(url);
  } finally {
    URL.revokeObjectURL(url);
  }
};

let session: OrtSession | null = null;
let config: PiperConfig | null = null;
let phonemizer: PhonemizeModule | null = null;
const lines: string[] = [];
/** The utterance being spoken; a newer one cancels it. */
let current = 0;

async function init(m: Extract<ToWorker, { type: "init" }>) {
  const e = m.engine;
  const [ortJs, ortWasm, phJs, phWasm, phData, cfg, model] = await Promise.all([
    file(e.ortJs, m.download),
    file(e.ortWasm, m.download),
    file(e.phonemizeJs, m.download),
    file(e.phonemizeWasm, m.download),
    file(e.phonemizeData, m.download),
    file(m.config, m.download),
    file(m.model, m.download),
  ]);
  await script(ortJs);
  await script(phJs);
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = { "ort-wasm-simd.wasm": URL.createObjectURL(new Blob([ortWasm], { type: "application/wasm" })) };
  config = JSON.parse(await cfg.text()) as PiperConfig;
  const compiled = await WebAssembly.compile(await phWasm.arrayBuffer());
  const data = await phData.arrayBuffer();
  phonemizer = await createPiperPhonemize({
    print: (line: string) => lines.push(line),
    printErr: () => undefined,
    getPreloadedPackage: () => data,
    instantiateWasm: (imports: WebAssembly.Imports, done: (i: WebAssembly.Instance) => void) => {
      void WebAssembly.instantiate(compiled, imports).then(done);
      return {};
    },
    locateFile: (name: string) => name,
  });
  session = await ort.InferenceSession.create(await model.arrayBuffer(), { executionProviders: ["wasm"] });
  // The first run is slow while the runtime warms up; do it now, not when the learner taps.
  await synth(ids("Hallo.")[0] ?? [], 1);
  post({ type: "ready", sampleRate: config.audio.sample_rate });
}

function ids(text: string): number[][] {
  if (!phonemizer || !config) return [];
  lines.length = 0;
  phonemizer.callMain(["-l", config.espeak.voice, "--input", JSON.stringify([{ text }]), "--espeak_data", "/espeak-ng-data"]);
  const map = config.phoneme_id_map;
  return lines.flatMap((l) => {
    try {
      return sentenceIds(JSON.parse(l) as PhonemizeOutput, map);
    } catch {
      return [];
    }
  });
}

async function synth(list: number[], length: number): Promise<Float32Array> {
  if (!session || !config || list.length < 3) return new Float32Array(0);
  const inf = config.inference;
  const feeds: Record<string, unknown> = {
    input: new ort.Tensor("int64", BigInt64Array.from(list, (n) => BigInt(n)), [1, list.length]),
    input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(list.length)]), [1]),
    scales: new ort.Tensor("float32", Float32Array.from([inf.noise_scale, inf.length_scale * length, inf.noise_w]), [3]),
  };
  if ((config.num_speakers ?? 1) > 1) feeds.sid = new ort.Tensor("int64", BigInt64Array.from([0n]), [1]);
  const out = await session.run(feeds);
  return out.output.data;
}

self.onmessage = async (ev: MessageEvent<ToWorker>) => {
  const m = ev.data;
  if (m.type === "cancel") {
    current = -1;
    return;
  }
  if (m.type === "init") {
    try {
      await init(m);
    } catch (err) {
      if (err instanceof Missing) post({ type: "missing" });
      else post({ type: "error", message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }
  if (m.type === "speak") {
    current = m.id;
    try {
      const sentences = ids(m.text);
      if (!sentences.length) post({ type: "chunk", id: m.id, pcm: new Float32Array(0), sampleRate: config?.audio.sample_rate ?? 22050, last: true });
      for (let i = 0; i < sentences.length; i++) {
        if (current !== m.id) return;
        const pcm = await synth(sentences[i], m.length);
        post({ type: "chunk", id: m.id, pcm, sampleRate: config!.audio.sample_rate, last: i === sentences.length - 1 }, [pcm.buffer]);
      }
    } catch (err) {
      post({ type: "error", id: m.id, message: err instanceof Error ? err.message : String(err) });
    }
  }
};
