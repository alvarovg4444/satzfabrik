/** Tiny pixel-art toolkit: integer-coordinate drawing on canvases. */

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function ctx2d(c: HTMLCanvasElement): Ctx {
  const x = c.getContext("2d")!;
  x.imageSmoothingEnabled = false;
  return x;
}

export function rect(c: Ctx, x: number, y: number, w: number, h: number, col: string): void {
  if (w <= 0 || h <= 0) return;
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function px(c: Ctx, x: number, y: number, col: string): void {
  rect(c, x, y, 1, 1, col);
}

/** Three tones plus outline, light from the top left (GBA style). */
export interface Shade {
  o: string;
  l: string;
  m: string;
  d: string;
}

/** Outlined, shaded block. */
export function box(c: Ctx, x: number, y: number, w: number, h: number, s: Shade): void {
  rect(c, x, y, w, h, s.o);
  if (w <= 2 || h <= 2) return;
  rect(c, x + 1, y + 1, w - 2, h - 2, s.m);
  rect(c, x + 1, y + 1, w - 2, 1, s.l);
  rect(c, x + 1, y + 1, 1, h - 2, s.l);
  rect(c, x + 1, y + h - 2, w - 2, 1, s.d);
  rect(c, x + w - 2, y + 2, 1, h - 3, s.d);
}

/** Yellow and black warning stripes. */
export function hazard(c: Ctx, x: number, y: number, w: number, h: number, a = "#f8c820", b = "#2a2a30"): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      c.fillStyle = Math.floor((i + j) / 2) % 2 === 0 ? a : b;
      c.fillRect(x + i, y + j, 1, 1);
    }
  }
}

/**
 * Sprite from ASCII art: one character per pixel, "." transparent.
 * Rows may be shorter than the widest row; they are padded on the right.
 */
export function ascii(rows: readonly string[], pal: Readonly<Record<string, string>>): HTMLCanvasElement {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const c = makeCanvas(w, h);
  const x = ctx2d(c);
  const img = x.createImageData(w, h);
  for (let j = 0; j < h; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === "." || ch === " ") continue;
      const col = pal[ch];
      if (!col) continue;
      const [r, g, b, a] = parseColor(col);
      const k = (j * w + i) * 4;
      img.data[k] = r;
      img.data[k + 1] = g;
      img.data[k + 2] = b;
      img.data[k + 3] = a;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

const colorCache = new Map<string, [number, number, number, number]>();

/** "#rgb", "#rrggbb", "#rrggbbaa" or "rgba(r,g,b,a)" → bytes. */
export function parseColor(col: string): [number, number, number, number] {
  const hit = colorCache.get(col);
  if (hit) return hit;
  let out: [number, number, number, number] = [0, 0, 0, 255];
  if (col.startsWith("#")) {
    const h = col.slice(1);
    const full = h.length === 3 ? h.split("").map((ch) => ch + ch).join("") : h;
    out = [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
      full.length >= 8 ? parseInt(full.slice(6, 8), 16) : 255,
    ];
  } else {
    const m = col.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(",").map((v) => parseFloat(v));
      out = [p[0], p[1], p[2], Math.round((p[3] ?? 1) * 255)];
    }
  }
  colorCache.set(col, out);
  return out;
}

export function flipX(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height);
  const x = ctx2d(c);
  x.translate(src.width, 0);
  x.scale(-1, 1);
  x.drawImage(src, 0, 0);
  return c;
}

/** Draw into a fresh canvas and keep it. */
export function painted(w: number, h: number, draw: (c: Ctx) => void): HTMLCanvasElement {
  const cv = makeCanvas(w, h);
  draw(ctx2d(cv));
  return cv;
}

/** Rotates a sprite a quarter turn clockwise (lossless for pixel art). */
export function rotateCW(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = makeCanvas(src.height, src.width);
  const x = ctx2d(c);
  x.translate(src.height, 0);
  x.rotate(Math.PI / 2);
  x.drawImage(src, 0, 0);
  return c;
}

export function flipY(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height);
  const x = ctx2d(c);
  x.translate(0, src.height);
  x.scale(1, -1);
  x.drawImage(src, 0, 0);
  return c;
}

type RGBA = [number, number, number, number];

/** Per-pixel recolour of a sprite; the callback gets the pixel and returns the new one. */
export function recolor(src: HTMLCanvasElement, fn: (p: RGBA, x: number, y: number) => RGBA): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height);
  const x = ctx2d(c);
  x.drawImage(src, 0, 0);
  const img = x.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let j = 0; j < c.height; j++) {
    for (let i = 0; i < c.width; i++) {
      const k = (j * c.width + i) * 4;
      if (d[k + 3] === 0) continue;
      const [r, g, b, a] = fn([d[k], d[k + 1], d[k + 2], d[k + 3]], i, j);
      d[k] = r;
      d[k + 1] = g;
      d[k + 2] = b;
      d[k + 3] = a;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

export function luma([r, g, b]: RGBA): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Dark outline pixels keep their colour under the filters below. */
export function isOutline(p: RGBA): boolean {
  return luma(p) < 62;
}

/** Maps brightness onto a colour ramp, dark to light, in a few hard steps. */
export function rampOf(cols: string[]): (l: number) => RGBA {
  const rgba = cols.map(parseColor);
  return (l) => rgba[Math.min(rgba.length - 1, Math.floor((l / 256) * rgba.length))];
}

/** Hash of a pixel position, stable between frames: 0..1. */
export function noise(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
