import type { Catalog } from "../content/catalog";
import { HALLS, type HallId, type ItemKind } from "../content/types";
import { isDue, stageOf } from "../engine/srs";
import { dayKey } from "../engine/text";
import { hallUnlocked } from "../game/actions";
import { levelOf } from "../game/economy";
import type { GameState } from "../game/state";
import { level as upgradeLevel, type UpgradeId } from "../game/upgrades";

/*
 * Pure layout of the pixel factory: game state in, positions out (logical pixels).
 * No canvas here, so it runs in tests. scene.ts draws what this returns.
 */

export type StationKind = "robot" | "rack" | "press" | "bigpress" | "booth" | "bench";
export type Look = "work" | "rust" | "gold" | "plan";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StationItem {
  id: string;
  stage: number;
  due: boolean;
}

export interface Station extends Rect {
  kind: StationKind;
  hall: HallId;
  /** One item, or several when the hall is packed (a rack holds RACK_SLOTS crates). */
  items: StationItem[];
  look: Look;
  due: boolean;
  /** Running number in the hall: picks colours and animation phase. */
  n: number;
}

export interface Belt extends Rect {
  speed: number;
  carry: "car" | "panel";
}

export interface HallBox extends Rect {
  id: HallId;
  sign: string;
  level: number;
  inner: Rect;
  gate: { x: number; w: number };
  belts: Belt[];
  /** Empty floor spots: room for the next machines. */
  free: Rect[];
  note?: string;
  built: number;
  total: number;
}

export interface Site extends Rect {
  id: HallId;
  sign: string;
  unlockLevel: number;
}

export interface Walk {
  who: "worker" | "boss" | "forklift";
  x0: number;
  x1: number;
  /** Feet line. */
  y: number;
  speed: number;
  phase: number;
}

export type DecorKind = "tree" | "smallTree" | "bush" | "lamp" | "flower" | "barrel" | "cone" | "container";

export interface Decor {
  kind: DecorKind;
  x: number;
  y: number;
  v: number;
}

export interface FactoryScene {
  w: number;
  h: number;
  roads: Rect[];
  walkways: Rect[];
  hq: Rect & { floors: number; streak: number; total: number; level: number };
  lot: Rect & { spots: Rect[]; cars: number; today: number };
  halls: HallBox[];
  sites: Site[];
  stations: Station[];
  walks: Walk[];
  decor: Decor[];
}

export const STATION: Record<StationKind, { w: number; h: number; gap: number; aisle: number }> = {
  robot: { w: 20, h: 24, gap: 2, aisle: 8 },
  rack: { w: 23, h: 24, gap: 2, aisle: 13 },
  press: { w: 14, h: 17, gap: 2, aisle: 10 },
  bigpress: { w: 20, h: 22, gap: 2, aisle: 10 },
  booth: { w: 22, h: 24, gap: 2, aisle: 8 },
  bench: { w: 16, h: 20, gap: 1, aisle: 8 },
};

export const RACK_SLOTS = 9;
/**
 * Rows a hall may use per machine type. Beyond that, one machine stands for several
 * items (a crate for several words, a press for several verbs), so even a factory with
 * every item of the curriculum stays a few screens long.
 */
const MAX_ROWS: Record<StationKind, number> = { robot: 6, rack: 8, press: 8, bigpress: 3, booth: 4, bench: 6 };

export const HALL_ORDER: HallId[] = ["satzbau", "woerter", "verben", "faelle", "redemittel"];

const SIGNS: Record<HallId, string> = {
  satzbau: "Satzbau-Halle",
  woerter: "Wortlager",
  verben: "Verbschmiede",
  faelle: "Kasuswerk",
  redemittel: "Manufaktur",
};

export function stationKind(hall: HallId, kind: ItemKind): StationKind {
  switch (hall) {
    case "satzbau":
      return "robot";
    case "woerter":
      return "rack";
    case "verben":
      return kind === "gram" ? "bigpress" : "press";
    case "faelle":
      return "booth";
    case "redemittel":
      return "bench";
  }
}

export function lookOf(stage: number, due: boolean): Look {
  if (stage === 0) return "plan";
  if (due) return "rust";
  return stage >= 5 ? "gold" : "work";
}

// --- input ---------------------------------------------------------------------

export interface HallInput {
  id: HallId;
  unlocked: boolean;
  unlockLevel: number;
  level: number;
  items: (StationItem & { kind: ItemKind })[];
}

export interface MapInput {
  width: number;
  level: number;
  streak: number;
  today: number;
  total: number;
  upgrades: Partial<Record<UpgradeId, number>>;
  halls: HallInput[];
  seed: number;
}

export function mapInput(s: GameState, catalog: Catalog, now: number, width: number): MapInput {
  const halls = HALL_ORDER.map((id): HallInput => {
    const owned = catalog
      .inHall(id)
      .filter((it) => s.cards[it.id])
      .map((it, i) => ({ it, card: s.cards[it.id], i }))
      .sort((a, b) => a.card.unlockedAt - b.card.unlockedAt || a.i - b.i);
    return {
      id,
      unlocked: hallUnlocked(s, id),
      unlockLevel: HALLS[id].unlockLevel,
      level: upgradeLevel(s.upgrades, `halle_${id}`),
      items: owned.map(({ it, card }) => ({ id: it.id, kind: it.kind, stage: stageOf(card), due: isDue(card, now) })),
    };
  });
  return {
    width,
    level: levelOf(s.xp),
    streak: s.streak.current,
    today: s.stats.days[dayKey(now)]?.tasks ?? 0,
    total: s.stats.sentences,
    upgrades: s.upgrades,
    halls,
    seed: Math.floor(s.createdAt / 1000) % 100_000,
  };
}

// --- layout ---------------------------------------------------------------------

const TREE_BAND = 14;
/** Two lanes of 14 px (trucks and cars), a centre line and curbs. */
const ROAD_H = 34;
const WALK_H = 12;
const WALL = 3;
const BACK = 18;
const PAD = 4;
const SITE_H = 52;
const SPOT_W = 14;
const SPOT_H = 20;

function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function layout(inp: MapInput): FactoryScene {
  const W = Math.max(160, Math.floor(inp.width));
  const M = W >= 300 ? 16 : W >= 240 ? 12 : 8;
  const rand = rng(inp.seed + 7);
  const roads: Rect[] = [];
  const walkways: Rect[] = [];
  const halls: HallBox[] = [];
  const sites: Site[] = [];
  const stations: Station[] = [];
  const walks: Walk[] = [];
  const decor: Decor[] = [];

  let y = TREE_BAND;
  roads.push({ x: 0, y, w: W, h: ROAD_H });
  y += ROAD_H + 4;

  // headquarters and the delivery lot
  const hqW = W >= 260 ? 80 : 68;
  const floors = Math.max(1, Math.min(6, 1 + Math.floor((inp.level - 1) / 2)));
  const hqH = 10 + 16 + 8 + 10 * floors + 3;
  const hq = { x: M, y, w: hqW, h: hqH, floors, streak: inp.streak, total: inp.total, level: inp.level };
  const lotX = M + hqW + 10;
  const lotW = W - M - lotX;
  const cols = Math.max(1, Math.floor((lotW - 4) / SPOT_W));
  const lotRows = Math.max(1, Math.min(3, 1 + Math.floor(inp.level / 5), Math.ceil(Math.max(1, inp.today) / cols)));
  const lot = {
    x: lotX,
    y: y + 10,
    w: lotW,
    h: lotRows * SPOT_H + 10,
    spots: [] as Rect[],
    cars: 0,
    today: inp.today,
  };
  const spotX = lot.x + Math.floor((lotW - cols * SPOT_W) / 2);
  for (let r = 0; r < lotRows; r++)
    for (let c = 0; c < cols; c++) lot.spots.push({ x: spotX + c * SPOT_W, y: lot.y + 5 + r * SPOT_H, w: SPOT_W, h: SPOT_H });
  lot.cars = Math.min(inp.today, lot.spots.length);
  let blockBottom = Math.max(hq.y + hq.h, lot.y + lot.h);
  // the yard under the lot: containers (warehouse upgrade) and oil barrels (machine oil)
  const containers = upgradeLevel(inp.upgrades, "lagerhalle");
  const barrels = upgradeLevel(inp.upgrades, "schmieroel");
  if (containers + barrels > 0) {
    const cy = lot.y + lot.h + 4;
    let cx = lot.x;
    for (let i = 0; i < containers && cx + 24 <= W - M; i++, cx += 26) decor.push({ kind: "container", x: cx, y: cy, v: i });
    for (let i = 0; i < barrels && cx + 8 <= W - M; i++) {
      decor.push({ kind: "barrel", x: cx, y: cy + 2, v: i });
      cx += 9;
    }
    blockBottom = Math.max(blockBottom, cy + 14);
  }
  y = blockBottom + 4;

  const builtTotal = inp.halls.reduce((n, h) => n + h.items.filter((i) => i.stage > 0).length, 0);
  const walkerBudget = { n: Math.min(24, 2 + Math.floor(builtTotal / 5)) };

  const addWalkway = () => {
    const r = { x: 0, y, w: W, h: WALK_H };
    walkways.push(r);
    decor.push({ kind: "lamp", x: Math.max(0, M - 8), y: y + WALK_H - 18, v: 0 });
    decor.push({ kind: "lamp", x: W - M + 1, y: y + WALK_H - 18, v: 1 });
    if (walkerBudget.n > 0) {
      walkerBudget.n--;
      walks.push({ who: "worker", x0: M, x1: W - M - 12, y: y + WALK_H - 2, speed: 9 + rand() * 6, phase: rand() });
    }
    y += WALK_H;
  };

  addWalkway();
  const bosses = upgradeLevel(inp.upgrades, "schichtleiter");
  for (let i = 0; i < bosses; i++) {
    const wk = walkways[0];
    walks.push({ who: "boss", x0: M, x1: W - M - 12, y: wk.y + WALK_H - 2, speed: 7 + i, phase: (i + 1) / (bosses + 1) });
  }

  for (const h of inp.halls) {
    if (!h.unlocked) {
      sites.push({ id: h.id, x: M, y, w: W - 2 * M, h: SITE_H, sign: SIGNS[h.id], unlockLevel: h.unlockLevel });
      decor.push({ kind: "cone", x: M + 6, y: y + SITE_H - 9, v: 0 });
      decor.push({ kind: "cone", x: W - M - 14, y: y + SITE_H - 9, v: 1 });
      y += SITE_H;
      addWalkway();
      continue;
    }
    const box = layoutHall(h, M, y, W - 2 * M, stations, walks, walkerBudget, rand, inp.upgrades);
    halls.push(box);
    y += box.h;
    addWalkway();
  }

  roads.push({ x: 0, y: y + 4, w: W, h: ROAD_H });
  y += 4 + ROAD_H + TREE_BAND;

  // scenery: tree borders top and bottom, flowers in the margins
  for (let x = -6; x < W; x += 16 + Math.floor(rand() * 6)) decor.push({ kind: "tree", x, y: TREE_BAND - 23 + Math.floor(rand() * 3), v: 0 });
  for (let x = -8; x < W; x += 16 + Math.floor(rand() * 6)) decor.push({ kind: "tree", x, y: y - TREE_BAND, v: 1 });
  const lastRoad = roads[roads.length - 1];
  for (let fy = roads[0].y + ROAD_H + 6; fy < lastRoad.y - 6; fy += 9 + Math.floor(rand() * 10)) {
    if (rand() < 0.6) decor.push({ kind: "flower", x: 1 + Math.floor(rand() * Math.max(1, M - 5)), y: fy, v: Math.floor(rand() * 3) });
    if (rand() < 0.6) decor.push({ kind: "flower", x: W - M + 1 + Math.floor(rand() * Math.max(1, M - 5)), y: fy, v: Math.floor(rand() * 3) });
  }
  if (M >= 12) {
    for (const hb of halls) {
      for (let ty = hb.y + 8; ty + 15 < hb.y + hb.h - 4; ty += 30 + Math.floor(rand() * 12)) {
        decor.push({ kind: rand() < 0.5 ? "smallTree" : "bush", x: Math.floor(M / 2) - 7, y: ty, v: 0 });
      }
    }
  }
  return { w: W, h: y, roads, walkways, hq, lot, halls, sites, stations, walks, decor };
}

function layoutHall(
  h: HallInput,
  x0: number,
  y0: number,
  hw: number,
  out: Station[],
  walks: Walk[],
  budget: { n: number },
  rand: () => number,
  upgrades: Partial<Record<UpgradeId, number>>,
): HallBox {
  const inner: Rect = { x: x0 + WALL, y: y0 + WALL + BACK, w: hw - 2 * WALL, h: 0 };
  const cx0 = inner.x + PAD;
  const cw = inner.w - 2 * PAD;
  const belts: Belt[] = [];
  const free: Rect[] = [];
  const healthy = h.items.filter((i) => i.stage > 0 && !i.due).length;
  const built = h.items.filter((i) => i.stage > 0).length;
  const speed =
    built === 0
      ? 0
      : 6 * (1 + 0.25 * h.level) * (1 + 0.15 * upgradeLevel(upgrades, "fliessband")) * (0.35 + (0.65 * healthy) / built);

  // group the items into stations, big machines first
  type Spec = { kind: StationKind; items: StationItem[] };
  const specs: Spec[] = [];
  const byKind = new Map<StationKind, StationItem[]>();
  for (const it of h.items) {
    const k = stationKind(h.id, it.kind);
    const list = byKind.get(k) ?? [];
    list.push({ id: it.id, stage: it.stage, due: it.due });
    byKind.set(k, list);
  }
  const order: StationKind[] = ["bigpress", "robot", "booth", "press", "bench", "rack"];
  for (const k of order) {
    const list = byKind.get(k);
    if (!list) continue;
    const perRow = Math.max(1, Math.floor((cw + STATION[k].gap) / (STATION[k].w + STATION[k].gap)));
    const slots = k === "rack" ? RACK_SLOTS : 1;
    const per = Math.max(1, Math.ceil(list.length / (perRow * MAX_ROWS[k] * slots)));
    for (let i = 0; i < list.length; i += slots * per) specs.push({ kind: k, items: list.slice(i, i + slots * per) });
  }
  const mainKind: StationKind = specs[specs.length - 1]?.kind ?? stationKind(h.id, h.id === "verben" ? "verb" : h.id === "redemittel" ? "expr" : h.id === "woerter" ? "noun" : "gram");

  let y = inner.y + PAD;
  let n = 0;
  let i = 0;
  while (i < specs.length) {
    const kind = specs[i].kind;
    const st = STATION[kind];
    const perRow = Math.max(1, Math.floor((cw + st.gap) / (st.w + st.gap)));
    const rowW = perRow * st.w + (perRow - 1) * st.gap;
    const rx = cx0 + Math.floor((cw - rowW) / 2);
    let col = 0;
    const rowItems: Station[] = [];
    while (i < specs.length && specs[i].kind === kind && col < perRow) {
      const sp = specs[i];
      const due = sp.items.some((x) => x.due);
      // A machine that stands for several items looks like the weakest of them.
      const single = sp.items.reduce((a, b) => (b.stage < a.stage ? b : a), sp.items[0]);
      const s: Station = {
        kind,
        hall: h.id,
        items: sp.items,
        x: rx + col * (st.w + st.gap),
        y,
        w: st.w,
        h: st.h,
        look: kind === "rack" ? (due ? "rust" : "work") : lookOf(single.stage, single.due),
        due,
        n: n++,
      };
      out.push(s);
      rowItems.push(s);
      col++;
      i++;
    }
    const lastOfKind = i >= specs.length || specs[i].kind !== kind;
    if (lastOfKind && kind === mainKind) {
      for (let c = col; c < perRow; c++) free.push({ x: rx + c * (st.w + st.gap), y, w: st.w, h: st.h });
    }
    if (kind === "robot") belts.push({ x: inner.x + 1, y: y + 5, w: inner.w - 2, h: 12, speed, carry: "car" });
    if (kind === "press" || kind === "bigpress") belts.push({ x: inner.x + 1, y: y + st.h + 1, w: inner.w - 2, h: 5, speed, carry: "panel" });
    const aisleY = y + st.h + st.aisle;
    if (kind === "rack" && rowItems.length >= 2 && budget.n > 0) {
      budget.n--;
      walks.push({ who: "forklift", x0: inner.x + 2, x1: inner.x + inner.w - 20, y: aisleY - 1, speed: 10 + rand() * 6, phase: rand() });
    } else if (rowItems.length >= 3 && budget.n > 0) {
      budget.n--;
      walks.push({ who: "worker", x0: inner.x + 2, x1: inner.x + inner.w - 14, y: aisleY - 1, speed: 7 + rand() * 6, phase: rand() });
    }
    y += st.h + st.aisle;
  }

  let note: string | undefined;
  if (specs.length === 0) {
    const st = STATION[mainKind];
    const perRow = Math.max(1, Math.floor((cw + st.gap) / (st.w + st.gap)));
    const rowW = perRow * st.w + (perRow - 1) * st.gap;
    const rx = cx0 + Math.floor((cw - rowW) / 2);
    for (let c = 0; c < perRow; c++) free.push({ x: rx + c * (st.w + st.gap), y, w: st.w, h: st.h });
    y += st.h + st.aisle;
    note = "Bauplan im Laden holen";
  }

  inner.h = y - inner.y + PAD - 4;
  const height = inner.y + inner.h + WALL - y0;
  const gateW = 20;
  return {
    id: h.id,
    sign: SIGNS[h.id],
    level: h.level,
    x: x0,
    y: y0,
    w: hw,
    h: height,
    inner,
    gate: { x: x0 + Math.floor((hw - gateW) / 2), w: gateW },
    belts,
    free,
    note,
    built,
    total: h.items.length,
  };
}
