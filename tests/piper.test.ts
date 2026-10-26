import { describe, expect, it } from "vitest";
import { encodeWav, neuralId, sentenceIds, speakable, toIds, type IdMap } from "../src/ui/piper";

// A slice of Piper's phoneme table: newer voices have the combining cedilla, older ones do not.
const NEW: IdMap = { _: [0], "^": [1], $: [2], " ": [3], ",": [8], ".": [10], "?": [13], a: [14], b: [15], c: [16], "̧": [140], ɪ: [74], n: [26], t: [32], s: [31] };
const OLD: IdMap = Object.fromEntries(Object.entries(NEW).filter(([k]) => k !== "̧")) as IdMap;

describe("phoneme ids", () => {
  it("wraps a sentence in start and end with a pad after every phoneme", () => {
    expect(toIds(["b", "ɪ", "n"], NEW)).toEqual([1, 0, 15, 0, 74, 0, 26, 0, 2]);
  });

  it("keeps the cedilla of 'ich' for newer voices and leaves it out for older ones, as Piper does", () => {
    // "ich": ɪ c + combining cedilla
    expect(toIds(["ɪ", "c", "̧"], NEW)).toEqual([1, 0, 74, 0, 16, 0, 140, 0, 2]);
    expect(toIds(["ɪ", "c", "̧"], OLD)).toEqual([1, 0, 74, 0, 16, 0, 2]);
  });

  it("drops sounds the voice does not know", () => {
    expect(toIds(["b", "ʘ", "n"], NEW)).toEqual([1, 0, 15, 0, 26, 0, 2]);
  });

  it("splits the phonemizer's output into the sentences it marked", () => {
    const out = {
      // "Bin. Ist?" as piper_phonemize prints it: one id per phoneme, sentences start with 1 and end with 2
      phoneme_ids: [1, 0, 15, 0, 74, 0, 26, 0, 10, 0, 2, 1, 0, 74, 0, 31, 0, 32, 0, 13, 0, 2],
      phonemes: ["b", "ɪ", "n", ".", "ɪ", "s", "t", "?"],
    };
    expect(sentenceIds(out, NEW)).toEqual([
      [1, 0, 15, 0, 74, 0, 26, 0, 10, 0, 2],
      [1, 0, 74, 0, 31, 0, 32, 0, 13, 0, 2],
    ]);
  });

  it("speaks everything as one piece when ids and phonemes do not line up", () => {
    const out = { phoneme_ids: [1, 0, 15, 0, 2], phonemes: ["b", "ɪ", "n"] };
    expect(sentenceIds(out, NEW)).toEqual([[1, 0, 15, 0, 74, 0, 26, 0, 2]]);
  });
});

describe("speech helpers", () => {
  it("reads the neural voice from the setting", () => {
    expect(neuralId("piper:thorsten")).toBe("thorsten");
    expect(neuralId("com.apple.voice.compact.de-DE.Anna")).toBeNull();
    expect(neuralId("")).toBeNull();
  });

  it("leaves out quotes and markup", () => {
    expect(speakable("Er sagt: „Ich *komme* morgen.“  ")).toBe("Er sagt: Ich komme morgen.");
  });

  it("writes a playable 16-bit WAV", () => {
    const wav = new DataView(encodeWav(Float32Array.from([0, 1, -1, 0.5]), 22050));
    expect(String.fromCharCode(...new Uint8Array(wav.buffer, 0, 4))).toBe("RIFF");
    expect(wav.getUint32(24, true)).toBe(22050);
    expect(wav.getUint32(40, true)).toBe(8);
    expect([wav.getInt16(44, true), wav.getInt16(46, true), wav.getInt16(48, true)]).toEqual([0, 32767, -32768]);
  });
});
