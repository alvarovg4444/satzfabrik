import { text, textWidth } from "./font";
import { noise, px, rect, type Ctx, type Shade } from "./paint";
import { C } from "./sprites";

/** Colours, materials and small drawing helpers shared by the buildings. */

export const SHADOW = "rgba(40,48,64,0.25)";
export const DIRT = "#c8a070";
export const DIRT_LO = "#a87c50";
export const PAVE = "#d8d8d0";
export const PAVE_LO = "#c0c0b6";
export const GLASS = "#7cc4f0";
export const GLASS_HI = "#c8ecff";
export const LIT = "#ffe9a0";
export const LIT_LO = "#c8a860";

export const CONCRETE: Shade = { o: C.ink, l: "#e4e6ea", m: "#c8ccd2", d: "#a4aab4" };
export const FLAT_ROOF: Shade = { o: C.ink, l: "#b8c0cc", m: "#9aa4b2", d: "#7a8494" };
export const CREAM: Shade = { o: C.ink, l: "#fff4c8", m: "#f2dc96", d: "#d0b468" };
export const BRICK: Shade = { o: C.ink, l: "#e88a70", m: "#c8604a", d: "#9a4434" };
export const WOOD: Shade = { o: C.ink, l: "#e0a868", m: "#c08048", d: "#8e5a30" };
export const TAR: Shade = { o: C.ink, l: "#7a6a5a", m: "#5e5046", d: "#463a32" };

export function plate(c: Ctx, label: string, cx: number, y: number, bg = "#fbfbf4", fg: string = C.ink): void {
  const tw = textWidth(label);
  const x = Math.round(cx - (tw + 6) / 2);
  rect(c, x, y, tw + 6, 9, C.ink);
  rect(c, x + 1, y + 1, tw + 4, 7, bg);
  text(c, label, x + 3, y + 2, fg);
}

export function window(c: Ctx, x: number, y: number, w: number, h: number): void {
  rect(c, x, y, w, h, C.ink);
  rect(c, x + 1, y + 1, w - 2, h - 2, GLASS);
  rect(c, x + 1, y + 1, Math.max(1, Math.floor((w - 2) / 3)), 1, GLASS_HI);
}

export function speckle(c: Ctx, x: number, y: number, w: number, h: number, seed: number, a: string, b: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const nx = x + Math.floor(noise(i, seed, 41) * w);
    const ny = y + Math.floor(noise(i, seed, 42) * h);
    px(c, nx, ny, noise(i, seed, 43) < 0.5 ? a : b);
  }
}

/** A child, 5×7, for the daycare. frame 0/1 moves the legs. */
export function kid(c: Ctx, x: number, y: number, shirt: string, hair: string, frame = 0): void {
  rect(c, x + 1, y, 3, 2, hair);
  rect(c, x + 1, y + 2, 3, 1, C.skin);
  rect(c, x, y + 3, 5, 1, shirt);
  rect(c, x + 1, y + 4, 3, 1, shirt);
  px(c, x + 1 + frame, y + 5, C.boot);
  px(c, x + 3 - frame, y + 5, C.boot);
  px(c, x + 1 + frame, y + 6, C.boot);
  px(c, x + 3 - frame, y + 6, C.boot);
}

/** A footballer seen from above, 3×5. */
export function player(c: Ctx, x: number, y: number, shirt: string, frame = 0): void {
  px(c, x + 1, y, C.hair);
  rect(c, x, y + 1, 3, 2, shirt);
  px(c, x + (frame ? 0 : 2), y + 3, C.skin);
  px(c, x + 1, y + 3, C.white);
  px(c, x + (frame ? 2 : 0), y + 4, C.boot);
}

/** Gold pennant for a building at its top level. */
export function goldFlag(c: Ctx, x: number, y: number, t = 0): void {
  rect(c, x, y, 1, 10, C.ink);
  const wave = Math.floor(t * 3) % 2;
  rect(c, x + 1, y, 5, 3, C.goldLo);
  rect(c, x + 1, y, 5 - wave, 2, C.gold);
  px(c, x + 2, y, C.goldHi);
  px(c, x, y - 1, C.goldHi);
}

type FlagSpec = { h?: string[]; v?: string[]; bg?: string; cross?: string; dot?: string };

const R = "#e84038";
const W_ = "#f8f8f8";
const B = "#2448a0";
const L = "#3a72e0";
const G = "#3cae5a";
const Y = "#f4c430";
const K = "#283040";

/** Flags as 6×4 pixel art: horizontal or vertical stripes, a Nordic cross or a dot. */
const FLAGS: Record<string, FlagSpec> = {
  de: { h: [K, R, Y] },
  at: { h: [R, W_, R] },
  ch: { bg: R, dot: W_ },
  fr: { v: [B, W_, R] },
  it: { v: [G, W_, R] },
  nl: { h: [R, W_, B] },
  be: { v: [K, Y, R] },
  pl: { h: [W_, R] },
  cz: { h: [W_, R], dot: B },
  dk: { bg: R, cross: W_ },
  es: { h: [R, Y, Y, R] },
  se: { bg: L, cross: Y },
  no: { bg: R, cross: B },
  fi: { bg: W_, cross: B },
  ie: { v: [G, W_, "#f07a1c"] },
  pt: { v: [G, R, R] },
  gr: { h: [L, W_, L, W_] },
  hu: { h: [R, W_, G] },
  ro: { v: [B, Y, R] },
  bg: { h: [W_, G, R] },
  hr: { h: [R, W_, B] },
  si: { h: [W_, B, R] },
  sk: { h: [W_, B, R] },
  lt: { h: [Y, G, R] },
  lv: { h: ["#a82820", W_, "#a82820"] },
  ee: { h: [L, K, W_] },
  lu: { h: [R, W_, "#86b4ff"] },
  is: { bg: B, cross: R },
  ua: { h: [L, Y] },
  jp: { bg: W_, dot: R },
  ca: { v: [R, W_, R], dot: R },
};

/** A flag on a pole; the pole stands at (x, y + 10). frame 0/1 makes it flutter. */
export function flag(c: Ctx, x: number, y: number, code: string, frame = 0): void {
  rect(c, x, y, 1, 10, C.ink);
  const f = FLAGS[code] ?? FLAGS.de;
  const fx = x + 1;
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 6; i++) {
      let col = f.bg ?? W_;
      if (f.h) col = f.h[Math.min(f.h.length - 1, Math.floor((j * f.h.length) / 4))];
      if (f.v) col = f.v[Math.min(f.v.length - 1, Math.floor((i * f.v.length) / 6))];
      if (f.cross && (i === 2 || j === 2)) col = f.cross;
      if (f.dot && i >= 2 && i <= 3 && j >= 1 && j <= 2) col = f.dot;
      // the free end flutters
      const dy = frame && i >= 4 ? 1 : 0;
      px(c, fx + i, y + j + dy, col);
    }
  }
}
