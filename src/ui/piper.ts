/*
 * Piper voices: open-source neural text-to-speech that runs on the device. These are the
 * pure parts (voice list, files, phoneme ids, WAV encoding), shared by the worker, the
 * player and the tests.
 */

export interface NeuralVoice {
  /** Short id, stored in settings as "piper:<id>". */
  id: string;
  name: string;
  note: string;
  /** Path below the voices repository, without ".onnx". */
  path: string;
  /** Size of the voice model in bytes. */
  bytes: number;
  license: string;
}

/** The voices repository at a fixed revision, so a voice never changes under the learner. */
export const VOICE_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/5041a7a49ae5b3a0f30e6837769eb03fdbb231bd/de/de_DE/";

export const NEURAL_VOICES: NeuralVoice[] = [
  {
    id: "thorsten",
    name: "Thorsten",
    note: "Männerstimme, die deutlichste (empfohlen)",
    path: "thorsten/medium/de_DE-thorsten-medium",
    bytes: 63_201_294,
    license: "Thorsten Müller, CC0",
  },
  {
    id: "kerstin",
    name: "Kerstin",
    note: "Frauenstimme",
    path: "kerstin/low/de_DE-kerstin-low",
    bytes: 63_104_526,
    license: "Kerstin, CC0",
  },
];

export const voiceById = (id: string) => NEURAL_VOICES.find((v) => v.id === id);

/** The setting value for a neural voice. */
export const PIPER_PREFIX = "piper:";
export const neuralId = (setting: string) => (setting.startsWith(PIPER_PREFIX) ? setting.slice(PIPER_PREFIX.length) : null);

export const voiceUrls = (v: NeuralVoice) => ({ model: `${VOICE_BASE}${v.path}.onnx`, config: `${VOICE_BASE}${v.path}.onnx.json` });
export const sampleUrl = (v: NeuralVoice) => `${VOICE_BASE}${v.path.slice(0, v.path.lastIndexOf("/"))}/samples/speaker_0.mp3`;

/** The engine every voice shares: the ONNX runtime and espeak-ng's phonemizer, both as WebAssembly. */
const ORT = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/";
const PHONEMIZE = "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize";
export const ENGINE = {
  ortJs: `${ORT}ort.wasm.min.js`,
  ortWasm: `${ORT}ort-wasm-simd.wasm`,
  phonemizeJs: `${PHONEMIZE}.js`,
  phonemizeWasm: `${PHONEMIZE}.wasm`,
  phonemizeData: `${PHONEMIZE}.data`,
};
export type EngineFiles = typeof ENGINE;
/** Download sizes, for the progress bar. */
export const ENGINE_SIZES: Record<string, number> = {
  [ENGINE.ortJs]: 142_930,
  [ENGINE.ortWasm]: 10_595_041,
  [ENGINE.phonemizeJs]: 120_714,
  [ENGINE.phonemizeWasm]: 635_212,
  [ENGINE.phonemizeData]: 18_077_249,
};

/** Name of the Cache Storage bucket that keeps the engine and the voices for offline use. */
export const VOICE_CACHE = "satzfabrik-voices-v1";

export type IdMap = Record<string, number[]>;

export interface PiperConfig {
  audio: { sample_rate: number };
  espeak: { voice: string };
  inference: { noise_scale: number; length_scale: number; noise_w: number };
  phoneme_id_map: IdMap;
  num_speakers?: number;
}

/** What piper_phonemize prints for one line of text. */
export interface PhonemizeOutput {
  phoneme_ids: number[];
  phonemes: string[];
}

const BOS = 1;
const EOS = 2;
const PAD = 0;

/**
 * Phoneme ids for one sentence, in this voice's own table: start, pad, then each
 * phoneme followed by a pad, then end. Sounds the voice does not know are left out, as
 * Piper does: older voices have no combining marks (the cedilla of "ich"), and they were
 * trained without them (joining "c" and the cedilla into "ç" made "ich" sound like "ihr").
 */
export function toIds(phonemes: string[], map: IdMap): number[] {
  const pad = map["_"] ?? [PAD];
  const ids = [...(map["^"] ?? [BOS]), ...pad];
  for (const ph of phonemes) {
    const got = map[ph];
    if (!got) continue;
    ids.push(...got, ...pad);
  }
  ids.push(...(map["$"] ?? [EOS]));
  return ids;
}

/**
 * Splits the phonemizer's output into sentences, the way Piper speaks them, and maps
 * each to this voice's ids. The phonemizer's own ids mark the sentences (start … end)
 * with one id per phoneme in between.
 */
export function sentenceIds(out: PhonemizeOutput, map: IdMap): number[][] {
  const sentences: string[][] = [];
  let current: string[] = [];
  let p = 0;
  for (const id of out.phoneme_ids) {
    if (id === PAD) continue;
    if (id === BOS) {
      current = [];
      continue;
    }
    if (id === EOS) {
      if (current.length) sentences.push(current);
      current = [];
      continue;
    }
    if (p < out.phonemes.length) current.push(out.phonemes[p]);
    p++;
  }
  if (current.length) sentences.push(current);
  // Not one id per phoneme after all: speak it as one piece rather than misalign it.
  if (p !== out.phonemes.length) return out.phonemes.length ? [toIds(out.phonemes, map)] : [];
  return sentences.map((s) => toIds(s, map));
}

/** Text to speak, without what would be read out as symbols. */
export function speakable(text: string): string {
  return text
    .replace(/[„“”"»«]/g, "")
    .replace(/[_*#~^`|<>[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 16-bit mono WAV, which every browser plays. */
export function encodeWav(pcm: Float32Array, sampleRate: number): ArrayBuffer {
  const view = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(44 + i * 2, v < 0 ? v * 32768 : v * 32767, true);
  }
  return view.buffer;
}
