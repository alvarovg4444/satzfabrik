/*
 * The neural voice on the main thread: loads a Piper voice into the worker (from the
 * cache, or downloading it once), plays what the worker synthesizes sentence by
 * sentence, and remembers recent sentences so a second tap plays at once.
 */
import type { FromWorker, ToWorker } from "./neural.worker";
import NeuralWorker from "./neural.worker?worker&inline";
import { ENGINE, ENGINE_SIZES, encodeWav, NEURAL_VOICES, speakable, VOICE_CACHE, voiceById, voiceUrls, type NeuralVoice } from "./piper";

export interface NeuralState {
  /** Voice in the engine, or being loaded into it. */
  voice: string | null;
  status: "off" | "loading" | "ready" | "missing" | "error";
  /** Bytes downloaded so far and in total, while a voice downloads. */
  loaded: number;
  total: number;
  error: string;
  /** Voices whose files are all on this device. */
  installed: string[];
}

let state: NeuralState = { voice: null, status: "off", loaded: 0, total: 0, error: "", installed: [] };
const listeners = new Set<() => void>();
function set(p: Partial<NeuralState>) {
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}
export const neuralState = () => state;
export function subscribeNeural(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function simd(): boolean {
  try {
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  } catch {
    return false;
  }
}

/**
 * Can this page run a neural voice? Not on claude.ai, which only lets a page load code
 * from a few approved sources, and not without WebAssembly SIMD, workers and Cache Storage
 * (a page opened from disk has no Cache Storage).
 */
export function neuralSupported(): boolean {
  if (typeof window === "undefined" || typeof window.claude?.use === "function") return false;
  return typeof Worker !== "undefined" && typeof WebAssembly === "object" && "caches" in window && window.isSecureContext && simd();
}

async function inCache(url: string): Promise<boolean> {
  try {
    return !!(await (await caches.open(VOICE_CACHE)).match(url));
  } catch {
    return false;
  }
}

/** Bytes still to download before this voice can speak. */
async function missingBytes(v: NeuralVoice): Promise<number> {
  const u = voiceUrls(v);
  const files: [string, number][] = [...Object.values(ENGINE).map((url): [string, number] => [url, ENGINE_SIZES[url] ?? 0]), [u.model, v.bytes], [u.config, 5_000]];
  const have = await Promise.all(files.map(([url]) => inCache(url)));
  return files.reduce((n, [, bytes], i) => n + (have[i] ? 0 : bytes), 0);
}

export async function refreshInstalled(): Promise<string[]> {
  if (!neuralSupported()) return [];
  const engine = (await Promise.all(Object.values(ENGINE).map(inCache))).every(Boolean);
  const installed: string[] = [];
  if (engine) {
    for (const v of NEURAL_VOICES) {
      const u = voiceUrls(v);
      if ((await inCache(u.model)) && (await inCache(u.config))) installed.push(v.id);
    }
  }
  set({ installed });
  return installed;
}

/** Deletes a voice's model (the shared engine stays). */
export async function removeVoice(id: string): Promise<void> {
  const v = voiceById(id);
  if (!v) return;
  const cache = await caches.open(VOICE_CACHE);
  const u = voiceUrls(v);
  await Promise.all([cache.delete(u.model), cache.delete(u.config)]);
  if (state.voice === id) {
    worker?.terminate();
    worker = null;
    set({ voice: null, status: "off" });
  }
  await refreshInstalled();
}

// --- the worker --------------------------------------------------------------

let worker: Worker | null = null;
let loading: Promise<boolean> | null = null;
let settle: ((ok: boolean) => void) | null = null;
let generation = 0;
let lastPaint = 0;

function onMessage(m: FromWorker) {
  switch (m.type) {
    case "progress": {
      const loaded = state.loaded + m.bytes;
      const now = performance.now();
      if (now - lastPaint > 200 || loaded >= state.total) {
        lastPaint = now;
        set({ loaded });
      } else state = { ...state, loaded };
      break;
    }
    case "ready":
      set({ status: "ready", loaded: state.total });
      settle?.(true);
      break;
    case "missing":
      set({ status: "missing" });
      settle?.(false);
      break;
    case "error":
      if (m.id !== undefined) failed(m.id);
      else {
        set({ status: "error", error: m.message });
        settle?.(false);
      }
      break;
    case "chunk":
      gotChunk(m);
      break;
  }
}

/**
 * Loads a voice into the engine and resolves to true once it can speak. Without
 * `download` it only uses files already on the device (never starts a 60 MB download
 * on its own).
 */
export function loadVoice(id: string, download = false): Promise<boolean> {
  const v = voiceById(id);
  if (!v || !neuralSupported()) return Promise.resolve(false);
  if (state.voice === id && state.status === "ready" && worker) return Promise.resolve(true);
  if (state.voice === id && state.status === "loading" && loading) return loading;
  // a newer load replaces this one; only the newest may touch the shared state
  const gen = ++generation;
  worker?.terminate();
  worker = null;
  settle?.(false);
  settle = null;
  set({ voice: id, status: "loading", loaded: 0, total: 0, error: "" });
  const run = (async () => {
    if (download) {
      const total = await missingBytes(v);
      if (gen !== generation) return false;
      set({ total });
    }
    const w = new NeuralWorker();
    worker = w;
    w.onmessage = (e: MessageEvent<FromWorker>) => {
      if (worker === w) onMessage(e.data);
    };
    w.onerror = () => {
      if (worker !== w) return;
      set({ status: "error", error: "Die Stimme konnte nicht starten." });
      settle?.(false);
    };
    const u = voiceUrls(v);
    const ok = await new Promise<boolean>((resolve) => {
      settle = resolve;
      w.postMessage({ type: "init", engine: ENGINE, model: u.model, config: u.config, download } satisfies ToWorker);
    });
    if (gen === generation) {
      settle = null;
      loading = null;
    }
    if (ok && download) {
      void navigator.storage?.persist?.();
      void refreshInstalled();
    }
    return ok;
  })();
  loading = run;
  return run;
}

// --- playback ----------------------------------------------------------------

/** Recent sentences as WAV blob URLs, so a repeated tap plays without waiting. */
const memo = new Map<string, string[]>();
const MEMO_MAX = 40;
let player: HTMLAudioElement | null = null;
let queue: string[] = [];
let playing = false;
let seq = 0;
let current: { id: number; key: string; urls: string[]; fallback: () => void; started: () => void } | null = null;

function ensurePlayer(): HTMLAudioElement {
  if (!player) {
    player = new Audio();
    player.preload = "auto";
    player.addEventListener("ended", next);
    player.addEventListener("error", next);
  }
  return player;
}

function next() {
  const url = queue.shift();
  if (!url) {
    playing = false;
    return;
  }
  playing = true;
  const p = ensurePlayer();
  p.src = url;
  p.play().catch(() => {
    playing = false;
    queue = [];
  });
}

function enqueue(url: string) {
  queue.push(url);
  if (!playing) next();
}

function remember(key: string, urls: string[]) {
  memo.set(key, urls);
  while (memo.size > MEMO_MAX) {
    const [oldKey, old] = memo.entries().next().value as [string, string[]];
    memo.delete(oldKey);
    old.forEach((u) => URL.revokeObjectURL(u));
  }
}

function gotChunk(m: Extract<FromWorker, { type: "chunk" }>) {
  if (!current || m.id !== current.id) return;
  if (m.pcm.length) {
    const url = URL.createObjectURL(new Blob([encodeWav(m.pcm, m.sampleRate)], { type: "audio/wav" }));
    current.urls.push(url);
    if (current.urls.length === 1) current.started();
    enqueue(url);
  }
  if (m.last) {
    if (current.urls.length) remember(current.key, current.urls);
    else current.started();
    current = null;
  }
}

function failed(id: number) {
  if (!current || current.id !== id) return;
  const c = current;
  current = null;
  c.urls.forEach((u) => URL.revokeObjectURL(u));
  c.started();
  c.fallback();
}

/** Stops speaking, including sentences still being synthesized. */
export function stopNeural() {
  queue = [];
  playing = false;
  player?.pause();
  if (current) {
    current.urls.forEach((u) => URL.revokeObjectURL(u));
    current.started();
    current = null;
    worker?.postMessage({ type: "cancel" } satisfies ToWorker);
  }
}

let unlocked = false;

/**
 * iPhones only play sound that a tap starts, and the voice answers a moment after the tap.
 * Playing a moment of silence during the tap unlocks the player for what comes later.
 * Call it from inside a tap handler.
 */
export function primeAudio() {
  if (unlocked || typeof window === "undefined") return;
  unlocked = true;
  const p = ensurePlayer();
  if (playing) return;
  p.src = URL.createObjectURL(new Blob([encodeWav(new Float32Array(400), 8000)], { type: "audio/wav" }));
  p.play().catch(() => undefined);
}

/**
 * Speaks with a neural voice. Resolves once the audio starts (or the fallback ran); calls
 * `fallback` when the voice is not on this device or synthesis fails. Call it from a tap
 * handler when there is one (it unlocks the player on iPhones).
 */
export async function speakNeural(text: string, rate: number, id: string, fallback: () => void): Promise<void> {
  const clean = speakable(text);
  if (!clean) return;
  primeAudio();
  stopNeural();
  if (!(await loadVoice(id))) {
    fallback();
    return;
  }
  const length = 1 / Math.min(1.5, Math.max(0.5, rate));
  const key = `${id}|${length.toFixed(2)}|${clean}`;
  const hit = memo.get(key);
  if (hit) {
    memo.delete(key);
    memo.set(key, hit);
    hit.forEach(enqueue);
    return;
  }
  // another tap may have come in while the voice was loading
  stopNeural();
  await new Promise<void>((started) => {
    current = { id: ++seq, key, urls: [], fallback, started };
    worker!.postMessage({ type: "speak", id: current.id, text: clean, length } satisfies ToWorker);
  });
}

/** Unlocks the player on the first tap anywhere, so corrections can be read out when they arrive. */
export function unlockOnFirstTap() {
  if (typeof window === "undefined") return;
  window.addEventListener("pointerdown", primeAudio, { once: true, capture: true });
}
