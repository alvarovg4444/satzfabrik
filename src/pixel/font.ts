import type { Ctx } from "./paint";

/**
 * 5 px tall pixel font for signs, uppercase only (lowercase is drawn as uppercase).
 * Most glyphs are 3 px wide; M, N and W are wider so they stay readable.
 */
const GLYPHS: Record<string, string> = {
  A: ".#./#.#/###/#.#/#.#",
  B: "##./#.#/##./#.#/##.",
  C: ".##/#../#../#../.##",
  D: "##./#.#/#.#/#.#/##.",
  E: "###/#../##./#../###",
  F: "###/#../##./#../#..",
  G: ".##/#../#.#/#.#/.##",
  H: "#.#/#.#/###/#.#/#.#",
  I: "###/.#./.#./.#./###",
  J: "..#/..#/..#/#.#/.#.",
  K: "#.#/#.#/##./#.#/#.#",
  L: "#../#../#../#../###",
  M: "#...#/##.##/#.#.#/#...#/#...#",
  N: "#..#/##.#/#.##/#..#/#..#",
  O: "###/#.#/#.#/#.#/###",
  P: "##./#.#/##./#../#..",
  Q: ".#./#.#/#.#/##./.##",
  R: "##./#.#/##./#.#/#.#",
  S: ".##/#../.#./..#/##.",
  T: "###/.#./.#./.#./.#.",
  U: "#.#/#.#/#.#/#.#/###",
  V: "#.#/#.#/#.#/#.#/.#.",
  W: "#...#/#...#/#.#.#/##.##/#...#",
  X: "#.#/#.#/.#./#.#/#.#",
  Y: "#.#/#.#/.#./.#./.#.",
  Z: "###/..#/.#./#../###",
  Ä: "#.#/.#./#.#/###/#.#",
  Ö: "#.#/.#./#.#/#.#/.#.",
  Ü: "#.#/.../#.#/#.#/###",
  ß: ".#./#.#/##./#.#/##.",
  0: "###/#.#/#.#/#.#/###",
  1: ".#./##./.#./.#./###",
  2: "##./..#/.#./#../###",
  3: "##./..#/.#./..#/##.",
  4: "#.#/#.#/###/..#/..#",
  5: "###/#../##./..#/##.",
  6: ".##/#../###/#.#/###",
  7: "###/..#/.#./.#./.#.",
  8: "###/#.#/###/#.#/###",
  9: "###/#.#/###/..#/##.",
  " ": "../../../../..",
  ".": "././././#",
  ",": "./././#/#",
  ":": "./#/./#/.",
  "!": "#/#/#/./#",
  "?": "##./..#/.#./.../.#.",
  "-": ".../.../###/.../...",
  "+": ".../.#./###/.#./...",
  "/": "..#/..#/.#./#../#..",
  "%": "#.#/..#/.#./#../#.#",
  "·": "././#/./.",
  "×": ".../#.#/.#./#.#/...",
  "'": "#/#/././.",
};

interface Glyph {
  w: number;
  px: [number, number][];
}

const cache = new Map<string, Glyph>();

function glyph(ch: string): Glyph {
  const hit = cache.get(ch);
  if (hit) return hit;
  const src = GLYPHS[ch] ?? GLYPHS["?"];
  const rows = src.split("/").slice(0, 5);
  while (rows.length < 5) rows.push("");
  const w = Math.max(...rows.map((r) => r.length));
  const px: [number, number][] = [];
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if (r[x] === "#") px.push([x, y]);
  });
  const g = { w, px };
  cache.set(ch, g);
  return g;
}

export const FONT_H = 5;

export function textWidth(s: string, scale = 1): number {
  let w = 0;
  for (const ch of s.toUpperCase()) w += (glyph(ch).w + 1) * scale;
  return Math.max(0, w - scale);
}

/** Draws text with its top-left corner at (x, y). Returns the width drawn. */
export function text(c: Ctx, s: string, x: number, y: number, col: string, scale = 1): number {
  c.fillStyle = col;
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const ch of s.toUpperCase()) {
    const g = glyph(ch);
    for (const [gx, gy] of g.px) c.fillRect(cx + gx * scale, cy + gy * scale, scale, scale);
    cx += (g.w + 1) * scale;
  }
  return cx - Math.round(x) - scale;
}

/** Text with a 1 px drop shadow, for signs on busy backgrounds. */
export function textShadow(c: Ctx, s: string, x: number, y: number, col: string, shadow: string, scale = 1): number {
  text(c, s, x + scale, y + scale, shadow, scale);
  return text(c, s, x, y, col, scale);
}
