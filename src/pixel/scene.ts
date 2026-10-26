import { animateBuilding, buildingLights, drawBuilding, drawClock, drawClockHands, drawComboPress, drawPlot, drawShed } from "./campus";
import { flag } from "./campusKit";
import type { Building, FactoryScene, HallBox, Rect, Site, Station } from "./layout";
import { bench, bigPress, booth, freeSpot, press, PRESS_HIT, rack, robot, ROBOT_TIP } from "./machines";
import { box, ctx2d, hazard, makeCanvas, noise, px, rect, type Ctx, type Shade } from "./paint";
import { C, SPR, type Facing } from "./sprites";
import { text, textWidth } from "./font";

/*
 * Draws a FactoryScene: a static layer (ground, buildings, walls) cached in an
 * offscreen canvas, plus a few animated things on top each frame.
 */

const G = {
  grassHi: "#a0e078",
  grass: "#80cc60",
  grassLo: "#5aa848",
  tuft: "#4c9a40",
  dirt: "#c8a070",
  dirtLo: "#a87c50",
  road: "#5a5e6a",
  roadLo: "#4a4e58",
  line: "#f0f0e8",
  curb: "#b8bcc4",
  pave: "#d8d8d0",
  paveLo: "#c0c0b6",
  floor: "#c8ccd2",
  floorLo: "#b6bbc2",
  floorHi: "#d6dae0",
  wallTop: "#7a8494",
  wallTopHi: "#9aa4b4",
  wallTopLo: "#566070",
  panel: "#a8b4c4",
  panelLo: "#8c98aa",
  panelHi: "#c4ced8",
  window: "#7cc4f0",
  windowHi: "#c8ecff",
  belt: "#3a3e48",
  beltLo: "#2a2d36",
  beltHi: "#555b68",
  safety: "#f8d030",
};

const HALL_ACCENT: Record<string, string> = {
  satzbau: C.orange,
  woerter: "#3cae5a",
  verben: "#e84038",
  faelle: "#9a50d0",
  redemittel: "#3a72e0",
};

export interface Hit {
  kind: "station" | "free" | "hall" | "site" | "hq" | "lot" | "building" | "plot";
  station?: Station;
  hall?: HallBox;
  site?: Site;
  building?: Building;
}

export interface RenderOpts {
  night: boolean;
  reduced: boolean;
}

export class FactoryRenderer {
  private scene: FactoryScene | null = null;
  private layer: HTMLCanvasElement | null = null;
  private opts: RenderOpts = { night: false, reduced: false };
  private c: Ctx;

  constructor(private canvas: HTMLCanvasElement) {
    this.c = ctx2d(canvas);
  }

  set(scene: FactoryScene, opts: RenderOpts): void {
    this.scene = scene;
    this.opts = opts;
    if (this.canvas.width !== scene.w || this.canvas.height !== scene.h) {
      this.canvas.width = scene.w;
      this.canvas.height = scene.h;
      this.c = ctx2d(this.canvas);
    }
    this.layer = makeCanvas(scene.w, scene.h);
    drawStatic(ctx2d(this.layer), scene);
  }

  /** Draws the frame at time t (seconds). Only rows between top and bottom are animated. */
  frame(t: number, top = 0, bottom = Infinity): void {
    const s = this.scene;
    if (!s || !this.layer) return;
    const c = this.c;
    if (this.opts.reduced) t = 0;
    c.clearRect(0, 0, s.w, s.h);
    c.drawImage(this.layer, 0, 0);
    const y0 = Math.max(0, top - 40);
    const y1 = bottom + 40;
    drawDynamic(c, s, t, y0, y1);
    if (this.opts.night) drawNight(c, s, t);
    drawMarkers(c, s, t, y0, y1);
  }

  hit(x: number, y: number): Hit | null {
    const s = this.scene;
    if (!s) return null;
    const inside = (r: Rect, pad = 0) => x >= r.x - pad && x < r.x + r.w + pad && y >= r.y - pad && y < r.y + r.h + pad;
    let best: Station | null = null;
    let bestD = Infinity;
    for (const st of s.stations) {
      if (!inside(st, 3)) continue;
      const d = Math.hypot(x - (st.x + st.w / 2), y - (st.y + st.h / 2));
      if (d < bestD) {
        bestD = d;
        best = st;
      }
    }
    if (best) return { kind: "station", station: best };
    for (const hall of s.halls) for (const f of hall.free) if (inside(f, 2)) return { kind: "free", hall };
    for (const site of s.sites) if (inside(site)) return { kind: "site", site };
    for (const hall of s.halls) if (inside(hall)) return { kind: "hall", hall };
    for (const b of s.buildings) if (inside(b)) return { kind: b.built ? "building" : "plot", building: b };
    if (inside(s.hq)) return { kind: "hq" };
    if (inside(s.lot)) return { kind: "lot" };
    return null;
  }
}

// --- static layer -------------------------------------------------------------------

function drawStatic(c: Ctx, s: FactoryScene): void {
  drawGrass(c, s.w, s.h);
  for (const r of s.roads) drawRoad(c, r);
  for (const r of s.walkways) drawWalkway(c, r);
  drawLot(c, s.lot);
  drawHQ(c, s.hq);
  for (const b of s.buildings) (b.built ? drawBuilding : drawPlot)(c, b);
  for (const h of s.halls) drawHall(c, h);
  for (const site of s.sites) drawSite(c, site);
  const order = [...s.decor].sort((a, b) => a.y - b.y);
  for (const d of order) {
    switch (d.kind) {
      case "tree":
        c.drawImage(SPR.tree(), d.x, d.y);
        break;
      case "smallTree":
        c.drawImage(SPR.smallTree(), d.x, d.y);
        break;
      case "bush":
        c.drawImage(SPR.bush(), d.x, d.y);
        break;
      case "lamp":
        c.drawImage(SPR.lamp(false), d.x, d.y);
        break;
      case "barrel":
        c.drawImage(SPR.barrel(), d.x, d.y);
        break;
      case "cone":
        c.drawImage(SPR.cone(), d.x, d.y);
        break;
      case "container":
        drawContainer(c, d.x, d.y, d.v);
        break;
      case "shed":
        drawShed(c, d.x, d.y, d.v);
        break;
      case "clock":
        drawClock(c, d.x, d.y);
        break;
      case "flower":
      case "combopress":
        break;
    }
  }
}

function drawGrass(c: Ctx, w: number, h: number): void {
  rect(c, 0, 0, w, h, G.grass);
  for (let y = 0; y < h; y += 4) {
    for (let x = (y / 4) % 2 ? 2 : 0; x < w; x += 4) {
      const n = noise(x, y, 11);
      if (n < 0.12) {
        // a little "v" tuft
        px(c, x, y, G.tuft);
        px(c, x + 2, y, G.tuft);
        px(c, x + 1, y + 1, G.tuft);
      } else if (n < 0.2) px(c, x + 1, y, G.grassHi);
      else if (n < 0.24) px(c, x, y + 1, G.grassLo);
    }
  }
}

/** Two lanes, right-hand traffic: the upper lane runs left, the lower lane runs right. */
export const LANES = [
  { dy: 2, left: true },
  { dy: 18, left: false },
] as const;

function drawRoad(c: Ctx, r: Rect): void {
  rect(c, r.x, r.y, r.w, 2, G.curb);
  rect(c, r.x, r.y + 1, r.w, 1, "#9aa0aa");
  rect(c, r.x, r.y + 2, r.w, r.h - 4, G.road);
  for (let x = 0; x < r.w; x += 3) if (noise(x, r.y, 5) < 0.3) px(c, x, r.y + 3 + Math.floor(noise(x, r.y, 6) * (r.h - 6)), G.roadLo);
  // edge lines and the dashed centre line between the lanes
  rect(c, r.x, r.y + 3, r.w, 1, "#8a8e98");
  rect(c, r.x, r.y + r.h - 4, r.w, 1, "#8a8e98");
  const mid = r.y + 16;
  for (let x = 2; x < r.w; x += 10) rect(c, x, mid, 6, 2, G.line);
  rect(c, r.x, r.y + r.h - 2, r.w, 2, G.curb);
  rect(c, r.x, r.y + r.h - 2, r.w, 1, "#e0e4ea");
}

function drawWalkway(c: Ctx, r: Rect): void {
  rect(c, r.x, r.y, r.w, r.h, G.pave);
  for (let x = 0; x < r.w; x += 6) rect(c, x, r.y, 1, r.h, G.paveLo);
  rect(c, r.x, r.y + Math.floor(r.h / 2), r.w, 1, G.paveLo);
  rect(c, r.x, r.y, r.w, 1, "#e8e8e0");
  rect(c, r.x, r.y + r.h - 1, r.w, 1, "#a8a89e");
}

const HQ_WALL: Shade = { o: C.ink, l: "#f4ecd8", m: "#e4d8bc", d: "#c4b494" };
const ROOF: Shade = { o: C.ink, l: "#f07860", m: "#d05040", d: "#a03830" };

/** Window positions of the HQ: one row per floor, none beside the door or behind the level plate. */
function hqWindows(hq: FactoryScene["hq"]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const facadeY = hq.y + 26;
  for (let f = 0; f < hq.floors; f++) {
    const wy = facadeY + 3 + f * 10;
    const ground = f === hq.floors - 1;
    for (let wx = hq.x + 5; wx + 8 < hq.x + hq.w - 3; wx += 12) {
      if (ground && (Math.abs(wx + 4 - (hq.x + hq.w / 2)) < 9 || wx < hq.x + 26)) continue;
      out.push({ x: wx, y: wy });
    }
  }
  return out;
}

function drawHQ(c: Ctx, hq: FactoryScene["hq"]): void {
  const x = hq.x;
  const roofY = hq.y + 10;
  const facadeY = roofY + 16;
  const facadeH = 8 + 10 * hq.floors;
  // shadow
  rect(c, x + 3, facadeY + facadeH, hq.w - 2, 3, "rgba(40,48,64,0.25)");
  // facade
  box(c, x, facadeY - 1, hq.w, facadeH + 1, HQ_WALL);
  for (const w of hqWindows(hq)) {
    rect(c, w.x, w.y, 8, 7, C.ink);
    rect(c, w.x + 1, w.y + 1, 6, 5, G.window);
    rect(c, w.x + 1, w.y + 1, 2, 2, G.windowHi);
    rect(c, w.x + 4, w.y + 1, 1, 5, C.ink);
  }
  // door with awning
  const dx = x + Math.floor(hq.w / 2) - 6;
  const dy = facadeY + facadeH - 12;
  rect(c, dx - 2, dy - 2, 16, 3, C.ink);
  for (let i = 0; i < 14; i++) px(c, dx - 1 + i, dy - 1, i % 4 < 2 ? C.red : C.white);
  rect(c, dx, dy + 1, 12, 11, C.ink);
  rect(c, dx + 1, dy + 2, 10, 10, "#7a4e28");
  rect(c, dx + 1, dy + 2, 4, 9, G.window);
  rect(c, dx + 7, dy + 2, 4, 9, G.window);
  rect(c, dx + 1, dy + 2, 1, 3, G.windowHi);
  // roof, seen from above
  box(c, x - 2, roofY, hq.w + 4, 17, ROOF);
  for (let ry = roofY + 3; ry < roofY + 15; ry += 3) {
    rect(c, x, ry, hq.w, 1, ROOF.d);
    for (let rx = x + ((ry / 3) % 2 ? 2 : 5); rx < x + hq.w; rx += 6) px(c, rx, ry - 1, ROOF.d);
  }
  // sign on the roof edge
  const name = "SATZFABRIK";
  const tw = textWidth(name);
  const sx = x + Math.floor((hq.w - tw) / 2);
  rect(c, sx - 3, roofY + 11, tw + 6, 9, C.ink);
  rect(c, sx - 2, roofY + 12, tw + 4, 7, "#283a6c");
  text(c, name, sx, roofY + 13, C.helmetHi);
  // a star on the roof for every master's certificate
  if (hq.stars > 0) {
    const room = hq.w - 26;
    const pitch = Math.min(7, Math.floor(room / hq.stars));
    const sx0 = x + 10 + Math.floor((room - pitch * hq.stars) / 2);
    for (let i = 0; i < hq.stars; i++) star(c, sx0 + i * pitch, roofY + 3);
  }
  // chimney
  box(c, x + hq.w - 14, roofY - 5, 7, 9, { o: C.ink, l: "#c87860", m: "#a85c48", d: "#7c4030" });
  // flag pole with the streak
  const fx = x + 6;
  rect(c, fx, hq.y - 2, 1, 14, C.ink);
  px(c, fx, hq.y - 3, C.gold);
  const label = String(Math.min(999, hq.streak));
  const fw = Math.max(9, textWidth(label) + 4);
  rect(c, fx + 1, hq.y - 1, fw, 8, C.ink);
  rect(c, fx + 1, hq.y, fw - 1, 6, hq.streak > 0 ? C.orange : C.metal);
  text(c, label, fx + 3, hq.y + 1, C.white);
  // level plate next to the door
  const lv = `LV ${hq.level}`;
  rect(c, x + 3, facadeY + facadeH - 9, textWidth(lv) + 4, 7, C.ink);
  text(c, lv, x + 5, facadeY + facadeH - 8, C.helmetHi);
}

/** Gold star, 5×5. */
function star(c: Ctx, x: number, y: number): void {
  px(c, x + 2, y, C.goldHi);
  rect(c, x + 1, y + 1, 3, 1, C.gold);
  rect(c, x, y + 2, 5, 1, C.gold);
  px(c, x + 2, y + 2, C.goldHi);
  rect(c, x + 1, y + 3, 3, 1, C.goldLo);
  px(c, x + 1, y + 4, C.goldLo);
  px(c, x + 3, y + 4, C.goldLo);
}

function drawLot(c: Ctx, lot: FactoryScene["lot"]): void {
  rect(c, lot.x, lot.y, lot.w, lot.h, C.ink);
  rect(c, lot.x + 1, lot.y + 1, lot.w - 2, lot.h - 2, G.road);
  for (let i = 0; i < lot.w; i += 3) if (noise(i, lot.y, 9) < 0.3) px(c, lot.x + 1 + i, lot.y + 2 + Math.floor(noise(i, lot.y, 8) * (lot.h - 4)), G.roadLo);
  for (const sp of lot.spots) {
    rect(c, sp.x, sp.y + 1, 1, sp.h - 2, G.line);
    rect(c, sp.x + sp.w, sp.y + 1, 1, sp.h - 2, G.line);
  }
  // sign: cars built today
  const label = `HEUTE ${lot.today}`;
  const tw = textWidth(label);
  const sx = lot.x + lot.w - tw - 6;
  const sy = lot.y - 9;
  rect(c, sx - 2, sy, tw + 4, 8, C.ink);
  rect(c, sx - 1, sy + 1, tw + 2, 6, "#2c6a4c");
  text(c, label, sx, sy + 2, C.white);
}

const CONTAINER_COLORS = ["#c84838", "#3a72e0", "#3cae5a", "#f07a1c"];

function drawContainer(c: Ctx, x: number, y: number, v: number): void {
  const col = CONTAINER_COLORS[v % CONTAINER_COLORS.length];
  rect(c, x, y, 24, 12, C.ink);
  rect(c, x + 1, y + 1, 22, 3, "#ffffff40");
  rect(c, x + 1, y + 1, 22, 10, col);
  rect(c, x + 1, y + 1, 22, 2, "#ffffff55");
  for (let i = x + 3; i < x + 22; i += 3) rect(c, i, y + 3, 1, 8, "#00000030");
  rect(c, x + 1, y + 10, 22, 1, "#00000040");
}

function signRect(h: HallBox): { x: number; w: number } {
  const w = textWidth(h.sign.toUpperCase()) + 8 + (h.level ? h.level * 4 + 2 : 0);
  return { x: h.x + Math.floor((h.w - w) / 2), w };
}

function hallWindows(h: HallBox): number[] {
  const sign = signRect(h);
  const out: number[] = [];
  for (let x = h.x + 6; x + 10 < h.x + h.w - 4; x += 16) {
    if (x + 10 > sign.x && x < sign.x + sign.w) continue;
    out.push(x);
  }
  return out;
}

const FLOORS: Record<string, { base: string; line: string; fleck: string }> = {
  satzbau: { base: G.floor, line: G.floorLo, fleck: G.floorHi },
  woerter: { base: "#cdc8bc", line: "#bab4a6", fleck: "#dcd8ce" },
  verben: { base: "#aeb4bc", line: "#9aa0aa", fleck: "#c2c8d0" },
  faelle: { base: "#dfe3e8", line: "#cbd0d8", fleck: "#eef0f4" },
  redemittel: { base: "#d8b480", line: "#bc9660", fleck: "#e6c896" },
};

function drawHall(c: Ctx, h: HallBox): void {
  const accent = HALL_ACCENT[h.id] ?? C.orange;
  // floor: concrete, warehouse, steel plate, white tiles or wooden planks
  const f = h.inner;
  const fl = FLOORS[h.id] ?? FLOORS.satzbau;
  rect(c, f.x, f.y, f.w, f.h, fl.base);
  if (h.id === "redemittel") {
    for (let y = f.y + 3; y < f.y + f.h; y += 4) rect(c, f.x, y, f.w, 1, fl.line);
    for (let y = f.y; y < f.y + f.h; y += 4)
      for (let x = f.x + ((y / 4) % 3) * 7; x < f.x + f.w; x += 21) rect(c, x, y, 1, 3, fl.line);
  } else if (h.id === "verben") {
    for (let y = f.y + 1; y < f.y + f.h; y += 3) for (let x = f.x + ((y - f.y) % 6 ? 1 : 2); x < f.x + f.w; x += 3) px(c, x, y, fl.fleck);
  } else {
    const step = h.id === "faelle" ? 6 : 8;
    for (let y = f.y + step - 1; y < f.y + f.h; y += step) rect(c, f.x, y, f.w, 1, fl.line);
    for (let x = f.x + step - 1; x < f.x + f.w; x += step) rect(c, x, f.y, 1, f.h, fl.line);
  }
  for (let i = 0; i < 40; i++) {
    const nx = f.x + Math.floor(noise(i, h.y, 21) * f.w);
    const ny = f.y + Math.floor(noise(i, h.y, 22) * f.h);
    px(c, nx, ny, noise(i, h.y, 23) < 0.5 ? fl.fleck : fl.line);
  }
  // safety lines along the walls
  rect(c, f.x + 1, f.y + 1, f.w - 2, 1, G.safety);
  rect(c, f.x + 1, f.y + f.h - 2, f.w - 2, 1, G.safety);
  // empty spots
  for (const r of h.free) freeSpot(c, r.x, r.y, r.w, r.h, G.safety);
  if (h.note) {
    const tw = textWidth(h.note);
    const nx = f.x + Math.floor((f.w - tw) / 2);
    const ny = f.y + f.h - 12;
    rect(c, nx - 3, ny - 2, tw + 6, 9, "#ffffffa0");
    text(c, h.note, nx, ny, C.ink);
  }
  // belts (frames; the moving surface is drawn per frame)
  for (const b of h.belts) {
    rect(c, b.x, b.y - 1, b.w, b.h + 2, C.ink);
    rect(c, b.x, b.y, b.w, b.h, G.belt);
    rect(c, b.x, b.y - 1, b.w, 1, G.beltHi);
    rect(c, b.x, b.y + b.h, b.w, 1, G.beltLo);
  }
  // back wall: corrugated panels, high windows, the sign
  const wy = h.y + 3;
  rect(c, h.x, wy, h.w, 18, G.panel);
  for (let x = h.x + 1; x < h.x + h.w; x += 3) rect(c, x, wy, 1, 18, G.panelLo);
  for (let x = h.x + 2; x < h.x + h.w; x += 3) rect(c, x, wy, 1, 18, G.panelHi);
  rect(c, h.x, wy + 15, h.w, 3, accent);
  rect(c, h.x, wy + 15, h.w, 1, "#ffffff60");
  rect(c, h.x, wy + 17, h.w, 1, "#00000030");
  for (const x of hallWindows(h)) {
    rect(c, x, wy + 3, 10, 6, C.ink);
    rect(c, x + 1, wy + 4, 8, 4, G.window);
    rect(c, x + 1, wy + 4, 3, 1, G.windowHi);
    rect(c, x + 5, wy + 4, 1, 4, C.ink);
  }
  const label = h.sign.toUpperCase();
  const tw = textWidth(label);
  const stars = h.level;
  const { x: sx, w: sw } = signRect(h);
  rect(c, sx, wy + 2, sw, 10, C.ink);
  rect(c, sx + 1, wy + 3, sw - 2, 8, "#fbfbf4");
  rect(c, sx + 1, wy + 10, sw - 2, 1, "#d8d8cc");
  text(c, label, sx + 4, wy + 5, C.ink);
  for (let i = 0; i < stars; i++) {
    const stx = sx + 4 + tw + 3 + i * 4;
    rect(c, stx, wy + 5, 3, 3, C.gold);
    px(c, stx, wy + 5, C.goldHi);
  }
  // wall tops: back, sides, front with the gate
  const top: Shade = { o: C.ink, l: G.wallTopHi, m: G.wallTop, d: G.wallTopLo };
  box(c, h.x - 1, h.y, h.w + 2, 4, top);
  box(c, h.x - 1, h.y, 4, h.h, top);
  box(c, h.x + h.w - 3, h.y, 4, h.h, top);
  const by = h.y + h.h - 3;
  box(c, h.x - 1, by, h.gate.x - h.x + 2, 4, top);
  box(c, h.gate.x + h.gate.w - 1, by, h.x + h.w - h.gate.x - h.gate.w + 2, 4, top);
  hazard(c, h.gate.x + 1, by + 1, h.gate.w - 2, 2);
}

function drawSite(c: Ctx, s: Site): void {
  // dirt with a few stones
  rect(c, s.x, s.y + 2, s.w, s.h - 4, G.dirt);
  for (let i = 0; i < s.w * 2; i++) {
    const nx = s.x + Math.floor(noise(i, s.y, 31) * s.w);
    const ny = s.y + 3 + Math.floor(noise(i, s.y, 32) * (s.h - 7));
    px(c, nx, ny, noise(i, s.y, 33) < 0.6 ? G.dirtLo : "#dcbc8c");
  }
  // foundation outline
  const fx = s.x + 10;
  const fy = s.y + 10;
  const fw = s.w - 20;
  const fh = s.h - 22;
  rect(c, fx, fy, fw, fh, "#b8bcc4");
  rect(c, fx + 1, fy + 1, fw - 2, fh - 2, "#cfd3d8");
  for (let x = fx + 4; x < fx + fw - 2; x += 8) rect(c, x, fy + 1, 1, fh - 2, "#b8bcc4");
  // stacked bricks and a crane
  for (let i = 0; i < 3; i++) {
    rect(c, fx + 4 + i * 5, fy + fh - 6, 5, 3, C.ink);
    rect(c, fx + 5 + i * 5, fy + fh - 5, 3, 1, "#c86048");
  }
  const mx = fx + fw - 18;
  for (let y = s.y - 6; y < fy + fh - 2; y += 3) {
    rect(c, mx, y, 5, 1, C.ink);
    px(c, mx + 1 + ((y / 3) % 2 ? 0 : 2), y + 1, C.helmetLo);
  }
  rect(c, mx, s.y - 6, 1, fy + fh - s.y + 4, C.ink);
  rect(c, mx + 4, s.y - 6, 1, fy + fh - s.y + 4, C.ink);
  rect(c, mx + 1, s.y - 6, 3, fy + fh - s.y + 4, C.helmet);
  for (let y = s.y - 5; y < fy + fh - 2; y += 3) rect(c, mx + 1, y, 3, 1, C.helmetLo);
  rect(c, mx - 30, s.y - 9, 44, 4, C.ink);
  rect(c, mx - 29, s.y - 8, 42, 2, C.helmet);
  for (let x = mx - 28; x < mx + 13; x += 3) px(c, x, s.y - 8, C.helmetLo);
  rect(c, mx + 8, s.y - 11, 6, 7, C.ink);
  rect(c, mx + 9, s.y - 10, 4, 4, "#5e6778");
  rect(c, mx - 24, s.y - 5, 1, 14, C.ink);
  rect(c, mx - 26, s.y + 9, 5, 3, C.ink);
  rect(c, mx - 25, s.y + 9, 3, 2, "#d8a868");
  // fence: red and white barriers along the top and bottom
  for (const y of [s.y, s.y + s.h - 3]) {
    rect(c, s.x, y, s.w, 3, C.ink);
    for (let x = s.x + 1; x < s.x + s.w - 1; x++) px(c, x, y + 1, Math.floor((x - s.x) / 3) % 2 ? C.white : C.red);
  }
  // the sign
  const label = `AB LEVEL ${s.unlockLevel}`;
  const name = s.sign.toUpperCase();
  const tw = Math.max(textWidth(label), textWidth(name));
  const sx = fx + 4;
  const sy = fy + 3;
  rect(c, sx - 3, sy - 2, tw + 6, 16, C.ink);
  rect(c, sx - 2, sy - 1, tw + 4, 14, C.helmet);
  text(c, name, sx, sy, C.ink);
  text(c, label, sx, sy + 7, C.ink);
  rect(c, sx + 2, sy + 14, 1, 3, C.ink);
  rect(c, sx + tw - 3, sy + 14, 1, 3, C.ink);
}

// --- animated layer ------------------------------------------------------------------

type Draw = { z: number; f: () => void };

function drawDynamic(c: Ctx, s: FactoryScene, t: number, top: number, bottom: number): void {
  const list: Draw[] = [];
  const visible = (y: number, h: number) => y + h >= top && y <= bottom;

  // belts: moving slats and what they carry
  for (const h of s.halls) {
    for (const b of h.belts) {
      if (!visible(b.y, b.h)) continue;
      const off = Math.floor((t * b.speed) % 4);
      for (let x = b.x + off; x < b.x + b.w; x += 4) rect(c, x, b.y, 1, b.h, G.beltHi);
      if (b.speed <= 0) continue;
      if (b.carry === "car") {
        const gap = 34;
        const shift = (t * b.speed) % gap;
        for (let x = b.x - 16 + shift; x < b.x + b.w; x += gap) {
          const cx = Math.round(x);
          if (cx < b.x || cx + 16 > b.x + b.w) continue;
          c.drawImage(SPR.car(0, "right", true), cx, b.y);
        }
      } else {
        const gap = 14;
        const shift = (t * b.speed) % gap;
        for (let x = b.x + shift; x < b.x + b.w - 5; x += gap) {
          const cx = Math.round(x);
          rect(c, cx, b.y + 1, 5, 3, C.ink);
          rect(c, cx + 1, b.y + 1, 3, 2, "#d4d9e0");
        }
      }
    }
  }

  // flags of the export markets, fluttering
  s.flags.forEach((f, i) => {
    if (visible(f.y, 10)) flag(c, f.x, f.y, f.code, Math.floor(t * 2.5 + i * 0.7) % 2);
  });
  // moving parts of the buildings: train, race cars, helicopter, steam
  for (const b of s.buildings) if (visible(b.y - 16, b.h + 16)) animateBuilding(c, b, t);
  for (const d of s.decor) {
    if (d.kind === "combopress" && visible(d.y, 22)) drawComboPress(c, d.x, d.y, d.v, t);
    else if (d.kind === "clock" && visible(d.y, 22)) drawClockHands(c, d.x, d.y, new Date());
  }

  // stations
  for (const st of s.stations) {
    if (!visible(st.y - 12, st.h + 12)) continue;
    list.push({ z: st.y + st.h, f: () => drawStation(c, st, t) });
  }

  // parked cars (today's sentences)
  s.lot.spots.slice(0, s.lot.cars).forEach((sp, i) => {
    c.drawImage(SPR.car((i * 7 + 3) % 10, i % 2 ? "down" : "up"), sp.x + 1, sp.y + 2);
  });

  // walkers
  for (const w of s.walks) {
    if (!visible(w.y - 16, 16)) continue;
    const span = Math.max(1, w.x1 - w.x0);
    const period = (2 * span) / w.speed;
    const p = ((t / period + w.phase) % 1 + 1) % 1;
    const goingRight = p < 0.5;
    const x = Math.round(w.x0 + (goingRight ? p * 2 : 2 - p * 2) * span);
    const step = Math.floor(t * 6 + w.phase * 10) % 2;
    if (w.who === "forklift") {
      const loaded = goingRight;
      list.push({ z: w.y, f: () => c.drawImage(SPR.forklift(!goingRight, loaded), x, w.y - 10) });
    } else {
      const facing: Facing = goingRight ? "right" : "left";
      const spr = w.who === "boss" ? SPR.boss(facing, step) : w.who === "trainee" ? SPR.trainee(facing, step) : SPR.worker(facing, step);
      list.push({ z: w.y, f: () => c.drawImage(spr, x, w.y - 16) });
    }
  }

  list.sort((a, b) => a.z - b.z);
  for (const d of list) d.f();

  // trucks on the roads
  drawTrucks(c, s, t);
  // chimney smoke at the HQ
  drawSmoke(c, s.hq.x + s.hq.w - 13, s.hq.y + 4, t);
  // flowers sway
  for (const d of s.decor) {
    if (d.kind !== "flower" || !visible(d.y, 3)) continue;
    const col = ["#f85868", "#ffffff", "#f8d030"][d.v % 3];
    c.drawImage(SPR.flower(Math.floor(t * 1.5 + d.x) % 2, col), d.x, d.y);
  }
}

/** "!" bubbles over machines that need maintenance, sparkles over gold ones. Drawn after the night tint. */
function drawMarkers(c: Ctx, s: FactoryScene, t: number, top: number, bottom: number): void {
  for (const st of s.stations) {
    if (st.y + st.h < top || st.y - 12 > bottom) continue;
    if (st.due) {
      const bob = Math.floor(t * 2 + st.n * 0.7) % 2;
      c.drawImage(SPR.bubble(), st.x + Math.floor(st.w / 2) - 4, st.y - 9 - bob);
    } else if (st.look === "gold") {
      const phase = (t * 1.3 + st.n * 0.37) % 2;
      if (phase < 1) c.drawImage(SPR.sparkle(phase < 0.5 ? 0 : 1), st.x + 2 + ((st.n * 5) % Math.max(1, st.w - 8)), st.y + 1);
    }
  }
}

/** "×4" on machines that stand for several items. */
function countBadge(c: Ctx, st: Station): void {
  const label = `×${st.items.length}`;
  const w = textWidth(label) + 3;
  const x = st.x + st.w - w;
  const y = st.y + st.h - 7;
  rect(c, x, y, w, 7, C.ink);
  text(c, label, x + 2, y + 1, C.white);
}

function drawStation(c: Ctx, st: Station, t: number): void {
  const working = st.look === "work" || st.look === "gold";
  const speed = st.look === "gold" ? 2.6 : 1.8;
  const phase = st.n * 0.37;
  const cycle = (t * speed + phase) % 2;
  const frame = working && cycle > 1.25 ? 1 : 0;
  switch (st.kind) {
    case "robot": {
      c.drawImage(robot(frame, st.look), st.x, st.y);
      if (frame && Math.floor(t * 12) % 2) sparks(c, st.x + ROBOT_TIP.x, st.y + ROBOT_TIP.y + 3, t, st.n);
      break;
    }
    case "press":
      c.drawImage(press(frame, st.look), st.x, st.y);
      if (frame && cycle < 1.45) sparks(c, st.x + PRESS_HIT.x, st.y + PRESS_HIT.y, t, st.n);
      break;
    case "bigpress":
      c.drawImage(bigPress(frame, st.look), st.x, st.y);
      break;
    case "booth": {
      c.drawImage(booth(frame, st.look, st.n), st.x, st.y);
      if (frame) mist(c, st.x + 8, st.y + 9, t, st.n);
      break;
    }
    case "bench":
      c.drawImage(bench(frame, st.look, st.n), st.x, st.y);
      break;
    case "rack":
      c.drawImage(rack(st.items), st.x, st.y);
      break;
  }
  if (st.kind !== "rack" && st.items.length > 1) countBadge(c, st);
}

function sparks(c: Ctx, x: number, y: number, t: number, n: number): void {
  const k = Math.floor(t * 12);
  for (let i = 0; i < 4; i++) {
    const a = noise(k, i, n);
    const b = noise(k, i + 9, n);
    const dx = Math.round((a - 0.5) * 7);
    const dy = Math.round(-b * 4);
    px(c, x + dx, y + dy, i % 2 ? C.hot : C.white);
  }
}

function mist(c: Ctx, x: number, y: number, t: number, n: number): void {
  const k = Math.floor(t * 8);
  for (let i = 0; i < 6; i++) {
    const dx = Math.floor(noise(k, i, n + 1) * 7);
    const dy = Math.floor(noise(k, i + 4, n + 2) * 8);
    px(c, x + dx, y + dy, "#ffffffb0");
  }
}

/**
 * Road traffic. All vehicles in a lane drive at the same speed, spaced along a loop
 * longer than the road, so nothing ever overlaps or meets head-on. Each slot is a car,
 * one of the factory's own car transporters (more with every truck in the fleet), or
 * empty; it changes only while off screen.
 */
function drawTrucks(c: Ctx, s: FactoryScene, t: number): void {
  const fleet = s.fleet;
  const loop = s.w + 150;
  const slots = Math.min(Math.floor(loop / 66), 2 + Math.ceil(fleet / 2));
  const spacing = loop / slots;
  const truckShare = fleet === 0 ? 0 : Math.min(0.75, 0.25 + 0.07 * fleet);
  const empty = fleet === 0 ? 0.3 : 0.15;
  s.roads.forEach((r, ri) => {
    LANES.forEach((lane, li) => {
      const speed = 24 + li * 5 + ri * 3;
      for (let i = 0; i < slots; i++) {
        const d = t * speed + i * spacing + ri * 97 + li * 41;
        const lap = Math.floor(d / loop);
        const pos = d - lap * loop;
        const roll = noise(i * 13 + li, lap * 7 + ri, 77);
        if (roll < empty) continue;
        const truck = roll < empty + truckShare;
        const w = truck ? 52 : 16;
        const x = lane.left ? Math.round(s.w + 20 - pos) : Math.round(pos - w - 20);
        if (x > s.w || x + w < 0) continue;
        const spr = truck
          ? SPR.truck(6, lane.left, (lap + i) % 2 ? [1, 5] : [0, 2])
          : SPR.car((lap * 3 + i * 5 + li + ri) % 10, lane.left ? "left" : "right");
        c.drawImage(spr, x, r.y + lane.dy + (truck ? 0 : 1));
      }
    });
  });
}

function drawSmoke(c: Ctx, x: number, y: number, t: number): void {
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.5 + i / 3) % 1;
    const sx = Math.round(x + p * 6 + Math.sin((t + i) * 2) * 1.5);
    const sy = Math.round(y - p * 14);
    c.globalAlpha = 1 - p;
    c.drawImage(SPR.puff(p > 0.5 ? 1 : 0), sx - 2, sy - 3);
  }
  c.globalAlpha = 1;
}

function glow(c: Ctx, x: number, y: number, r: number, col: string, a: number): void {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col);
  g.addColorStop(1, "rgba(0,0,0,0)");
  c.globalAlpha = a;
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.globalAlpha = 1;
}

function drawNight(c: Ctx, s: FactoryScene, t: number): void {
  c.globalCompositeOperation = "multiply";
  rect(c, 0, 0, s.w, s.h, "#5a6aa0");
  c.globalCompositeOperation = "source-over";
  for (const h of s.halls) {
    for (const x of hallWindows(h)) {
      rect(c, x + 1, h.y + 7, 8, 4, "#ffe9a0");
      rect(c, x + 5, h.y + 7, 1, 4, "#c8a860");
    }
  }
  for (const w of hqWindows(s.hq)) {
    if ((w.x * 7 + w.y) % 5 === 0) continue;
    rect(c, w.x + 1, w.y + 1, 6, 5, "#ffe9a0");
    rect(c, w.x + 4, w.y + 1, 1, 5, "#c8a860");
  }
  for (const b of s.buildings) buildingLights(c, b, t);
  c.globalCompositeOperation = "lighter";
  for (const d of s.decor) {
    if (d.kind !== "lamp") continue;
    glow(c, d.x + 3, d.y + 6, 12, "#fff0b0", 0.35 + 0.05 * Math.sin(t * 3 + d.x));
  }
  c.globalCompositeOperation = "source-over";
  for (const d of s.decor) if (d.kind === "lamp") c.drawImage(SPR.lamp(true), d.x, d.y);
}
