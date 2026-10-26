import { BRICK, CONCRETE, FLAT_ROOF, GLASS, GLASS_HI, kid, LIT, PAVE, PAVE_LO, plate, player, SHADOW, speckle } from "./campusKit";
import type { Building } from "./layout";
import { box, noise, px, rect, type Ctx, type Shade } from "./paint";
import { C, SPR, type Facing } from "./sprites";
import { text } from "./font";

/*
 * The buildings added for the second year: filling station, daycare, sports ground,
 * fire station, showroom, wind farm, research centre, high-bay warehouse, data centre,
 * harbour, airfield and rocket launch pad. Static parts in draw*, moving parts in
 * animate*, lit windows in lights*. Levels 2 and 3 add visible pieces.
 */

const WHITE: Shade = { o: C.ink, l: "#ffffff", m: "#eef2f6", d: "#c8d0da" };
const DARK: Shade = { o: C.ink, l: "#6a7484", m: "#525a68", d: "#3c424e" };
const STEEL: Shade = { o: C.ink, l: C.metalHi, m: C.metal, d: C.metalLo };
const SAND = "#e8d098";
const WATER = "#3a7cc8";
const WATER_HI = "#7ab0ea";

// --- filling station ---------------------------------------------------------------------

function pump(c: Ctx, x: number, y: number): void {
  rect(c, x, y, 5, 8, C.ink);
  rect(c, x + 1, y + 1, 3, 6, C.white);
  rect(c, x + 1, y + 1, 3, 2, "#2c3c58");
  rect(c, x + 1, y + 5, 3, 1, C.red);
}

export function drawTankstelle(c: Ctx, b: Building): void {
  const { x, y, w, h, level } = b;
  rect(c, x, y + 8, w, h - 8, "#c8ccd2");
  speckle(c, x + 1, y + 9, w - 2, h - 10, x + y, "#b0b6be", "#d8dce2", 40);
  for (const [ox, oy] of [
    [9, 30],
    [27, 33],
  ])
    rect(c, x + ox, y + oy, 3, 1, "#8a9098");
  // pump island and a car filling up
  pump(c, x + 4, y + 15);
  pump(c, x + 27, y + 15);
  c.drawImage(SPR.car(1, "up"), x + 12, y + 17);
  // canopy, seen from above, with the brand band
  rect(c, x + 3, y + 13, 1, 4, C.ink);
  rect(c, x + 31, y + 13, 1, 4, C.ink);
  box(c, x + 1, y, 33, 13, WHITE);
  rect(c, x + 2, y + 6, 31, 6, C.red);
  rect(c, x + 2, y + 6, 31, 1, "#ff8a78");
  text(c, "TANKE", x + 8, y + 7, C.white);
  if (level >= 2) {
    // two chargers and an electric car
    for (const cx of [x + 39, x + 51]) {
      rect(c, cx, y + 10, 3, 9, C.ink);
      rect(c, cx + 1, y + 11, 1, 7, "#3cae5a");
    }
    c.drawImage(SPR.car(5, "up"), x + 42, y + 18);
  }
  if (level >= 3) {
    box(c, x + 37, y, 19, 9, { o: C.ink, l: "#7fd4a8", m: "#3c9a72", d: "#26684c" });
    text(c, "SHOP", x + 40, y + 2, C.white);
  }
}

function animateTankstelle(c: Ctx, b: Building, t: number): void {
  if (b.level >= 2 && Math.floor(t * 1.5) % 2) {
    px(c, b.x + 40, b.y + 12, "#a0ff90");
    px(c, b.x + 52, b.y + 12, "#a0ff90");
  }
}

// --- company daycare ---------------------------------------------------------------------

export function drawKita(c: Ctx, b: Building): void {
  const { x, y, h, level } = b;
  // the house: red roof, yellow walls, coloured windows
  box(c, x, y, 31, 13, { o: C.ink, l: "#f07860", m: "#d05040", d: "#a03830" });
  for (let ry = y + 3; ry < y + 12; ry += 3) rect(c, x + 1, ry, 29, 1, "#a03830");
  box(c, x + 1, y + 12, 29, 17, { o: C.ink, l: "#fff8c0", m: "#f6e27a", d: "#d4b64c" });
  for (const [wx, col] of [
    [x + 4, "#3a72e0"],
    [x + 21, "#3cae5a"],
  ] as const) {
    rect(c, wx, y + 15, 7, 7, col);
    rect(c, wx + 1, y + 16, 5, 5, GLASS);
    px(c, wx + 2, y + 17, GLASS_HI);
  }
  rect(c, x + 13, y + 19, 6, 10, C.ink);
  rect(c, x + 14, y + 20, 4, 9, "#e84038");
  plate(c, "KITA", x + 15, y + 7);
  // playground with a fence
  const px0 = x + 33;
  rect(c, px0, y + 4, b.w - 33, h - 4, SAND);
  speckle(c, px0, y + 5, b.w - 34, h - 6, x * 3 + y, "#d4b878", "#f4e0b0", 30);
  const fence = ["#e84038", "#f4c430", "#3a72e0"];
  for (let i = px0; i < x + b.w; i += 2) {
    px(c, i, y + 4, fence[(i >> 1) % 3]);
    px(c, i, y + h - 1, fence[(i >> 1) % 3]);
  }
  // swing frame
  rect(c, px0 + 3, y + 8, 1, 14, "#8e5a30");
  rect(c, px0 + 16, y + 8, 1, 14, "#8e5a30");
  rect(c, px0 + 3, y + 8, 14, 1, "#8e5a30");
  // sandbox with a bucket
  rect(c, px0 + 2, y + 27, 12, 9, "#8e5a30");
  rect(c, px0 + 3, y + 28, 10, 7, "#f4e0b0");
  rect(c, px0 + 9, y + 30, 2, 2, C.red);
  if (level >= 2) {
    // slide
    rect(c, px0 + 20, y + 14, 1, 12, C.metalLo);
    for (let i = 0; i < 6; i++) rect(c, px0 + 20 - 0 + i, y + 26 - i * 2, 2, 1, "#3a72e0");
  }
  if (level >= 3) c.drawImage(SPR.smallTree(), x - 2, y + h - 16);
}

function animateKita(c: Ctx, b: Building, t: number): void {
  const px0 = b.x + 33;
  const swing = Math.round(Math.sin(t * 2.4) * 3);
  rect(c, px0 + 9 + Math.round(swing / 2), b.y + 9, 1, 8, C.ink);
  kid(c, px0 + 7 + swing, b.y + 13, "#f07a1c", C.hair, 0);
  if (b.level >= 2) kid(c, px0 + 19, b.y + 8 + (Math.floor(t * 0.7) % 6) * 3, "#9a50d0", "#2c2c34", Math.floor(t * 4) % 2);
  if (b.level >= 3) {
    const k = (t * 8) % (b.w - 40);
    kid(c, px0 + 2 + Math.round(k), b.y + 22, "#3cae5a", "#c88a00", Math.floor(t * 6) % 2);
  }
}

// --- sports ground -----------------------------------------------------------------------

export function drawSportplatz(c: Ctx, b: Building): void {
  const { x, y, w, level } = b;
  const top = y + 8;
  const ph = b.h - 8;
  for (let i = 0; i < w; i += 6) rect(c, x + i, top, Math.min(6, w - i), ph, (i / 6) % 2 ? "#5aa848" : "#6cbc50");
  const line = "#f4f8f0";
  rect(c, x + 2, top + 2, w - 4, 1, line);
  rect(c, x + 2, top + ph - 3, w - 4, 1, line);
  rect(c, x + 2, top + 2, 1, ph - 4, line);
  rect(c, x + w - 3, top + 2, 1, ph - 4, line);
  rect(c, x + w / 2, top + 2, 1, ph - 4, line);
  const cx = x + w / 2 + 0.5;
  const cy = top + ph / 2;
  for (let a = 0; a < 32; a++) px(c, Math.round(cx + Math.cos(a / 5.1) * 6), Math.round(cy + Math.sin(a / 5.1) * 6), line);
  for (const side of [0, 1]) {
    const bx = side ? x + w - 11 : x + 2;
    rect(c, bx, cy - 7, 9, 1, line);
    rect(c, bx, cy + 7, 9, 1, line);
    rect(c, side ? bx : bx + 8, cy - 7, 1, 15, line);
    // goal
    rect(c, side ? x + w - 3 : x, cy - 4, 3, 9, C.white);
    rect(c, side ? x + w - 2 : x + 1, cy - 3, 1, 7, "#c8d0da");
  }
  if (level >= 2) {
    // stands with spectators
    rect(c, x + 6, y, w - 12, 8, "#9aa4b2");
    for (let r = 0; r < 3; r++) rect(c, x + 6, y + 1 + r * 2, w - 12, 1, "#7a8494");
    for (let i = 0; i < (w - 14) * 1.2; i++) {
      const sx = x + 7 + Math.floor(noise(i, y, 51) * (w - 14));
      const sy = y + Math.floor(noise(i, y, 52) * 3) * 2 + 1;
      px(c, sx, sy, ["#e84038", "#3a72e0", "#f4c430", "#f8f8f8", "#3cae5a"][Math.floor(noise(i, y, 53) * 5)]);
    }
  } else {
    rect(c, x + w / 2 - 8, y + 3, 16, 3, "#8e5a30");
  }
  if (level >= 3) {
    // floodlights in the corners and a scoreboard
    for (const fx of [x, x + w - 2]) {
      rect(c, fx, y - 6, 2, 14, C.metalLo);
      rect(c, fx - 1, y - 8, 4, 3, C.ink);
      rect(c, fx, y - 7, 2, 1, "#fff6c8");
    }
    rect(c, x + w / 2 - 9, y - 6, 18, 7, C.ink);
    text(c, "2:1", x + w / 2 - 5, y - 5, "#ffd040");
  }
}

function animateSportplatz(c: Ctx, b: Building, t: number): void {
  const top = b.y + 10;
  const ph = b.h - 12;
  const cols = ["#e84038", "#e84038", "#e84038", "#3a72e0", "#3a72e0", "#3a72e0"];
  let bx = 0;
  let by = 0;
  cols.forEach((col, i) => {
    const px0 = b.x + 6 + ((Math.sin(t * (0.5 + i * 0.13) + i * 2.1) + 1) / 2) * (b.w - 14);
    const py0 = top + ((Math.sin(t * (0.7 + i * 0.11) + i) + 1) / 2) * (ph - 6);
    player(c, Math.round(px0), Math.round(py0), col, Math.floor(t * 6 + i) % 2);
    if (i === Math.floor(t / 2) % 6) {
      bx = px0 + 3;
      by = py0 + 4;
    }
  });
  px(c, Math.round(bx), Math.round(by), C.white);
}

// --- fire station ------------------------------------------------------------------------

function fireTruck(c: Ctx, x: number, y: number): void {
  rect(c, x, y, 14, 11, C.ink);
  rect(c, x + 1, y + 1, 12, 9, "#e84038");
  rect(c, x + 1, y + 1, 12, 1, "#ff8a78");
  rect(c, x + 2, y + 2, 10, 3, C.glass);
  px(c, x + 3, y + 2, C.glassHi);
  rect(c, x + 1, y + 6, 12, 1, C.white);
  px(c, x + 2, y + 8, C.headlight);
  px(c, x + 11, y + 8, C.headlight);
}

export function drawFeuerwache(c: Ctx, b: Building): void {
  const { x, y, h, level } = b;
  const bw = 46;
  rect(c, x + 2, y + 28, bw - 2, 2, SHADOW);
  box(c, x, y, bw, 11, FLAT_ROOF);
  box(c, x, y + 10, bw, 18, BRICK);
  for (let ry = y + 13; ry < y + 27; ry += 3) rect(c, x + 2, ry, bw - 4, 1, BRICK.d);
  plate(c, "FEUERWEHR", x + bw / 2, y + 5);
  for (let d = 0; d < 2; d++) {
    const dx = x + 4 + d * 21;
    rect(c, dx, y + 14, 17, 14, C.ink);
    if (d === 0 || level >= 2) {
      rect(c, dx + 1, y + 15, 15, 13, "#2a2e38");
      fireTruck(c, dx + 2, y + 16);
    } else {
      rect(c, dx + 1, y + 15, 15, 13, C.metal);
      for (let ry = y + 17; ry < y + 28; ry += 2) rect(c, dx + 1, ry, 15, 1, C.metalLo);
    }
  }
  // apron with hatching in front of the doors
  rect(c, x, y + 28, bw, h - 28, "#c8ccd2");
  for (let i = 0; i < bw; i += 4) rect(c, x + i, y + 29, 2, 2, i % 8 ? C.white : C.red);
  if (level >= 3) {
    // training tower
    const tx = x + bw + 2;
    box(c, tx, y, 10, h - 2, BRICK);
    for (let wy = y + 4; wy < y + h - 8; wy += 7) {
      rect(c, tx + 3, wy, 4, 4, C.ink);
      rect(c, tx + 4, wy + 1, 2, 2, GLASS);
    }
    rect(c, tx + 5, y - 6, 1, 7, C.ink);
    rect(c, tx + 6, y - 6, 4, 3, C.red);
  }
}

function animateFeuerwache(c: Ctx, b: Building, t: number): void {
  if (Math.floor(t * 4) % 4 !== 0) return;
  const trucks = b.level >= 2 ? 2 : 1;
  for (let d = 0; d < trucks; d++) {
    const dx = b.x + 6 + d * 21;
    px(c, dx + 2, b.y + 16, "#58a8ff");
    px(c, dx + 11, b.y + 16, "#58a8ff");
  }
}

// --- showroom -----------------------------------------------------------------------------

const TURN: Facing[] = ["up", "right", "down", "left"];

export function drawAutohaus(c: Ctx, b: Building): void {
  const { x, y, w, level } = b;
  box(c, x, y, w, 9, WHITE);
  rect(c, x + 1, y + 9, w - 2, 23, C.ink);
  rect(c, x + 2, y + 10, w - 4, 21, "#a8d8f0");
  rect(c, x + 2, y + 24, w - 4, 7, "#d8dee6");
  for (let i = x + 2; i < x + w - 2; i += 12) rect(c, i, y + 10, 1, 21, C.white);
  rect(c, x + 2, y + 10, w - 4, 1, "#e8f6ff");
  plate(c, "AUTOHAUS", x + w / 2, y + 3);
  // turntable
  for (let j = -2; j <= 2; j++) {
    const half = Math.round(10 * Math.sqrt(1 - (j * j) / 6.25));
    rect(c, x + w / 2 - half, y + 27 + j, half * 2, 1, j === 2 ? "#8a9098" : "#b0b8c2");
  }
  // forecourt with flags
  rect(c, x, y + 32, w, b.h - 32, PAVE);
  for (let i = x; i < x + w; i += 6) rect(c, i, y + 32, 1, b.h - 32, PAVE_LO);
  for (const fx of [x + 4, x + 10, x + 16]) rect(c, fx, y + 27, 1, 11, C.ink);
  if (level >= 2) c.drawImage(SPR.car(2, "right"), x + w - 22, y + 28);
  if (level >= 3) {
    rect(c, x + w - 4, y - 8, 2, 40, C.metalLo);
    rect(c, x + w - 7, y - 10, 8, 8, C.ink);
    rect(c, x + w - 6, y - 9, 6, 6, C.gold);
    text(c, "SF", x + w - 6, y - 9, C.ink);
  }
}

function animateAutohaus(c: Ctx, b: Building, t: number): void {
  const facing = TURN[Math.floor(t / 0.7) % 4];
  const spr = SPR.car(6, facing);
  c.drawImage(spr, Math.round(b.x + b.w / 2 - spr.width / 2), Math.round(b.y + 25 - spr.height / 2));
  const wave = Math.floor(t * 3) % 2;
  ["#e84038", "#3a72e0", "#f4c430"].forEach((col, i) => {
    const fx = b.x + 5 + i * 6;
    rect(c, fx, b.y + 27, 4 - wave, 2, col);
    px(c, fx, b.y + 29, col);
  });
}

// --- wind farm ------------------------------------------------------------------------------

function turbineSpots(b: Building): { x: number; hub: number }[] {
  const spots = [
    [{ x: 0.5, hub: 12 }],
    [
      { x: 0.27, hub: 16 },
      { x: 0.73, hub: 10 },
    ],
    [
      { x: 0.18, hub: 16 },
      { x: 0.5, hub: 9 },
      { x: 0.82, hub: 14 },
    ],
  ][Math.max(0, Math.min(3, b.level) - 1)];
  return spots.map((s) => ({ x: Math.round(b.x + s.x * b.w), hub: b.y + s.hub }));
}

export function drawWindpark(c: Ctx, b: Building): void {
  for (const s of turbineSpots(b)) {
    const base = b.y + b.h - 3;
    rect(c, s.x - 3, base, 7, 3, "#a4aab4");
    rect(c, s.x - 1, base - 1, 3, 1, SHADOW);
    for (let yy = s.hub; yy < base; yy++) {
      const wdt = yy > base - 12 ? 3 : 2;
      rect(c, s.x - 1, yy, wdt, 1, C.white);
      px(c, s.x - 1 + wdt, yy, "#c8d0da");
    }
  }
}

function animateWindpark(c: Ctx, b: Building, t: number): void {
  turbineSpots(b).forEach((s, i) => {
    const a = t * 2.2 + i * 1.3;
    for (let k = 0; k < 3; k++) {
      const ang = a + (k * 2 * Math.PI) / 3;
      for (let r = 2; r <= 12; r++) {
        px(c, Math.round(s.x + Math.cos(ang) * r), Math.round(s.hub + Math.sin(ang) * r), r > 9 ? "#c8d0da" : C.white);
      }
    }
    rect(c, s.x - 1, s.hub - 1, 3, 3, C.metalLo);
    px(c, s.x, s.hub, C.ink);
  });
}

// --- research centre -----------------------------------------------------------------------

export function drawForschung(c: Ctx, b: Building): void {
  const { x, y, w, h, level } = b;
  box(c, x, y, w, 12, FLAT_ROOF);
  box(c, x, y + 11, w, 25, WHITE);
  for (const by of [y + 15, y + 24]) {
    rect(c, x + 3, by, w - 6, 5, C.ink);
    rect(c, x + 4, by + 1, w - 8, 3, "#3a80cc");
    for (let i = x + 4; i < x + w - 4; i += 7) px(c, i + 1, by + 1, "#9ad0ff");
  }
  rect(c, x + w / 2 - 5, y + 30, 10, 6, C.ink);
  rect(c, x + w / 2 - 4, y + 31, 8, 5, C.glass);
  plate(c, "FORSCHUNG", x + w / 2, y + 6);
  rect(c, x, y + 36, w, h - 36, PAVE);
  for (let i = x; i < x + w; i += 6) rect(c, i, y + 36, 1, h - 36, PAVE_LO);
  // dish pedestals on the roof
  rect(c, x + w - 6, y + 2, 2, 4, C.metalLo);
  if (level >= 2) rect(c, x + 5, y + 2, 2, 4, C.metalLo);
  if (level >= 3) rect(c, x + w / 2, y - 9, 1, 10, C.ink);
}

function dish(c: Ctx, cx: number, top: number, t: number): void {
  const half = Math.max(1, Math.round(5 * Math.abs(Math.cos(t))));
  rect(c, cx - half, top, half * 2, 1, C.ink);
  rect(c, cx - half + 1, top + 1, Math.max(1, half * 2 - 2), 2, C.white);
  rect(c, cx - half, top + 3, half * 2, 1, "#c8d0da");
  px(c, cx, top - 1, C.metalLo);
}

function animateForschung(c: Ctx, b: Building, t: number): void {
  dish(c, b.x + b.w - 5, b.y - 2, t * 0.8);
  if (b.level >= 2) dish(c, b.x + 6, b.y - 2, t * 0.6 + 1.7);
  if (b.level >= 3 && Math.floor(t * 1.4) % 2) px(c, b.x + b.w / 2, b.y - 10, "#ff5040");
}

// --- high-bay warehouse ------------------------------------------------------------------

export function drawHochregal(c: Ctx, b: Building): void {
  const { x, y, w, h, level } = b;
  const facade: Shade = { o: C.ink, l: "#d8e4f0", m: "#b8c8d8", d: "#8898aa" };
  rect(c, x + 3, y + h - 7, w - 2, 2, SHADOW);
  box(c, x, y, w, 8, FLAT_ROOF);
  box(c, x, y + 7, w, h - 14, facade);
  for (let i = x + 3; i < x + w - 2; i += 4) rect(c, i, y + 8, 1, h - 16, facade.d);
  rect(c, x + 3, y + 10, 12, 7, C.orange);
  text(c, "SF", x + 5, y + 11, C.white);
  const strips = level >= 3 ? [x + 30, x + 16] : [x + 30];
  for (const sx of strips) {
    rect(c, sx, y + 9, 10, h - 19, C.ink);
    rect(c, sx + 1, y + 10, 8, h - 21, "#2c3c58");
    for (let ry = y + 13; ry < y + h - 11; ry += 4) rect(c, sx + 1, ry, 8, 1, "#5e6778");
  }
  // loading dock
  rect(c, x, y + h - 7, w, 7, "#c8ccd2");
  for (const dx of [x + 6, x + 24]) {
    rect(c, dx, y + h - 9, 12, 4, C.ink);
    rect(c, dx - 1, y + h - 5, 1, 2, C.helmet);
    rect(c, dx + 12, y + h - 5, 1, 2, C.helmet);
  }
  if (level >= 2) {
    rect(c, x + w - 2, y + 20, 8, 3, C.ink);
    rect(c, x + w - 2, y + 21, 8, 1, C.metal);
  }
}

function animateHochregal(c: Ctx, b: Building, t: number): void {
  const strips = b.level >= 3 ? [b.x + 30, b.x + 16] : [b.x + 30];
  strips.forEach((sx, i) => {
    const span = b.h - 26;
    const p = (Math.sin(t * 0.9 + i * 2) + 1) / 2;
    const cy = b.y + 11 + Math.round(p * span);
    rect(c, sx + 2, cy, 6, 3, C.helmet);
    rect(c, sx + 3, cy + 1, 4, 1, C.orange);
  });
  if (b.level >= 2) {
    const off = Math.floor(t * 6) % 4;
    for (let i = 0; i < 2; i++) rect(c, b.x + b.w - 1 + i * 4 + off, b.y + 19, 2, 2, "#c08048");
  }
}

// --- data centre ---------------------------------------------------------------------------

export function drawRechenzentrum(c: Ctx, b: Building): void {
  const { x, y, w, h, level } = b;
  box(c, x, y, w, 12, DARK);
  plate(c, "SERVER", x + w / 2, y + 6);
  if (level < 2) {
    rect(c, x + 4, y + 2, 8, 4, C.metal);
    rect(c, x + w - 12, y + 2, 8, 4, C.metal);
  }
  box(c, x, y + 11, w, 20, { o: C.ink, l: "#5a6270", m: "#454c58", d: "#30353e" });
  rect(c, x + 3, y + 14, w - 6, 14, C.ink);
  rect(c, x + 4, y + 15, w - 8, 12, "#141820");
  for (let i = x + 5; i < x + w - 5; i += 6) rect(c, i, y + 15, 1, 12, "#30353e");
  rect(c, x, y + 31, w, h - 31, "#c8ccd2");
  box(c, x + w - 12, y + 31, 9, 6, STEEL);
  if (level >= 3) {
    rect(c, x + 2, y - 7, 9, 10, C.ink);
    rect(c, x + 3, y - 6, 7, 8, "#d4d9e0");
    rect(c, x + 3, y - 6, 2, 8, "#eef2f6");
  }
}

function animateRechenzentrum(c: Ctx, b: Building, t: number): void {
  const k = Math.floor(t * 5);
  for (let i = 0; i < (b.w - 10) / 2; i++) {
    for (let r = 0; r < 4; r++) {
      if (noise(i, r, k % 7) < 0.55) continue;
      const col = noise(i, r, 3) < 0.6 ? "#58e070" : noise(i, r, 4) < 0.5 ? "#58a8ff" : "#ffb040";
      px(c, b.x + 6 + i * 2 + (r % 2), b.y + 16 + r * 3, col);
    }
  }
  if (b.level >= 2) {
    // cooling fans on the roof
    for (const fx of [b.x + 8, b.x + b.w - 8]) {
      rect(c, fx - 3, b.y + 1, 7, 5, C.ink);
      rect(c, fx - 2, b.y + 2, 5, 3, C.metal);
      const f = Math.floor(t * 10) % 2;
      rect(c, fx - (f ? 2 : 0), b.y + 3, f ? 5 : 1, 1, C.metalLo);
      rect(c, fx, b.y + (f ? 3 : 2), 1, f ? 1 : 3, C.metalLo);
    }
  }
  if (b.level >= 3) {
    for (let i = 0; i < 2; i++) {
      const p = (t * 0.5 + i / 2) % 1;
      c.globalAlpha = 0.8 - p * 0.8;
      c.drawImage(SPR.puff(p > 0.5 ? 1 : 0), b.x + 4 + Math.round(Math.sin(t + i) * 1.5), Math.round(b.y - 10 - p * 10));
    }
    c.globalAlpha = 1;
  }
}

// --- harbour (full width) -----------------------------------------------------------------

export function drawHafen(c: Ctx, b: Building): void {
  const { x, y, w, h, level } = b;
  box(c, x, y, w, 9, CONCRETE);
  rect(c, x, y + 8, w, 1, C.helmet);
  for (let i = x + 6; i < x + w - 4; i += 14) rect(c, i, y + 5, 2, 2, C.ink);
  rect(c, x, y + 9, w, h - 9, WATER);
  if (level >= 2) {
    // gantry crane on the quay
    const gx = x + w - 44;
    rect(c, gx, y - 10, 2, 18, C.helmetLo);
    rect(c, gx + 24, y - 10, 2, 18, C.helmetLo);
    rect(c, gx - 4, y - 12, 34, 3, C.ink);
    rect(c, gx - 3, y - 11, 32, 1, C.helmet);
  }
  if (level >= 3) {
    // lighthouse at the harbour mouth
    const lx = x + 4;
    for (let yy = y - 14; yy < y + 6; yy++) rect(c, lx, yy, 6, 1, Math.floor((yy - y) / 3) % 2 ? C.white : C.red);
    rect(c, lx - 1, y - 17, 8, 3, C.ink);
    rect(c, lx + 1, y - 16, 4, 1, "#fff6a8");
  }
}

const SHIP_PERIOD = 36;

function ship(c: Ctx, x: number, y: number, seed: number): void {
  const L = 72;
  rect(c, x, y, L, 14, C.ink);
  rect(c, x + 1, y + 1, L - 2, 12, "#2c3c58");
  rect(c, x + 1, y + 10, L - 2, 3, "#a82820");
  // the bow points left
  rect(c, x - 3, y + 3, 3, 8, C.ink);
  rect(c, x - 2, y + 4, 2, 6, "#2c3c58");
  // cars on deck
  for (let i = 0; i < 12; i++) {
    for (let r = 0; r < 2; r++) {
      const col = ["#e84038", "#3a72e0", "#f8f8f8", "#f4c430", "#3cae5a", "#43465a"][Math.floor(noise(i, r, seed) * 6)];
      rect(c, x + 3 + i * 4, y + 2 + r * 4, 3, 3, col);
    }
  }
  // bridge at the stern
  rect(c, x + L - 18, y - 4, 14, 14, C.ink);
  rect(c, x + L - 17, y - 3, 12, 12, C.white);
  rect(c, x + L - 16, y - 1, 10, 2, "#2c3c58");
  rect(c, x + L - 10, y - 8, 3, 5, C.ink);
  rect(c, x + L - 9, y - 7, 1, 3, C.red);
}

function animateHafen(c: Ctx, b: Building, t: number): void {
  // waves
  const off = Math.floor(t * 4) % 8;
  for (let yy = b.y + 12; yy < b.y + b.h - 1; yy += 5) {
    for (let xx = b.x + ((yy / 5) % 2 ? 4 : 0) + off; xx < b.x + b.w - 3; xx += 8) rect(c, xx, yy, 3, 1, WATER_HI);
  }
  const p = (t + b.y * 0.07) % SHIP_PERIOD;
  const travel = b.w + 100;
  const sx = b.x + b.w + 10 - (p / (SHIP_PERIOD * 0.6)) * travel;
  if (sx > b.x - 90) ship(c, Math.round(sx), b.y + 13, Math.floor((t + b.y * 0.07) / SHIP_PERIOD));
  if (b.level >= 2) {
    const tx = b.x + b.w - 44 + Math.round(((Math.sin(t * 0.6) + 1) / 2) * 20);
    rect(c, tx, b.y - 9, 4, 2, C.ink);
    rect(c, tx + 1, b.y - 7, 1, 8, C.ink);
    rect(c, tx - 1, b.y + 1, 4, 3, "#c84838");
  }
  if (b.level >= 3) {
    // a tug bobbing by the quay
    const bob = Math.floor(t * 2) % 2;
    rect(c, b.x + 16, b.y + 12 + bob, 14, 6, C.ink);
    rect(c, b.x + 17, b.y + 13 + bob, 12, 4, "#f07a1c");
    rect(c, b.x + 20, b.y + 10 + bob, 5, 3, C.white);
  }
}

// --- airfield (full width) ------------------------------------------------------------------

export function drawFlugplatz(c: Ctx, b: Building): void {
  const { x, y, w, level } = b;
  rect(c, x, y, w, 10, "#c8ccd2");
  rect(c, x, y + 5, w, 1, C.helmet);
  rect(c, x, y + 12, w, 22, "#4a4e58");
  rect(c, x, y + 13, w, 1, C.white);
  rect(c, x, y + 32, w, 1, C.white);
  for (let i = x + 16; i < x + w - 16; i += 16) rect(c, i, y + 22, 8, 2, C.white);
  for (const ex of [x + 3, x + w - 10]) for (let k = 0; k < 5; k++) rect(c, ex, y + 15 + k * 3, 7, 1, C.white);
  if (level >= 2) {
    // hangar with a curved roof
    const hx = x + 6;
    rect(c, hx, y - 2, 34, 12, C.ink);
    rect(c, hx + 1, y - 1, 32, 10, "#9aa4b2");
    for (let i = hx + 1; i < hx + 33; i += 3) rect(c, i, y - 1, 1, 10, "#7a8494");
    rect(c, hx + 1, y - 1, 32, 2, "#c4ced8");
  }
  if (level >= 3) {
    const tx = x + 48;
    rect(c, tx, y - 14, 6, 24, C.ink);
    rect(c, tx + 1, y - 6, 4, 16, C.white);
    rect(c, tx - 2, y - 16, 10, 6, C.ink);
    rect(c, tx - 1, y - 15, 8, 4, GLASS);
  }
}

const PLANE_PERIOD = 50;

function plane(c: Ctx, x: number, y: number): void {
  // facing right, 28×20
  rect(c, x, y + 8, 26, 4, C.ink);
  rect(c, x + 1, y + 9, 24, 2, C.white);
  rect(c, x + 26, y + 9, 2, 2, C.ink);
  rect(c, x + 23, y + 9, 2, 1, C.glass);
  rect(c, x + 11, y, 4, 20, C.ink);
  rect(c, x + 12, y + 1, 2, 18, "#eef2f6");
  rect(c, x + 13, y + 4, 2, 2, C.metalLo);
  rect(c, x + 13, y + 14, 2, 2, C.metalLo);
  rect(c, x + 1, y + 5, 3, 10, C.ink);
  rect(c, x + 2, y + 6, 1, 8, C.red);
}

function animateFlugplatz(c: Ctx, b: Building, t: number): void {
  const p = (t + b.y * 0.05) % PLANE_PERIOD;
  if (b.level >= 3 && Math.floor(t) % 2) px(c, b.x + 51, b.y - 16, "#ff5040");
  if (p > 18) return;
  // taxi slowly, then speed up and lift off over the far end
  const s = p < 6 ? p * 4 : 24 + (p - 6) * (p - 6) * 2.6;
  const x = b.x + 4 + s;
  if (x > b.x + b.w + 30) return;
  const lift = Math.max(0, x - (b.x + b.w * 0.62)) * 0.45;
  const yGround = b.y + 13;
  if (lift > 0) {
    c.globalAlpha = Math.max(0.15, 0.35 - lift / 80);
    rect(c, Math.round(x + 2), yGround + 8, 24, 4, "#000000");
    c.globalAlpha = 1;
  }
  plane(c, Math.round(x), Math.round(yGround - lift));
}

// --- rocket launch pad ----------------------------------------------------------------------

const ROCKET_PERIOD = 70;

export function drawRakete(c: Ctx, b: Building): void {
  const { x, y, h, level } = b;
  box(c, x, y + h - 14, b.w, 14, CONCRETE);
  rect(c, x + 15, y + h - 13, 12, 6, "#2a2e38");
  // launch tower
  for (const tx of [x + 4, x + 10]) rect(c, tx, y + 6, 1, h - 20, C.red);
  for (let ty = y + 8; ty < y + h - 16; ty += 4) {
    for (let k = 0; k < 6; k++) px(c, x + 4 + k, ty + Math.floor(k * 0.66), "#a82820");
  }
  rect(c, x + 3, y + 5, 9, 2, C.ink);
  if (level >= 2) {
    for (const [cx, cy] of [
      [x + b.w - 7, y + h - 22],
      [x + b.w - 7, y + h - 32],
    ]) {
      for (let j = -3; j <= 3; j++) {
        const half = Math.round(Math.sqrt(12 - j * j));
        rect(c, cx - half, cy + j, half * 2, 1, j < 0 ? C.white : "#c8d0da");
      }
    }
  }
  if (level >= 3) {
    for (const lx of [x, x + b.w - 2]) {
      rect(c, lx, y + h - 30, 2, 18, C.metalLo);
      rect(c, lx - 1, y + h - 32, 4, 2, "#fff6c8");
    }
  }
}

function rocketBody(c: Ctx, x: number, y: number, gold: boolean): void {
  // 10 wide, 50 tall, nose up
  for (let i = 0; i < 8; i++) {
    const half = Math.ceil((i + 1) / 2);
    rect(c, x + 5 - half, y + i, half * 2, 1, gold ? C.gold : C.red);
  }
  rect(c, x + 1, y + 8, 8, 36, C.ink);
  rect(c, x + 2, y + 8, 6, 36, C.white);
  rect(c, x + 6, y + 8, 2, 36, "#c8d0da");
  rect(c, x + 3, y + 14, 3, 3, C.glass);
  text(c, "S", x + 3, y + 22, C.red);
  text(c, "F", x + 3, y + 28, C.red);
  rect(c, x - 2, y + 38, 4, 8, C.red);
  rect(c, x + 8, y + 38, 4, 8, C.red);
  rect(c, x + 2, y + 44, 6, 2, C.metalLo);
}

function animateRakete(c: Ctx, b: Building, t: number): void {
  const p = (t + b.x * 0.11) % ROCKET_PERIOD;
  const rx = b.x + 16;
  const ry = b.y + b.h - 60;
  const gold = b.level >= 4;
  if (p < 50) {
    // on the pad, steam venting now and then
    rocketBody(c, rx, ry, gold);
    rect(c, b.x + 11, ry + 18, 5, 2, C.metalLo);
    rect(c, b.x + 11, ry + 32, 5, 2, C.metalLo);
    if (p > 44) {
      c.globalAlpha = 0.7;
      c.drawImage(SPR.puff(1), rx - 4 + Math.round(Math.sin(t * 5) * 2), ry + 42);
      c.globalAlpha = 1;
    }
    return;
  }
  const l = p - 50;
  if (l > 9) return;
  const rise = Math.round(l * l * 3);
  rocketBody(c, rx, ry - rise, gold);
  // flame and smoke
  const k = Math.floor(t * 12);
  for (let i = 0; i < 10; i++) {
    const fx = rx + 2 + Math.floor(noise(k, i, 5) * 7);
    const fy = ry - rise + 46 + Math.floor(noise(k, i, 6) * (6 + l));
    px(c, fx, fy, i % 3 ? C.hot : C.hotLo);
  }
  for (let i = 0; i < 4; i++) {
    c.globalAlpha = Math.max(0, 0.8 - l / 12);
    c.drawImage(SPR.puff(1), rx - 8 + i * 6 + Math.round(Math.sin(t + i) * 2), b.y + b.h - 18 - i % 2);
  }
  c.globalAlpha = 1;
}

// --- dispatch -----------------------------------------------------------------------------

export const DRAW2: Partial<Record<Building["id"], (c: Ctx, b: Building) => void>> = {
  tankstelle: drawTankstelle,
  kita: drawKita,
  sportplatz: drawSportplatz,
  feuerwache: drawFeuerwache,
  autohaus: drawAutohaus,
  windpark: drawWindpark,
  forschung: drawForschung,
  hochregal: drawHochregal,
  rechenzentrum: drawRechenzentrum,
  hafen: drawHafen,
  flugplatz: drawFlugplatz,
  rakete: drawRakete,
};

export const ANIMATE2: Partial<Record<Building["id"], (c: Ctx, b: Building, t: number) => void>> = {
  tankstelle: animateTankstelle,
  kita: animateKita,
  sportplatz: animateSportplatz,
  feuerwache: animateFeuerwache,
  autohaus: animateAutohaus,
  windpark: animateWindpark,
  forschung: animateForschung,
  hochregal: animateHochregal,
  rechenzentrum: animateRechenzentrum,
  hafen: animateHafen,
  flugplatz: animateFlugplatz,
  rakete: animateRakete,
};

/** Lit windows and lights at night for the new buildings. */
export function lights2(c: Ctx, b: Building, t: number): void {
  const { x, y, w } = b;
  switch (b.id) {
    case "tankstelle":
      rect(c, x + 2, y + 12, 31, 1, "#fff0b0");
      break;
    case "kita":
      for (const wx of [x + 4, x + 21]) rect(c, wx + 1, y + 16, 5, 5, LIT);
      break;
    case "autohaus":
      rect(c, x + 2, y + 10, w - 4, 14, "#fff4c0");
      break;
    case "forschung":
      for (const by of [y + 15, y + 24]) for (let i = x + 4; i < x + w - 4; i += 7) if ((i + by) % 3) rect(c, i, by + 1, 5, 3, LIT);
      break;
    case "feuerwache":
      for (let d = 0; d < 2; d++) if (Math.floor(t * 4) % 2 === d) rect(c, x + 6 + d * 21, y + 16, 1, 1, "#58a8ff");
      break;
    case "sportplatz":
      if (b.level >= 3) for (const fx of [x, x + w - 2]) rect(c, fx - 1, y - 7, 4, 2, "#ffffe0");
      break;
    case "hafen":
      if (b.level >= 3 && Math.floor(t) % 2) rect(c, x + 5, y - 16, 4, 1, "#fff6a8");
      break;
    default:
      break;
  }
}
