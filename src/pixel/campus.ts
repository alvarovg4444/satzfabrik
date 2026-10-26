import { fmt } from "../game/economy";
import { text, textWidth } from "./font";
import { SHED, type Building } from "./layout";
import { bigPress } from "./machines";
import { ANIMATE2, DRAW2, lights2 } from "./campus2";
import { BRICK, CONCRETE, CREAM, DIRT, DIRT_LO, FLAT_ROOF, GLASS, GLASS_HI, goldFlag, LIT, LIT_LO, PAVE, PAVE_LO, plate, SHADOW, speckle, TAR, window, WOOD } from "./campusKit";
import { box, noise, px, rect, type Ctx } from "./paint";
import { C, SPR } from "./sprites";

/*
 * What Taler build on the map: the buildings on the factory grounds (static parts here,
 * moving parts in animateBuilding), the plot for the next one, and the yard pieces
 * (tool shed, combo press, clock). Everything is drawn in logical pixels.
 */

// --- the plot for the next building ------------------------------------------------

export function drawPlot(c: Ctx, b: Building): void {
  rect(c, b.x, b.y, b.w, b.h, DIRT);
  speckle(c, b.x + 1, b.y + 1, b.w - 2, b.h - 2, b.x * 7 + b.y, DIRT_LO, "#dcbc8c", b.w);
  // pegs and red-white tape around it
  for (let x = b.x; x < b.x + b.w; x++) {
    const col = Math.floor((x - b.x) / 3) % 2 ? C.white : C.red;
    px(c, x, b.y, col);
    px(c, x, b.y + b.h - 1, col);
  }
  for (let y = b.y; y < b.y + b.h; y++) {
    const col = Math.floor((y - b.y) / 3) % 2 ? C.white : C.red;
    px(c, b.x, y, col);
    px(c, b.x + b.w - 1, y, col);
  }
  for (const [x, y] of [
    [b.x, b.y],
    [b.x + b.w - 2, b.y],
    [b.x, b.y + b.h - 2],
    [b.x + b.w - 2, b.y + b.h - 2],
  ])
    rect(c, x, y, 2, 2, C.ink);
  // the sign: what will stand here and what it costs
  const lines = ["BAUPLATZ", b.sign.toUpperCase()];
  const price = fmt(b.price);
  const tw = Math.max(...lines.map((l) => textWidth(l)), textWidth(price) + 5);
  const sx = b.x + Math.floor((b.w - tw - 6) / 2);
  const sy = b.y + 4;
  rect(c, sx, sy, tw + 6, 22, C.ink);
  rect(c, sx + 1, sy + 1, tw + 4, 20, C.helmet);
  rect(c, sx + 1, sy + 1, tw + 4, 1, C.helmetHi);
  text(c, lines[0], sx + 3, sy + 2, C.ink);
  text(c, lines[1], sx + 3, sy + 8, C.ink);
  // a coin and the price
  const px0 = sx + 3;
  rect(c, px0, sy + 15, 3, 3, C.goldLo);
  px(c, px0 + 1, sy + 14, C.goldLo);
  px(c, px0 + 1, sy + 18, C.goldLo);
  px(c, px0 + 1, sy + 15, C.goldHi);
  text(c, price, px0 + 5, sy + 14, C.ink);
  rect(c, sx + 3, sy + 22, 1, 4, C.ink);
  rect(c, sx + tw + 2, sy + 22, 1, 4, C.ink);
}

// --- buildings, static parts ------------------------------------------------------------

export function drawBuilding(c: Ctx, b: Building): void {
  switch (b.id) {
    case "kantine":
      return kantine(c, b);
    case "wasserturm":
      return wasserturm(c, b);
    case "parkhaus":
      return parkhaus(c, b);
    case "ausbildung":
      return ausbildung(c, b);
    case "solarpark":
      return solarpark(c, b);
    case "bahn":
      return gleis(c, b);
    case "teststrecke":
      return teststrecke(c, b);
    case "heliport":
      return heliport(c, b);
    default:
      return DRAW2[b.id]?.(c, b);
  }
}

/** Red and white parasol seen from above, 9×9. */
function parasol(c: Ctx, x: number, y: number, col: string): void {
  for (let j = 0; j < 9; j++) {
    for (let i = 0; i < 9; i++) {
      const dx = i - 4;
      const dy = j - 4;
      const d = Math.hypot(dx, dy);
      if (d > 4.6) continue;
      if (d > 3.7) {
        px(c, x + i, y + j, C.ink);
        continue;
      }
      const seg = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * 8) % 2;
      px(c, x + i, y + j, seg ? C.white : col);
    }
  }
  px(c, x + 4, y + 4, C.ink);
}

function kantine(c: Ctx, b: Building): void {
  const { x, y, w } = b;
  // flat roof with gravel and the kitchen vent
  box(c, x, y, w, 15, FLAT_ROOF);
  speckle(c, x + 2, y + 2, w - 4, 10, x + y, "#8a94a2", "#c4ccd6", 40);
  box(c, x + w - 12, y + 2, 8, 6, { o: C.ink, l: C.metalHi, m: C.metal, d: C.metalLo });
  rect(c, x + w - 10, y + 4, 4, 1, C.metalLo);
  if (b.level >= 3) {
    // roof garden
    rect(c, x + 2, y + 2, w - 16, 9, "#6cbc50");
    for (let i = 0; i < 14; i++) px(c, x + 3 + Math.floor(noise(i, y, 61) * (w - 18)), y + 3 + Math.floor(noise(i, y, 62) * 7), i % 3 ? "#4c9a40" : "#f85868");
    rect(c, x + 6, y + 3, 4, 4, "#3c9040");
    rect(c, x + w - 22, y + 3, 4, 4, "#3c9040");
  }
  // facade with big windows, a door and a green awning
  box(c, x, y + 14, w, 15, CREAM);
  for (const wx of [x + 4, x + 15, x + w - 23, x + w - 12]) window(c, wx, y + 19, 8, 7);
  const dx = x + Math.floor(w / 2) - 4;
  rect(c, dx, y + 18, 8, 11, C.ink);
  rect(c, dx + 1, y + 19, 6, 10, "#7a4e28");
  rect(c, dx + 1, y + 19, 2, 9, GLASS);
  rect(c, dx + 5, y + 19, 2, 9, GLASS);
  for (let i = x + 2; i < x + w - 2; i++) {
    px(c, i, y + 15, C.ink);
    px(c, i, y + 16, Math.floor((i - x) / 2) % 2 ? C.white : "#3cae5a");
    px(c, i, y + 17, Math.floor((i - x) / 2) % 2 ? "#d8d8d0" : "#257a3c");
  }
  plate(c, "KANTINE", x + w / 2, y + 8);
  // terrace with parasols and a worker on a break
  rect(c, x + 1, y + 29, w - 2, 11, PAVE);
  for (let i = x + 1; i < x + w - 1; i += 5) rect(c, i, y + 29, 1, 11, PAVE_LO);
  rect(c, x + 1, y + 39, w - 2, 1, PAVE_LO);
  const cols = [C.red, "#3a72e0", C.red];
  [x + 3, x + Math.floor(w / 2) + 6, x + w - 12].forEach((px0, i) => {
    rect(c, px0 + 1, y + 37, 2, 2, "#7a4e28");
    rect(c, px0 + 6, y + 37, 2, 2, "#7a4e28");
    parasol(c, px0, y + 29, cols[i]);
  });
  c.drawImage(SPR.worker("down", 0), x + 17, y + 24);
  if (b.level >= 2) {
    // flower boxes under the windows
    for (const wx of [x + 4, x + 15, x + w - 23, x + w - 12]) {
      rect(c, wx, y + 26, 8, 2, "#8e5a30");
      for (let i = 0; i < 4; i++) px(c, wx + 1 + i * 2, y + 25, i % 2 ? "#f85868" : "#f8d030");
    }
  }
}

function wasserturm(c: Ctx, b: Building): void {
  const { x, y } = b;
  rect(c, x + 4, y + 49, 24, 2, SHADOW);
  // four steel legs with cross braces
  for (const lx of [x + 4, x + 11, x + 18, x + 25]) {
    rect(c, lx, y + 26, 2, 24, C.ink);
    rect(c, lx + 1, y + 26, 1, 24, C.metal);
  }
  for (let i = 0; i < 6; i++) {
    for (const [ax, bx] of [
      [x + 5, x + 12],
      [x + 19, x + 26],
    ]) {
      px(c, ax + i, y + 30 + i, C.metalLo);
      px(c, bx - i, y + 30 + i, C.metalLo);
      px(c, ax + i, y + 38 + i, C.metalLo);
      px(c, bx - i, y + 38 + i, C.metalLo);
    }
  }
  rect(c, x + 4, y + 36, 23, 1, C.metalLo);
  // ladder
  rect(c, x + 27, y + 24, 1, 26, C.ink);
  rect(c, x + 29, y + 24, 1, 26, C.ink);
  for (let ly = y + 25; ly < y + 50; ly += 2) px(c, x + 28, ly, C.metal);
  // the tank: a cylinder with rings, shaded round
  rect(c, x + 2, y + 9, 26, 19, C.ink);
  for (let i = 0; i < 24; i++) {
    const f = i / 23;
    const col = f < 0.15 ? "#c4d4e4" : f < 0.45 ? "#eef4fa" : f < 0.8 ? "#c4d4e4" : "#94a8c0";
    rect(c, x + 3 + i, y + 10, 1, 17, col);
  }
  rect(c, x + 3, y + 13, 24, 1, "#94a8c0");
  rect(c, x + 3, y + 23, 24, 1, "#94a8c0");
  // logo
  rect(c, x + 9, y + 15, 13, 7, C.orange);
  rect(c, x + 9, y + 15, 13, 1, C.orangeHi);
  text(c, "SF", x + 12, y + 16, C.white);
  // conical roof
  for (let r = 0; r < 7; r++) {
    const rw = 6 + r * 4;
    const rx = x + 15 - rw / 2;
    rect(c, rx, y + 2 + r, rw, 1, C.ink);
    if (rw > 2) {
      rect(c, rx + 1, y + 2 + r, rw - 2, 1, "#d05040");
      rect(c, rx + 1, y + 2 + r, Math.max(1, Math.floor((rw - 2) / 3)), 1, "#f07860");
    }
  }
  rect(c, x + 2, y + 9, 26, 1, C.ink);
  rect(c, x + 14, y, 2, 2, C.ink);
  if (b.level >= 2) {
    rect(c, x + 3, y + 24, 24, 2, C.orange);
    rect(c, x + 3, y + 24, 24, 1, C.orangeHi);
  }
  if (b.level >= 3) {
    rect(c, x + 22, y - 6, 1, 8, C.ink);
    rect(c, x + 23, y - 6, 5, 3, "#3a72e0");
    px(c, x + 24, y - 5, C.white);
  }
}

function parkhaus(c: Ctx, b: Building): void {
  const { x, y, w } = b;
  rect(c, x + 3, y + b.h - 1, w - 2, 2, SHADOW);
  // the roof deck with parked cars
  box(c, x, y, w, 23, CONCRETE);
  const slots = Math.floor((w - 4) / 14);
  for (let i = 0; i <= slots; i++) rect(c, x + 2 + i * 14, y + 3, 1, 17, C.white);
  for (let i = 0; i < slots; i++) if (i !== 2) c.drawImage(SPR.car((i * 3 + 1) % 10, i % 2 ? "down" : "up"), x + 4 + i * 14, y + 3);
  // open levels with car fronts: one more per expansion
  const decks = 1 + Math.min(3, b.level);
  for (let k = 0; k < decks; k++) {
    const ly = y + 23 + k * 10;
    box(c, x, ly, w, 4, CONCRETE);
    rect(c, x, ly + 4, w, 6, C.ink);
    rect(c, x + 1, ly + 4, w - 2, 6, "#2a2e38");
    for (let i = 0; i < 4; i++) {
      const cx = x + 5 + i * 14;
      if ((i + k) % 3 === 2) continue;
      const col = ["#e84038", "#3a72e0", "#e4e8ee", "#f4c430", "#3cae5a"][(i + k * 2) % 5];
      rect(c, cx, ly + 6, 9, 4, col);
      px(c, cx, ly + 7, C.headlight);
      px(c, cx + 8, ly + 7, C.headlight);
    }
    for (let i = x + 15; i < x + w - 4; i += 15) rect(c, i, ly + 4, 2, 6, CONCRETE.d);
  }
  box(c, x, y + 23 + decks * 10, w, 3, CONCRETE);
  // blue P sign
  rect(c, x + 2, y + 1, 9, 9, C.ink);
  rect(c, x + 3, y + 2, 7, 7, "#2c6ad8");
  text(c, "P", x + 5, y + 3, C.white);
  // entry barrier
  const by = y + 18 + decks * 10;
  rect(c, x + w - 13, by, 1, 5, C.ink);
  for (let i = 0; i < 10; i++) px(c, x + w - 12 + i, by, Math.floor(i / 2) % 2 ? C.white : C.red);
}

function ausbildung(c: Ctx, b: Building): void {
  const { x, y, w } = b;
  // from level 2 the building has a third floor
  const e = b.level >= 2 ? 9 : 0;
  // flat roof with skylights and the sign
  box(c, x, y, w, 14, FLAT_ROOF);
  for (const sx of [x + 6, x + 16, x + w - 22, x + w - 12]) {
    rect(c, sx, y + 2, 6, 4, C.ink);
    rect(c, sx + 1, y + 3, 4, 2, GLASS_HI);
  }
  // brick facade, rows of windows, a glass entrance under a canopy
  box(c, x, y + 13, w, 22 + e, BRICK);
  for (let ry = y + 16; ry < y + 34 + e; ry += 3) rect(c, x + 2, ry, w - 4, 1, BRICK.d);
  const rows = e ? [y + 16, y + 25, y + 34] : [y + 16, y + 25];
  for (const wy of rows) for (const wx of [x + 4, x + 14, x + w - 22, x + w - 12]) window(c, wx, wy, 8, 6);
  const ex = x + Math.floor(w / 2) - 7;
  rect(c, ex - 2, y + 20 + e, 18, 3, C.ink);
  rect(c, ex - 1, y + 21 + e, 16, 1, "#5e6778");
  rect(c, ex, y + 23 + e, 14, 12, C.ink);
  rect(c, ex + 1, y + 24 + e, 12, 11, GLASS);
  rect(c, ex + 7, y + 24 + e, 1, 11, C.ink);
  rect(c, ex + 1, y + 24 + e, 2, 4, GLASS_HI);
  plate(c, "AUSBILDUNG", x + w / 2, y + 7);
  // forecourt where the apprentices walk
  rect(c, x + 1, y + 35 + e, w - 2, 9, PAVE);
  for (let i = x + 1; i < x + w - 1; i += 6) rect(c, i, y + 35 + e, 1, 9, PAVE_LO);
  // flag
  rect(c, x + w - 3, y + 26 + e, 1, 18, C.ink);
  rect(c, x + w - 9, y + 26 + e, 6, 4, C.ink);
  rect(c, x + w - 8, y + 27 + e, 5, 2, "#3cae5a");
}

function solarpark(c: Ctx, b: Building): void {
  const { x, y, w, h } = b;
  // gravel bed and a low fence
  rect(c, x, y, w, h, "#b8b2a4");
  speckle(c, x + 1, y + 1, w - 2, h - 2, x + y * 3, "#a09a8c", "#ccc6b8", w);
  for (let i = x; i < x + w; i += 4) {
    px(c, i, y, C.metalLo);
    px(c, i, y + h - 1, C.metalLo);
  }
  for (let j = y; j < y + h; j += 4) {
    px(c, x, j, C.metalLo);
    px(c, x + w - 1, j, C.metalLo);
  }
  for (const p of solarPanels(b)) {
    rect(c, p.x + 1, p.y + p.h, p.w - 2, 2, SHADOW);
    rect(c, p.x, p.y, p.w, p.h, C.ink);
    rect(c, p.x + 1, p.y + 1, p.w - 2, p.h - 2, "#24448c");
    for (let i = p.x + 4; i < p.x + p.w - 1; i += 4) rect(c, i, p.y + 1, 1, p.h - 2, "#3a64b4");
    rect(c, p.x + 1, p.y + Math.floor(p.h / 2), p.w - 2, 1, "#3a64b4");
    rect(c, p.x + 1, p.y + 1, p.w - 2, 1, "#7aa8f0");
  }
}

function solarPanels(b: Building): { x: number; y: number; w: number; h: number }[] {
  const out = [];
  const pw = Math.floor((b.w - 8) / 3);
  const rows = 2 + Math.max(1, Math.min(3, b.level));
  for (let r = 0; r < rows; r++) for (let i = 0; i < 3; i++) out.push({ x: b.x + 3 + i * (pw + 1), y: b.y + 3 + r * 10, w: pw, h: 8 });
  return out;
}

function gleis(c: Ctx, b: Building): void {
  const { x, y, w } = b;
  rect(c, x, y + 4, w, 16, "#a09888");
  rect(c, x, y + 4, w, 1, "#857d70");
  rect(c, x, y + 19, w, 1, "#857d70");
  speckle(c, x, y + 5, w, 14, y, "#857d70", "#bcb4a6", w * 2);
  for (let i = x + 1; i < x + w; i += 4) rect(c, i, y + 6, 2, 12, "#7a5634");
  for (const ry of [y + 8, y + 15]) {
    rect(c, x, ry, w, 1, C.metalHi);
    rect(c, x, ry + 1, w, 1, C.metalLo);
  }
  // loading platform with the sign
  const pw = Math.min(70, w - 20);
  const px0 = x + Math.floor((w - pw) / 2);
  box(c, px0, y + 20, pw, 4, CONCRETE);
  // signal post on the left
  rect(c, x + 3, y, 1, 6, C.ink);
  rect(c, x + 1, y - 4, 5, 5, C.ink);
}

/** The stadium-shaped test track: outer and inner edge per row. */
function trackGeometry(b: Building) {
  const TW = 11;
  const R = Math.floor(b.h / 2) - 1;
  const cy = b.y + b.h / 2;
  const left = b.x + R;
  const right = b.x + b.w - R;
  return { TW, R, cy, left, right, Rc: R - TW / 2 };
}

function teststrecke(c: Ctx, b: Building): void {
  const { TW, R, cy, left, right } = trackGeometry(b);
  const Ri = R - TW;
  for (let yy = Math.floor(cy - R); yy < Math.ceil(cy + R); yy++) {
    const dy = yy + 0.5 - cy;
    if (Math.abs(dy) > R) continue;
    const ext = Math.sqrt(R * R - dy * dy);
    const l = Math.round(left - ext);
    const r = Math.round(right + ext);
    rect(c, l, yy, r - l, 1, "#5a5e6a");
    // red and white curbs on the outside
    for (const [cx, n] of [
      [l, 0],
      [r - 1, 1],
    ])
      px(c, cx, yy, Math.floor((yy + n) / 2) % 2 ? C.white : C.red);
    if (Math.abs(dy) < Ri) {
      const ei = Math.sqrt(Ri * Ri - dy * dy);
      const il = Math.round(left - ei);
      const ir = Math.round(right + ei);
      rect(c, il, yy, ir - il, 1, "#80cc60");
      px(c, il, yy, C.white);
      px(c, ir - 1, yy, C.white);
    }
  }
  const top = Math.floor(cy - R);
  const bottom = Math.ceil(cy + R) - 1;
  for (let xx = left; xx < right; xx++) {
    px(c, xx, top, Math.floor(xx / 2) % 2 ? C.white : C.red);
    px(c, xx, bottom, Math.floor(xx / 2) % 2 ? C.white : C.red);
  }
  // start and finish
  const sx = Math.round((left + right) / 2);
  for (let j = 1; j < TW; j++) {
    px(c, sx, top + j, j % 2 ? C.white : C.ink);
    px(c, sx + 1, top + j, j % 2 ? C.ink : C.white);
  }
  plate(c, "TESTSTRECKE", (left + right) / 2, cy - 4);
  if (b.level >= 3) {
    // grandstand in the infield
    const gx = Math.round((left + right) / 2) - 22;
    const gy = Math.round(cy + 7);
    rect(c, gx, gy, 44, 7, "#9aa4b2");
    rect(c, gx, gy + 2, 44, 1, "#7a8494");
    rect(c, gx, gy + 4, 44, 1, "#7a8494");
    for (let i = 0; i < 40; i++) px(c, gx + 1 + Math.floor(noise(i, gy, 71) * 42), gy + Math.floor(noise(i, gy, 72) * 3) * 2 + 1, ["#e84038", "#3a72e0", "#f4c430", "#f8f8f8"][i % 4]);
  }
}

function heliport(c: Ctx, b: Building): void {
  const { x, y, w, h } = b;
  rect(c, x + 3, y + h - 1, w - 2, 2, SHADOW);
  box(c, x, y, w, h - 1, CONCRETE);
  const cx = x + w / 2;
  const cy = y + (h - 1) / 2;
  for (let j = y + 2; j < y + h - 3; j++) {
    for (let i = x + 2; i < x + w - 2; i++) {
      const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy);
      if (Math.abs(d - 15) < 0.9) px(c, i, j, C.helmet);
    }
  }
  // the H
  rect(c, cx - 6, cy - 7, 3, 14, C.white);
  rect(c, cx + 3, cy - 7, 3, 14, C.white);
  rect(c, cx - 3, cy - 1, 6, 3, C.white);
  // windsock
  rect(c, x + w - 4, y + 2, 1, 7, C.ink);
  rect(c, x + w - 9, y + 2, 5, 2, C.orange);
  px(c, x + w - 7, y + 2, C.white);
  if (b.level >= 2) {
    // fuel truck
    rect(c, x + 3, y + h - 11, 12, 7, C.ink);
    rect(c, x + 4, y + h - 10, 7, 5, "#e4e8ee");
    rect(c, x + 11, y + h - 10, 3, 5, C.red);
  }
}

// --- yard pieces ---------------------------------------------------------------------

export function drawShed(c: Ctx, x: number, y: number, v: number): void {
  const { w, h } = SHED[Math.max(0, Math.min(2, v))];
  rect(c, x + 2, y + h - 1, w - 1, 2, SHADOW);
  const roofH = Math.floor(h * 0.45);
  box(c, x, y, w, roofH + 1, TAR);
  rect(c, x + 1, y + Math.floor(roofH / 2), w - 2, 1, TAR.l);
  const fy = y + roofH;
  const fh = h - roofH;
  box(c, x + 1, fy, w - 2, fh, WOOD);
  for (let i = x + 3; i < x + w - 2; i += 3) rect(c, i, fy + 1, 1, fh - 2, WOOD.d);
  // open door with tools hanging inside
  const dw = 6 + v * 2;
  const dx = x + Math.floor((w - dw) / 2);
  rect(c, dx, fy + 2, dw, fh - 2, C.ink);
  rect(c, dx + 1, fy + 3, dw - 2, fh - 3, "#3a2c22");
  px(c, dx + 2, fy + 4, C.metalHi);
  rect(c, dx + 2, fy + 5, 1, 2, "#a06a3c");
  rect(c, dx + dw - 3, fy + 4, 1, 3, C.metal);
  // a wrench painted on the roof
  const wx = x + Math.floor(w / 2) - 3;
  rect(c, wx, y + 2, 2, 2, C.white);
  rect(c, wx + 2, y + 3, 3, 1, C.white);
  px(c, wx + 5, y + 3, C.white);
  if (v >= 1) {
    // red tool cabinet
    rect(c, x + w - 6, fy + 1, 5, fh - 1, C.ink);
    rect(c, x + w - 5, fy + 2, 3, fh - 3, C.red);
    for (let j = fy + 4; j < y + h - 1; j += 2) rect(c, x + w - 5, j, 3, 1, C.redLo);
  }
  if (v >= 2) {
    // workbench with a vice
    rect(c, x + 1, fy + 3, 6, 3, C.ink);
    rect(c, x + 2, fy + 4, 4, 1, "#c08048");
    rect(c, x + 3, fy + 2, 2, 1, C.metalLo);
  }
}

export function drawClock(c: Ctx, x: number, y: number): void {
  rect(c, x + 4, y + 9, 1, 13, C.ink);
  rect(c, x + 3, y + 21, 3, 1, C.ink);
  for (let j = 0; j < 9; j++) {
    for (let i = 0; i < 9; i++) {
      const d = Math.hypot(i - 4, j - 4);
      if (d > 4.6) continue;
      px(c, x + i, y + j, d > 3.6 ? C.ink : C.white);
    }
  }
  for (const [i, j] of [
    [4, 1],
    [7, 4],
    [4, 7],
    [1, 4],
  ])
    px(c, x + i, y + j, C.metal);
}

/** Clock hands for the real time. */
export function drawClockHands(c: Ctx, x: number, y: number, now: Date): void {
  const hand = (frac: number, len: number, col: string) => {
    const a = frac * 2 * Math.PI;
    for (let k = 1; k <= len; k++) px(c, x + 4 + Math.round(k * Math.sin(a)), y + 4 - Math.round(k * Math.cos(a)), col);
  };
  hand(((now.getHours() % 12) + now.getMinutes() / 60) / 12, 2, C.ink);
  hand(now.getMinutes() / 60, 3, C.red);
  px(c, x + 4, y + 4, C.ink);
}

export function drawComboPress(c: Ctx, x: number, y: number, v: number, t: number): void {
  const frame = (t * 1.4 + 0.3) % 2 > 1.3 ? 1 : 0;
  c.drawImage(bigPress(frame, v >= 3 ? "gold" : "work"), x, y);
}

// --- moving parts ----------------------------------------------------------------------

export function animateBuilding(c: Ctx, b: Building, t: number): void {
  if (!b.built) return;
  if (b.level >= 4) goldFlag(c, b.w > 120 ? b.x + 2 : b.x + b.w - 6, b.y - 9, t);
  ANIMATE2[b.id]?.(c, b, t);
  switch (b.id) {
    case "kantine":
      steam(c, b.x + b.w - 8, b.y + 2, t);
      break;
    case "wasserturm":
      if (Math.floor(t * 1.2) % 2) px(c, b.x + 15, b.y, "#ff5040");
      break;
    case "solarpark":
      glint(c, b, t);
      break;
    case "bahn":
      train(c, b, t);
      break;
    case "teststrecke":
      raceCars(c, b, t);
      break;
    case "heliport":
      helicopter(c, b, t);
      break;
    default:
      break;
  }
}

function steam(c: Ctx, x: number, y: number, t: number): void {
  for (let i = 0; i < 2; i++) {
    const p = (t * 0.6 + i / 2) % 1;
    c.globalAlpha = 0.9 - p * 0.9;
    c.drawImage(SPR.puff(p > 0.5 ? 1 : 0), Math.round(x - 2 + Math.sin((t + i) * 2)), Math.round(y - 3 - p * 10));
  }
  c.globalAlpha = 1;
}

function glint(c: Ctx, b: Building, t: number): void {
  const sweep = ((t * 24) % (b.w + 60)) - 30;
  for (const p of solarPanels(b)) {
    for (let k = 0; k < 3; k++) {
      const gx = Math.round(b.x + sweep + (p.y - b.y) / 2 + k);
      if (gx < p.x + 1 || gx >= p.x + p.w - 2) continue;
      for (let j = 1; j < p.h - 1; j++) {
        const xx = gx - j + 1;
        if (xx >= p.x + 1 && xx < p.x + p.w - 1) px(c, xx, p.y + j, k === 1 ? "#ffffffc0" : "#ffffff60");
      }
    }
  }
}

const TRAIN_PERIOD = 28;
const TRAIN_SPEED = 30;
const LOCO_W = 28;
const WAGON_W = 26;
/** Car carriers behind the locomotive: three, five, seven. */
const wagons = (b: Building) => 1 + 2 * Math.max(1, Math.min(3, b.level));

/** Where the train's front is now, or null between trains. */
export function trainFront(b: Building, t: number): number | null {
  const len = LOCO_W + wagons(b) * WAGON_W;
  const p = (t + b.y * 0.13) % TRAIN_PERIOD;
  const front = b.x + p * TRAIN_SPEED;
  return front - len > b.x + b.w ? null : front;
}

function train(c: Ctx, b: Building, t: number): void {
  const front = trainFront(b, t);
  // the signal shows green while a train is on the track
  const sig = front !== null ? "#58e070" : "#ff5040";
  rect(c, b.x + 2, b.y - 3, 3, 3, sig);
  if (front === null) return;
  const y = b.y + 6;
  // locomotive, facing right
  const lx = Math.round(front - LOCO_W);
  rect(c, lx, y, LOCO_W, 12, C.ink);
  rect(c, lx + 1, y + 1, LOCO_W - 2, 10, "#d03830");
  rect(c, lx + 1, y + 1, LOCO_W - 2, 1, "#f07860");
  rect(c, lx + 1, y + 5, LOCO_W - 2, 2, C.helmet);
  rect(c, lx + LOCO_W - 8, y + 1, 5, 10, C.ink);
  rect(c, lx + LOCO_W - 7, y + 2, 3, 8, C.glass);
  px(c, lx + LOCO_W - 7, y + 2, C.glassHi);
  rect(c, lx + 4, y + 3, 6, 6, "#a02820");
  px(c, lx + LOCO_W - 1, y + 2, C.headlight);
  px(c, lx + LOCO_W - 1, y + 9, C.headlight);
  // car carriers with new cars
  for (let i = 0; i < wagons(b); i++) {
    const wx = lx - (i + 1) * WAGON_W;
    rect(c, wx + WAGON_W - 2, y + 5, 2, 2, C.ink);
    rect(c, wx, y + 1, WAGON_W - 2, 10, C.ink);
    rect(c, wx + 1, y + 2, WAGON_W - 4, 8, "#5e6778");
    rect(c, wx + 1, y + 2, WAGON_W - 4, 1, "#7e8796");
    c.drawImage(SPR.car((i * 4 + Math.floor(t / TRAIN_PERIOD)) % 10, "right"), wx + 4, y);
  }
}

/** Race cars on the test track: position on the centre line of the stadium. */
export function trackPoint(b: Building, s: number): { x: number; y: number; dx: number; dy: number } {
  const { cy, left, right, Rc } = trackGeometry(b);
  const L = right - left;
  const P = 2 * L + 2 * Math.PI * Rc;
  let d = ((s % P) + P) % P;
  if (d < L) return { x: left + d, y: cy - Rc, dx: 1, dy: 0 };
  d -= L;
  if (d < Math.PI * Rc) {
    const a = -Math.PI / 2 + d / Rc;
    return { x: right + Rc * Math.cos(a), y: cy + Rc * Math.sin(a), dx: -Math.sin(a), dy: Math.cos(a) };
  }
  d -= Math.PI * Rc;
  if (d < L) return { x: right - d, y: cy + Rc, dx: -1, dy: 0 };
  d -= L;
  const a = Math.PI / 2 + d / Rc;
  return { x: left + Rc * Math.cos(a), y: cy + Rc * Math.sin(a), dx: -Math.sin(a), dy: Math.cos(a) };
}

function raceCars(c: Ctx, b: Building, t: number): void {
  [
    { speed: 46, color: 0, off: 0 },
    { speed: 39, color: 1, off: 60 },
    { speed: 43, color: 6, off: 130 },
    { speed: 36, color: 5, off: 200 },
  ].slice(0, 1 + Math.max(1, Math.min(3, b.level))).forEach((car) => {
    const p = trackPoint(b, t * car.speed + car.off);
    const horizontal = Math.abs(p.dx) >= Math.abs(p.dy);
    const facing = horizontal ? (p.dx > 0 ? "right" : "left") : p.dy > 0 ? "down" : "up";
    const spr = SPR.car(car.color, facing);
    c.drawImage(spr, Math.round(p.x - spr.width / 2), Math.round(p.y - spr.height / 2));
  });
}

const HELI_PERIOD = 40;

function helicopter(c: Ctx, b: Building, t: number): void {
  const cx = Math.round(b.x + b.w / 2);
  let cy = Math.round(b.y + (b.h - 1) / 2);
  if (b.level >= 3) {
    // takes off now and then, flies off and comes back
    const p = (t + b.x * 0.13) % HELI_PERIOD;
    if (p > 34 && p < 37) return;
    const up = p >= 28 && p <= 34 ? (p - 28) * 6 : p >= 37 ? (40 - p) * 12 : 0;
    if (up > 0) {
      c.globalAlpha = 0.25;
      rect(c, cx - 4, cy - 6, 8, 12, "#000000");
      c.globalAlpha = 1;
      cy -= Math.round(up);
    }
  }
  // corner lights
  if (Math.floor(t * 1.5) % 2) for (const [lx, ly] of [
    [b.x + 2, b.y + 2],
    [b.x + b.w - 3, b.y + 2],
    [b.x + 2, b.y + b.h - 4],
    [b.x + b.w - 3, b.y + b.h - 4],
  ])
    px(c, lx, ly, "#58e070");
  // tail boom and fin
  rect(c, cx - 1, cy + 4, 2, 12, C.ink);
  rect(c, cx, cy + 4, 1, 11, C.goldLo);
  rect(c, cx - 3, cy + 14, 6, 2, C.ink);
  rect(c, cx - 2, cy + 14, 4, 1, C.gold);
  // body, cockpit at the front (up)
  rect(c, cx - 4, cy - 7, 8, 12, C.ink);
  rect(c, cx - 3, cy - 6, 6, 10, C.gold);
  rect(c, cx - 3, cy - 6, 2, 10, C.goldHi);
  rect(c, cx - 2, cy - 6, 4, 3, C.glass);
  px(c, cx - 2, cy - 6, C.glassHi);
  // main rotor, two blades turning
  const f = Math.floor(t * 10) % 3;
  c.fillStyle = "#283040d0";
  if (f === 0) {
    rect(c, cx - 13, cy - 1, 26, 1, "#283040c0");
    rect(c, cx, cy - 14, 1, 26, "#283040c0");
  } else {
    const sign = f === 1 ? 1 : -1;
    for (let k = -9; k <= 9; k++) {
      px(c, cx + k, cy - 1 + k * sign * 0.5, "#283040c0");
      px(c, cx + k * 0.5 * sign, cy - 1 - k, "#283040c0");
    }
  }
  rect(c, cx - 1, cy - 2, 2, 2, C.ink);
}

// --- night ---------------------------------------------------------------------------------

/** Lit windows and lights after the night tint. */
export function buildingLights(c: Ctx, b: Building, t: number): void {
  if (!b.built) return;
  lights2(c, b, t);
  const { x, y, w } = b;
  const lit = (wx: number, wy: number, ww: number, wh: number) => {
    rect(c, wx + 1, wy + 1, ww - 2, wh - 2, LIT);
    rect(c, wx + 1, wy + wh - 2, ww - 2, 1, LIT_LO);
  };
  switch (b.id) {
    // (lights are drawn over everything, so none where someone stands in front)
    case "kantine":
      for (const wx of [x + 4, x + w - 23, x + w - 12]) lit(wx, y + 19, 8, 7);
      break;
    case "ausbildung":
      for (const wx of [x + 4, x + 14, x + w - 22, x + w - 12]) if (wx % 3) lit(wx, y + 16, 8, 6);
      break;
    case "parkhaus":
      for (let k = 0; k < 2; k++) rect(c, x + 1, y + 27 + k * 10, w - 2, 1, "#fff0b0a0");
      break;
    case "wasserturm":
      if (Math.floor(t * 1.2) % 2) px(c, x + 15, y, "#ff7060");
      break;
    case "heliport":
      if (Math.floor(t * 1.5) % 2) for (const [lx, ly] of [
        [x + 2, y + 2],
        [x + w - 3, y + 2],
        [x + 2, y + b.h - 4],
        [x + w - 3, y + b.h - 4],
      ])
        px(c, lx, ly, "#80ff90");
      break;
    case "bahn": {
      const front = trainFront(b, t);
      if (front !== null) {
        px(c, Math.round(front) - 1, y + 8, C.headlight);
        px(c, Math.round(front) - 1, y + 15, C.headlight);
      }
      break;
    }
    default:
      break;
  }
}
