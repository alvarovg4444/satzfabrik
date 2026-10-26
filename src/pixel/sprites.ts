import { ascii, flipX, flipY, painted, rect, rotateCW } from "./paint";

/** GBA-style palette: dark blue-grey outlines, three tones per material, light from the top left. */
export const C = {
  ink: "#283040",
  deep: "#1c2230",
  white: "#f8f8f8",
  helmetHi: "#fff27a",
  helmet: "#f8c820",
  helmetLo: "#c88a00",
  skin: "#f9c8a0",
  skinLo: "#d89870",
  hair: "#6b4630",
  vest: "#f6893a",
  reflect: "#f0f0e8",
  blueHi: "#6f9ef0",
  blue: "#3866c8",
  blueLo: "#244896",
  boot: "#4d4d58",
  orangeHi: "#ffb05a",
  orange: "#f07a1c",
  orangeLo: "#b44c0a",
  metalHi: "#dfe5ec",
  metal: "#9ea7b6",
  metalLo: "#5e6778",
  joint: "#3a404c",
  rust: "#a85c2c",
  goldHi: "#fff6a8",
  gold: "#f4c430",
  goldLo: "#b88a10",
  red: "#e84038",
  redLo: "#a82820",
  green: "#48c058",
  glassHi: "#b8e4ff",
  glass: "#2c3c58",
  tire: "#1c1c24",
  headlight: "#fff6a0",
  leafHi: "#a8e070",
  leaf: "#58b048",
  leafMid: "#3c9040",
  leafLo: "#286a34",
  trunk: "#8a5a30",
  trunkLo: "#5e3a1e",
  hot: "#ffe070",
  hotLo: "#ff8a20",
} as const;

// --- workers in yellow helmets (12×16) ----------------------------------------

const HEAD_FRONT = [
  "...kkkkkk...",
  "..kYYyyyyk..",
  ".kYyyyyyyhk.",
  ".kyyyyyyyhk.",
  "khhhhhhhhhhk",
  ".kssssssssk.",
  ".kskssssksk.",
  ".ktsssssstk.",
  "..kkttttkk..",
];
const HEAD_BACK = [
  "...kkkkkk...",
  "..kYYyyyyk..",
  ".kYyyyyyyhk.",
  ".kyyyyyyyhk.",
  "khhhhhhhhhhk",
  ".knnnnnnnnk.",
  ".knnnnnnnnk.",
  "..knnnnnnk..",
  "..kktttkkk..",
];
const BODY_FRONT = [".kvvvbbvvvk.", "kgvwvbbvwvgk", "kgvvvbbvvvgk"];
const BODY_BACK = [".kvvvvvvvvk.", "kgvwwwwwwvgk", "kgvvvvvvvvgk"];
const LEGS_STAND = [".kbbbbbbbbk.", ".kbbbddbbbk.", ".kgggkkgggk.", "..kkk..kkk.."];
const LEGS_WALK_A = [".kbbbbbbbbk.", ".kbbbddbbbk.", ".kgggkkbbbk.", "..kkk.kgggk."];
const LEGS_WALK_B = [".kbbbbbbbbk.", ".kbbbddbbbk.", ".kbbbkkgggk.", ".kgggk.kkk.."];

const WORKER_SIDE_A = [
  "...kkkkk....",
  "..kYYyyyk...",
  ".kYyyyyyhk..",
  ".kyyyyyyyhk.",
  ".khhhhhhhhhk",
  "..knnsssssk.",
  "..knssssksk.",
  "..knsssssstk",
  "...kktttkk..",
  "...kvvvvk...",
  "..kvwwwvgk..",
  "..kvvvvvgk..",
  "...kbbbbk...",
  "...kbbbbk...",
  "..kggkkggk..",
  "..kkk..kkk..",
];

const WORKER_SIDE_B = [
  ...WORKER_SIDE_A.slice(0, 10),
  "..kvwwwvk...",
  "..kvvvvgk...",
  "...kbbbbk...",
  "...kbbbbk...",
  "...kggggk...",
  "...kkkkkk...",
];

type Pal = Record<string, string>;

const WORKER_PAL: Pal = {
  k: C.ink,
  Y: C.helmetHi,
  y: C.helmet,
  h: C.helmetLo,
  s: C.skin,
  t: C.skinLo,
  n: C.hair,
  v: C.vest,
  w: C.reflect,
  B: C.blueHi,
  b: C.blue,
  d: C.blueLo,
  g: C.boot,
};

/** Shift supervisor: white helmet, blue vest. */
const BOSS_PAL: Pal = {
  ...WORKER_PAL,
  Y: "#ffffff",
  y: "#e6e8f0",
  h: "#a8aebc",
  v: "#3a72e0",
  w: "#f8e868",
  b: "#4d4d58",
  d: "#383840",
  n: "#2c2c34",
};

/** Apprentice: green helmet. */
const TRAINEE_PAL: Pal = {
  ...WORKER_PAL,
  Y: "#b8f0a0",
  y: "#58c048",
  h: "#2c8a30",
  v: "#58c048",
  w: "#f8f8f8",
};

// --- cars, top-down, facing up (12×16) -------------------------------------------

const CAR = [
  "..kkkkkkkk..",
  ".kYPPPPPPYk.",
  ".kQPPPPPPpk.",
  "tkQPPPPPPpkt",
  "tkQggggggpkt",
  "tkQgwwgggpkt",
  ".kQgggwggpk.",
  ".kQQQQQQQpk.",
  ".kQQPPPPPpk.",
  ".kQPPPPPPpk.",
  ".kQggggggpk.",
  "tkQgwggggpkt",
  "tkQPPPPPPpkt",
  "tkQPPPPPPpkt",
  ".kRppppppRk.",
  "..kkkkkkkk..",
];

export const CAR_COLORS: { Q: string; P: string; p: string }[] = [
  { Q: "#ff8a78", P: "#e84038", p: "#a82820" },
  { Q: "#86b4ff", P: "#3a72e0", p: "#2448a0" },
  { Q: "#ffffff", P: "#e4e8ee", p: "#a8b0bc" },
  { Q: "#6c7080", P: "#43465a", p: "#2a2c38" },
  { Q: "#e4eaf2", P: "#b8c0cc", p: "#7e8796" },
  { Q: "#86e09a", P: "#3cae5a", p: "#257a3c" },
  { Q: "#fff08a", P: "#f4c430", p: "#b88a10" },
  { Q: "#ffb870", P: "#f07a1c", p: "#b44c0a" },
  { Q: "#d6a0f0", P: "#9a50d0", p: "#64308c" },
  { Q: "#8ae6e0", P: "#30b0b0", p: "#1c7678" },
];

const PRIMER = { Q: "#d4d8df", P: "#b4bac4", p: "#848c98" };

function carPal(color: number, primer: boolean): Pal {
  const p = primer ? PRIMER : CAR_COLORS[((color % CAR_COLORS.length) + CAR_COLORS.length) % CAR_COLORS.length];
  return {
    k: C.ink,
    t: C.tire,
    Q: p.Q,
    P: p.P,
    p: p.p,
    g: primer ? "#4a505c" : C.glass,
    w: primer ? "#5e6672" : C.glassHi,
    Y: primer ? p.P : C.headlight,
    R: primer ? p.p : C.red,
  };
}

// --- forklift, top-down, facing right (18×10) -----------------------------------

const FORKLIFT = [
  "..tt.....tt.......",
  ".kkkkkkkkkkk......",
  "kddkYYYYYYYk......",
  "kdddkkkkkkYkmkkkkk",
  "kdddkhHhk.YkmMMMMk",
  "kdddkhhhk.YkmkkkkM",
  "kdddkkkkkkYkmMMMMk",
  "kddkYYYYYYYkmkkkkk",
  ".kkkkkkkkkkk......",
  "..tt.....tt.......",
];

const FORKLIFT_LOADED = [
  "..tt.....tt.......",
  ".kkkkkkkkkkk.kkkkk",
  "kddkYYYYYYYkkXXXXk",
  "kdddkkkkkkYkmXxxXk",
  "kdddkhHhk.YkmXXXXk",
  "kdddkhhhk.YkmXxxXk",
  "kdddkkkkkkYkmXXXXk",
  "kddkYYYYYYYkkXxxXk",
  ".kkkkkkkkkkk.kkkkk",
  "..tt.....tt.......",
];

const FORKLIFT_PAL: Pal = {
  k: C.ink,
  t: C.tire,
  d: "#5e6778",
  Y: C.helmet,
  h: C.helmet,
  H: C.helmetHi,
  m: C.metalLo,
  M: C.metal,
  X: "#d8a868",
  x: "#a8743c",
};

// --- scenery --------------------------------------------------------------------

const TREE = [
  "........kkkkk.........",
  "......kkLLGGGkk.......",
  ".....kLLGGGGGGGk......",
  "....kLGGGGGGGGGGk.....",
  "...kLGGGLLGGGGGGgk....",
  "...kGGGLLLGGGGGGGk....",
  "..kLGGGLLGGGGGGGGgk...",
  "..kGGGGGGGGGGGGGggk...",
  "..kGGGGGGGGGGGgggdk...",
  ".kLGGGGGGGGGGgggddgk..",
  ".kGGGLLGGGGGgggdddgk..",
  ".kGGLLLGGGGgggddddgk..",
  ".kGGGGGGGGgggdddddgk..",
  ".kgGGGGGGgggddddddgk..",
  "..kgggggggddddddddk...",
  "..kkgggdddddddddkkk...",
  "....kkkddddddkkk......",
  ".......kkkkkkk........",
  "........kTTtk.........",
  "........kTTtk.........",
  ".......kkTttkk........",
  "......kddkkkkddk......",
  ".......kkk..kkk.......",
];

const SMALL_TREE = [
  ".....kkkk.....",
  "...kkLLGGkk...",
  "..kLLGGGGGgk..",
  ".kLGGLGGGGggk.",
  ".kGGLLGGGgggk.",
  "kLGGGGGGgggddk",
  "kGGGGGGgggdddk",
  "kgGGGGgggddddk",
  ".kggggddddddk.",
  "..kkkddddkkk..",
  "....kkkkkk....",
  ".....kTtk.....",
  ".....kTtk.....",
  "....kdkkdk....",
  ".....k..k.....",
];

const TREE_PAL: Pal = { k: C.ink, L: C.leafHi, G: C.leaf, g: C.leafMid, d: C.leafLo, T: C.trunk, t: C.trunkLo };

const BUSH = [
  "...kkkkkk.....",
  "..kLGGGGGkkk..",
  ".kLGLLGGGGGgk.",
  "kLGGGGGGGgggdk",
  "kGGGGGGgggdddk",
  "kgGGGgggddddgk",
  ".kggggddddddk.",
  "..kkkkkkkkkk..",
];

const FLOWER_A = [".w.", "wYw", ".w."];
const FLOWER_B = ["w.w", ".Y.", "w.w"];

const CONE = ["...k...", "..kOk..", "..kwk..", ".kOOOk.", ".kwwwk.", "kOOOOOk", "kkkkkkk"];

/** Street lamp in 3/4 view (7×18): head with the light, pole, foot. */
const LAMP = [
  ".kkkkk.",
  "kMMMMMk",
  "kLLLLLk",
  ".kkkkk.",
  "...k...",
  "..kmk..",
  "..kmk..",
  "..kmk..",
  "..kmk..",
  "..kmk..",
  "..kmk..",
  "..kmk..",
  "..kmk..",
  "..kmk..",
  "..kmk..",
  ".kkmkk.",
  "kmmmmnk",
  ".kkkkk.",
];

/** Oil barrel, 3/4 view (8×10). */
const BARREL = [
  ".kkkkkk.",
  "kBbbbbbk",
  "kbkkkkbk",
  "kBbbbbdk",
  "kkkkkkkk",
  "kBbwbbdk",
  "kBbbbbdk",
  "kkkkkkkk",
  "kBbbbbdk",
  ".kkkkkk.",
];

const BUBBLE = [
  ".kkkkkkk.",
  "kwwwwwwwk",
  "kwwwRwwwk",
  "kwwwRwwwk",
  "kwwwRwwwk",
  "kwwwwwwwk",
  "kwwwRwwwk",
  "kwwwwwwwk",
  ".kkkkkkk.",
  "...kwk...",
  "....k....",
];

const SPARKLE_A = ["...o...", "...Y...", "..oYo..", "oYYWYYo", "..oYo..", "...Y...", "...o..."];
const SPARKLE_B = [".......", ".......", "...Y...", "..YWY..", "...Y...", ".......", "......."];

const PUFF_A = [".ww.", "wwwW", "wWWW", ".WW."];
const PUFF_B = ["..ww..", ".wwwwW", "wwwwWW", "wwwWWW", ".wWWW.", "..WW.."];

// --- the sprite bank ----------------------------------------------------------------

const bank = new Map<string, HTMLCanvasElement>();

export function cached(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
  let c = bank.get(key);
  if (!c) {
    c = make();
    bank.set(key, c);
  }
  return c;
}

export type Facing = "up" | "down" | "left" | "right";

function worker(facing: Facing, frame: number, pal: Pal, key: string): HTMLCanvasElement {
  return cached(`${key}${facing}${frame}`, () => {
    if (facing === "left" || facing === "right") {
      const s = ascii(frame % 2 ? WORKER_SIDE_B : WORKER_SIDE_A, pal);
      return facing === "left" ? flipX(s) : s;
    }
    const legs = frame === 0 ? LEGS_STAND : frame === 1 ? LEGS_WALK_A : LEGS_WALK_B;
    const rows = facing === "down" ? [...HEAD_FRONT, ...BODY_FRONT, ...legs] : [...HEAD_BACK, ...BODY_BACK, ...legs];
    return ascii(rows, pal);
  });
}

export const SPR = {
  /** frame 0 standing, 1 and 2 walking. */
  worker: (facing: Facing, frame: number) => worker(facing, frame, WORKER_PAL, "w"),
  boss: (facing: Facing, frame: number) => worker(facing, frame, BOSS_PAL, "b"),
  trainee: (facing: Facing, frame: number) => worker(facing, frame, TRAINEE_PAL, "a"),
  car: (color: number, facing: Facing = "up", primer = false) =>
    cached(`car${color}${facing}${primer ? "p" : ""}`, () => {
      const up = ascii(CAR, carPal(color, primer));
      if (facing === "up") return up;
      if (facing === "right") return rotateCW(up);
      if (facing === "down") return flipY(up);
      return flipX(rotateCW(up));
    }),
  forklift: (left: boolean, loaded: boolean) =>
    cached(`fl${left ? "l" : "r"}${loaded ? "x" : ""}`, () => {
      const s = ascii(loaded ? FORKLIFT_LOADED : FORKLIFT, FORKLIFT_PAL);
      return left ? flipX(s) : s;
    }),
  truck: (color: number, left: boolean, load: number[]) =>
    cached(`tr${color}${left ? "l" : "r"}${load.join(",")}`, () => {
      const s = drawTruck(color, load);
      return left ? flipX(s) : s;
    }),
  tree: () => cached("tree", () => ascii(TREE, TREE_PAL)),
  smallTree: () => cached("stree", () => ascii(SMALL_TREE, TREE_PAL)),
  bush: () => cached("bush", () => ascii(BUSH, TREE_PAL)),
  flower: (frame: number, color: string) =>
    cached(`fw${frame}${color}`, () => ascii(frame ? FLOWER_B : FLOWER_A, { w: color, Y: C.helmet })),
  cone: () => cached("cone", () => ascii(CONE, { k: C.ink, O: C.orange, w: C.white })),
  lamp: (on: boolean) =>
    cached(`lamp${on ? 1 : 0}`, () =>
      ascii(LAMP, { k: C.ink, M: C.metalLo, m: C.metal, n: C.metalLo, L: on ? "#fff3b0" : "#c8d0dc" }),
    ),
  barrel: () => cached("barrel", () => ascii(BARREL, { k: C.ink, B: C.blueHi, b: C.blue, d: C.blueLo, w: C.white })),
  bubble: () => cached("bubble", () => ascii(BUBBLE, { k: C.ink, w: C.white, R: C.red })),
  sparkle: (frame: number) =>
    cached(`sp${frame}`, () => ascii(frame ? SPARKLE_B : SPARKLE_A, { o: C.goldLo, Y: C.gold, W: "#ffffff" })),
  puff: (frame: number) =>
    cached(`pf${frame}`, () => ascii(frame ? PUFF_B : PUFF_A, { w: "#f4f4f4", W: "#c8ccd4" })),
};

/** Car transporter, top-down, facing right: cab plus a trailer with up to two cars. */
function drawTruck(color: number, load: number[]): HTMLCanvasElement {
  const cab = CAR_COLORS[color % CAR_COLORS.length];
  const W = 52;
  const H = 14;
  return painted(W, H, (c) => {
    // trailer: frame rails and deck
    rect(c, 0, 1, 38, 12, C.ink);
    rect(c, 1, 2, 36, 10, "#5e6778");
    rect(c, 1, 2, 36, 1, "#7e8796");
    for (let x = 3; x < 37; x += 4) rect(c, x, 3, 1, 8, "#4d5462");
    // trailer tires
    for (const x of [3, 8, 27]) {
      rect(c, x, 0, 4, 1, C.tire);
      rect(c, x, 13, 4, 1, C.tire);
    }
    // cars on the deck, facing right
    load.slice(0, 2).forEach((col, i) => {
      const car = SPR.car(col, "right");
      c.drawImage(car, 1 + i * 18, 1);
    });
    // hitch
    rect(c, 38, 6, 2, 2, C.ink);
    // cab
    const cx = 40;
    rect(c, cx, 1, 11, 12, C.ink);
    rect(c, cx + 1, 2, 9, 10, cab.P);
    rect(c, cx + 1, 2, 9, 1, cab.Q);
    rect(c, cx + 1, 2, 1, 10, cab.Q);
    rect(c, cx + 1, 11, 9, 1, cab.p);
    rect(c, cx + 6, 2, 3, 10, C.glass);
    rect(c, cx + 6, 3, 1, 3, C.glassHi);
    rect(c, cx + 10, 2, 1, 2, C.headlight);
    rect(c, cx + 10, 10, 1, 2, C.headlight);
    // cab tires and mirrors
    rect(c, cx + 2, 0, 4, 1, C.tire);
    rect(c, cx + 2, 13, 4, 1, C.tire);
    rect(c, cx + 7, 0, 2, 1, C.ink);
    rect(c, cx + 7, 13, 2, 1, C.ink);
  });
}
