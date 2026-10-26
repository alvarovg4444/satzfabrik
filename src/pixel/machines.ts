import type { Look, StationItem } from "./layout";
import { RACK_SLOTS } from "./layout";
import { ascii, box, isOutline, luma, noise, painted, px, rampOf, recolor, rect, type Ctx, type Shade } from "./paint";
import { C, CAR_COLORS, SPR, cached } from "./sprites";

/*
 * Machines for each hall, drawn in their working colours. Rusty, golden and
 * blueprint versions come from recolouring, so every machine gets all four looks.
 */

const RUST = rampOf(["#3e2216", "#5e3420", "#7e4a2a", "#9c6236", "#b87c48", "#d09a68"]);
const GOLD = rampOf(["#7a5208", "#a87a10", "#d4a020", "#f4c430", "#ffe27a", "#fff6c8"]);
const PLAN = rampOf(["#1e4a8c", "#2a64b0", "#3a80cc", "#5aa0e4"]);

export function withLook(key: string, look: Look, make: () => HTMLCanvasElement): HTMLCanvasElement {
  if (look === "work") return cached(key, make);
  return cached(`${key}:${look}`, () =>
    recolor(cached(key, make), (p, x, y) => {
      if (look === "plan") {
        if (isOutline(p)) return [214, 238, 255, 230];
        const [r, g, b] = PLAN(luma(p));
        return [r, g, b, 150];
      }
      if (look === "rust") {
        if (isOutline(p)) return [58, 36, 24, 255];
        const l = luma(p) * (noise(x, y, 3) < 0.22 ? 0.72 : 1);
        return RUST(l);
      }
      if (isOutline(p)) return [90, 60, 8, 255];
      return GOLD(luma(p));
    }),
  );
}

// --- Satzbau-Halle: welding robots (20×24) ---------------------------------------

const ROBOT_A = [
  "....................",
  "......kkkkkkkkkk....",
  ".....kOOOOOOOOOOk...",
  "....kkoooooooooork..",
  "...kjjkrrrrrrrrkMk..",
  "...kjMjk.kkkkkkkMk..",
  "...kjjjk.......kmk..",
  "....kOk........kMk..",
  "....kOk.......knnnk.",
  "....kOok......kMMMk.",
  "....kOok.......kmk..",
  "....koook.......k...",
  ".....kook...........",
  ".....kOok...........",
  "....kkjjkk..........",
  "...kOOOOOOk.........",
  "..kOoooooork........",
  "..krrrrrrrrk........",
  ".kMMMMMMMMMMk.......",
  "kmMMMMMMMMMMnk......",
  "kMykkyykkyyknk......",
  "kMkyykkyykkynk......",
  "kMnnnnnnnnnnnk......",
  ".kkkkkkkkkkkk.......",
];

const ROBOT_B = [
  "....................",
  "....................",
  "....................",
  "......kkkkkkk.......",
  "...kkkOOOOOOOk......",
  "...kjjkoooooooOk....",
  "...kjMjkrrrroooOk...",
  "...kjjjk...krroooOk.",
  "....kOk......krrook.",
  "....kOk.......kkMk..",
  "....kOok.......kMk..",
  "....koook.....knnnk.",
  ".....kook.....kMMMk.",
  ".....kOok......kmk..",
  "....kkjjkk......k...",
  "...kOOOOOOk.........",
  "..kOoooooork........",
  "..krrrrrrrrk........",
  ".kMMMMMMMMMMk.......",
  "kmMMMMMMMMMMnk......",
  "kMykkyykkyyknk......",
  "kMkyykkyykkynk......",
  "kMnnnnnnnnnnnk......",
  ".kkkkkkkkkkkk.......",
];

const ROBOT_PAL = {
  k: C.ink,
  O: C.orangeHi,
  o: C.orange,
  r: C.orangeLo,
  M: C.metal,
  m: C.metalHi,
  n: C.metalLo,
  j: C.joint,
  y: C.helmet,
};

/** Where the welding tip is in frame 1, relative to the sprite. */
export const ROBOT_TIP = { x: 17, y: 13 };

export function robot(frame: number, look: Look): HTMLCanvasElement {
  return withLook(`robot${frame}`, look, () => ascii(frame ? ROBOT_B : ROBOT_A, ROBOT_PAL));
}

// --- Verbschmiede: forging presses ---------------------------------------------------

const PRESS_TOP = [".kkkkkkkkkkkk.", "kGGGGGGGGGGGgk", "kGggggggggggdk", "kykykykykykykk", "kddddddddddddk", "kGgkkkkkkkkgdk"];
const PRESS_BOTTOM = ["kkkkkkkkkkkkkk", "kGGGGGGGGGGGgk", "kGggggggggggdk", ".kkkkkkkkkkkk."];
const PRESS_UP = [
  ...PRESS_TOP,
  "kGgxkMMMMkxgdk",
  "kGgxkMmmnkxgdk",
  "kGgxkkkkkkxgdk",
  "kGgxxxxxxxxgdk",
  "kGgxxxxxxxxgdk",
  "kGgxxkOOkxxgdk",
  "kGgxkmmmmkxgdk",
  ...PRESS_BOTTOM,
];
const PRESS_DOWN = [
  ...PRESS_TOP,
  "kGgxxkMnkxxgdk",
  "kGgxxkMnkxxgdk",
  "kGgxkMMMMkxgdk",
  "kGgxkMmmnkxgdk",
  "kGgxkkkkkkxgdk",
  "kGgxkoOOokxgdk",
  "kGgxkmmmmkxgdk",
  ...PRESS_BOTTOM,
];

const PRESS_PAL = {
  k: C.ink,
  G: "#7fd4a8",
  g: "#3c9a72",
  d: "#26684c",
  M: C.metalHi,
  m: C.metal,
  n: C.metalLo,
  x: C.deep,
  O: C.hot,
  o: C.hotLo,
  y: C.helmet,
};

/** Frame 1 is the stroke; the glowing piece is at PRESS_HIT. */
export const PRESS_HIT = { x: 7, y: 11 };

export function press(frame: number, look: Look): HTMLCanvasElement {
  return withLook(`press${frame}`, look, () => ascii(frame ? PRESS_DOWN : PRESS_UP, PRESS_PAL));
}

const GREEN: Shade = { o: C.ink, l: "#7fd4a8", m: "#3c9a72", d: "#26684c" };
const STEEL: Shade = { o: C.ink, l: C.metalHi, m: C.metal, d: C.metalLo };

/** Big transfer press for the grammar machines of the forge (20×22). */
export function bigPress(frame: number, look: Look): HTMLCanvasElement {
  return withLook(`bigpress${frame}`, look, () =>
    painted(20, 22, (c) => {
      box(c, 0, 0, 20, 7, GREEN);
      for (let x = 1; x < 19; x++) px(c, x, 5, x % 2 ? C.helmet : C.ink);
      box(c, 0, 6, 4, 12, GREEN);
      box(c, 16, 6, 4, 12, GREEN);
      rect(c, 4, 7, 12, 10, C.deep);
      const ry = frame ? 10 : 7;
      rect(c, 9, 7, 2, ry - 7 + 1, C.metal);
      box(c, 5, ry, 10, 4, STEEL);
      // the sheet being stamped into a car door
      if (frame) {
        rect(c, 5, 14, 10, 2, C.ink);
        rect(c, 6, 14, 8, 1, "#c8d0dc");
      } else {
        rect(c, 5, 14, 10, 1, "#c8d0dc");
        rect(c, 5, 15, 10, 1, C.ink);
      }
      rect(c, 4, 16, 12, 1, C.metalLo);
      box(c, 0, 17, 20, 5, GREEN);
      px(c, 2, 2, C.red);
      px(c, 17, 2, frame ? C.green : C.metalLo);
    }),
  );
}

// --- Kasuswerk: paint booths (22×24) ---------------------------------------------

const BOOTH_FRAME: Shade = { o: C.ink, l: "#f4f6f8", m: "#d4d9e0", d: "#a8b0bc" };

/** A paint booth with a car inside. `color` picks the paint, frame 1 sprays. */
export function booth(frame: number, look: Look, color: number): HTMLCanvasElement {
  const paint = look === "rust" ? -1 : look === "gold" ? 6 : color;
  return withLook(`booth${frame}c${paint}`, look, () =>
    painted(22, 24, (c) => {
      const accent = paint < 0 ? C.metal : CAR_COLORS[paint % CAR_COLORS.length].P;
      // floor grate
      rect(c, 2, 6, 18, 17, "#3a404c");
      for (let y = 7; y < 23; y += 2) rect(c, 2, y, 18, 1, "#4a5260");
      // back wall with filter mats
      rect(c, 2, 4, 18, 4, "#8c96a4");
      for (let x = 3; x < 20; x += 3) rect(c, x, 5, 2, 2, "#b8c0cc");
      // the car (primer until painted)
      const car = paint < 0 ? SPR.car(0, "up", true) : SPR.car(paint, "up");
      c.drawImage(car, 5, 7);
      // posts and header with the paint colour
      box(c, 0, 0, 22, 5, BOOTH_FRAME);
      rect(c, 2, 2, 18, 1, accent);
      box(c, 0, 4, 3, 20, BOOTH_FRAME);
      box(c, 19, 4, 3, 20, BOOTH_FRAME);
      // spray arm from the right post
      rect(c, 15, 11, 5, 2, C.ink);
      rect(c, 15, 11, 4, 1, C.metal);
      px(c, 14, 11, C.ink);
      px(c, 14, 12, frame ? accent : C.metalLo);
    }),
  );
}

// --- Redemittel-Manufaktur: craft benches with a worker (16×20) ------------------

const BENCH_TOP: Shade = { o: C.ink, l: "#e8b878", m: "#c8904c", d: "#946234" };

function benchObject(c: Ctx, v: number): void {
  switch (v % 4) {
    case 0: // steering wheel
      rect(c, 5, 11, 5, 1, C.ink);
      rect(c, 4, 12, 1, 2, C.ink);
      rect(c, 10, 12, 1, 2, C.ink);
      rect(c, 5, 14, 5, 1, C.ink);
      rect(c, 7, 12, 1, 2, C.metalLo);
      break;
    case 1: // seat cushion
      rect(c, 4, 11, 7, 3, C.ink);
      rect(c, 5, 11, 5, 2, "#c84848");
      rect(c, 5, 11, 5, 1, "#e87070");
      break;
    case 2: // door panel
      rect(c, 3, 11, 9, 3, C.ink);
      rect(c, 4, 11, 7, 2, "#d4d9e0");
      px(c, 9, 12, C.metalLo);
      break;
    default: // toolbox
      rect(c, 4, 11, 7, 3, C.ink);
      rect(c, 5, 11, 5, 2, C.red);
      rect(c, 6, 10, 3, 1, C.ink);
  }
}

function benchOnly(frame: number, v: number): HTMLCanvasElement {
  return painted(16, 20, (c) => {
    box(c, 0, 12, 16, 4, BENCH_TOP);
    rect(c, 1, 16, 14, 3, "#7a4e28");
    rect(c, 1, 16, 14, 1, C.ink);
    rect(c, 1, 19, 2, 1, C.ink);
    rect(c, 13, 19, 2, 1, C.ink);
    rect(c, 0, 16, 1, 4, C.ink);
    rect(c, 15, 16, 1, 4, C.ink);
    benchObject(c, v);
    if (frame) {
      px(c, 12, 10, C.metalLo);
      px(c, 12, 11, C.ink);
    }
  });
}

/** A craft bench with its worker behind it. Only the bench rusts or turns gold. */
export function bench(frame: number, look: Look, v: number): HTMLCanvasElement {
  const top = withLook(`benchonly${frame}v${v % 4}`, look, () => benchOnly(frame, v % 4));
  if (look === "plan") return top;
  return cached(`bench${frame}v${v % 4}:${look}`, () =>
    painted(16, 20, (c) => {
      c.drawImage(SPR.worker("down", 0), 2, frame ? 1 : 0);
      c.drawImage(top, 0, 0);
    }),
  );
}

// --- Wortlager: pallet racks with one crate per word (23×24) ---------------------

const UPRIGHT: Shade = { o: C.ink, l: C.blueHi, m: C.blue, d: C.blueLo };

type CrateStyle = { o: string; f: string; hi: string; mark: string };
const CRATES: CrateStyle[] = [
  { o: "#8cc8ff", f: "", hi: "", mark: "" },
  { o: "#8a5a30", f: "#d8a868", hi: "#ecc890", mark: "#f6e2b8" },
  { o: "#5e3a1e", f: "#b87838", hi: "#d89858", mark: "#8a5020" },
  { o: "#1e3c80", f: "#4a8ae8", hi: "#8ab8ff", mark: "#244896" },
  { o: "#4a5262", f: "#b8c0cc", hi: "#eef2f6", mark: "#7e8796" },
  { o: "#8a6408", f: "#f4c430", hi: "#fff6a8", mark: "#d4a020" },
];

function crate(c: Ctx, x: number, y: number, stage: number, due: boolean): void {
  if (stage <= 0) {
    for (let i = 0; i < 5; i++) {
      if (i % 2 === 0) {
        px(c, x + i, y, CRATES[0].o);
        px(c, x + i, y + 4, CRATES[0].o);
        px(c, x, y + i, CRATES[0].o);
        px(c, x + 4, y + i, CRATES[0].o);
      }
    }
    return;
  }
  const s = CRATES[Math.min(5, stage)];
  rect(c, x, y, 5, 5, s.o);
  rect(c, x + 1, y + 1, 3, 3, due ? "#9c7a5c" : s.f);
  rect(c, x + 1, y + 1, 3, 1, due ? "#b8967a" : s.hi);
  if (stage === 1) rect(c, x + 2, y + 1, 1, 3, s.mark);
  else if (stage === 2) rect(c, x + 1, y + 3, 3, 1, s.mark);
  else if (stage === 3) px(c, x + 2, y + 2, s.mark);
  else if (stage === 4) {
    px(c, x + 1, y + 3, s.mark);
    px(c, x + 3, y + 3, s.mark);
  } else px(c, x + 1, y + 1, "#ffffff");
  if (due) {
    px(c, x + 3, y + 2, C.rust);
    px(c, x + 1, y + 3, C.rust);
    px(c, x + 4, y, C.red);
  }
}

/** The look of one crate: the weakest of the words it holds. */
export function crateState(items: StationItem[]): { stage: number; due: boolean } {
  let stage = 5;
  let due = false;
  for (const it of items) {
    stage = Math.min(stage, it.stage);
    due ||= it.due;
  }
  return { stage, due };
}

/** Splits a rack's items into its crates. */
export function crates(items: StationItem[]): StationItem[][] {
  const per = Math.max(1, Math.ceil(items.length / RACK_SLOTS));
  const out: StationItem[][] = [];
  for (let i = 0; i < items.length; i += per) out.push(items.slice(i, i + per));
  return out;
}

export function rack(items: StationItem[]): HTMLCanvasElement {
  const groups = crates(items).map(crateState);
  const key = `rack${groups.map((g) => `${g.stage}${g.due ? "r" : ""}`).join(".")}`;
  return cached(key, () =>
    painted(23, 24, (c) => {
      // shadow on the floor
      rect(c, 2, 22, 20, 2, "rgba(40,48,64,0.25)");
      box(c, 0, 0, 3, 24, UPRIGHT);
      box(c, 20, 0, 3, 24, UPRIGHT);
      for (const by of [6, 14, 22]) {
        rect(c, 3, by, 17, 2, C.ink);
        rect(c, 3, by, 17, 1, C.orange);
      }
      groups.forEach((g, i) => {
        const col = i % 3;
        const row = 2 - Math.floor(i / 3);
        crate(c, 3 + col * 6, 1 + row * 8, g.stage, g.due);
      });
    }),
  );
}

/** Empty floor spot: a dashed yellow outline where the next machine goes. */
export function freeSpot(c: Ctx, x: number, y: number, w: number, h: number, col: string): void {
  for (let i = 0; i < w; i += 2) {
    px(c, x + i, y + h - 1, col);
    px(c, x + i, y + Math.floor(h / 2), col);
  }
  for (let j = Math.floor(h / 2); j < h; j += 2) {
    px(c, x, y + j, col);
    px(c, x + w - 1, y + j, col);
  }
}
