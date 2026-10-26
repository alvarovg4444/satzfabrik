import type { Catalog } from "../content/catalog";
import { HALLS, type HallId, type ItemKind } from "../content/types";
import { isDue, stageOf } from "../engine/srs";
import { dayKey } from "../engine/text";
import { hallUnlocked } from "../game/actions";
import { levelOf } from "../game/economy";
import type { GameState } from "../game/state";
import { BUILDINGS, UPGRADE_BY_ID, level as upgradeLevel, type BuildingId, type UpgradeId } from "../game/upgrades";

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
  who: "worker" | "boss" | "trainee" | "forklift";
  x0: number;
  x1: number;
  /** Feet line. */
  y: number;
  speed: number;
  phase: number;
}

export type DecorKind =
  | "tree"
  | "smallTree"
  | "bush"
  | "lamp"
  | "flower"
  | "barrel"
  | "cone"
  | "container"
  /** Tool shed, v = size 0–2 (toolbox upgrade). */
  | "shed"
  /** Combo press in the yard, animated. */
  | "combopress"
  /** Clock on a post next to the HQ, showing the real time. */
  | "clock";

export interface Decor {
  kind: DecorKind;
  x: number;
  y: number;
  v: number;
}

/** A big project on the factory grounds, or the plot for the next one. */
export interface Building extends Rect {
  id: BuildingId;
  /** false: the next plot, fenced off, with its price on a sign. */
  built: boolean;
  price: number;
  sign: string;
}

export interface FactoryScene {
  w: number;
  h: number;
  roads: Rect[];
  walkways: Rect[];
  /** floors from the HQ upgrade, stars from the master's certificate. */
  hq: Rect & { floors: number; streak: number; total: number; level: number; stars: number };
  lot: Rect & { spots: Rect[]; cars: number; today: number };
  buildings: Building[];
  halls: HallBox[];
  sites: Site[];
  stations: Station[];
  walks: Walk[];
  decor: Decor[];
  /** Trucks in the fleet: how many of the vehicles on the roads are the factory's own car transporters. */
  fleet: number;
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

/** Footprints on the factory grounds; w 0 spans the whole width (rail siding, test track). */
export const BUILDING_SIZE: Record<BuildingId, { w: number; h: number }> = {
  kantine: { w: 62, h: 40 },
  wasserturm: { w: 30, h: 52 },
  parkhaus: { w: 60, h: 46 },
  ausbildung: { w: 64, h: 44 },
  solarpark: { w: 70, h: 34 },
  bahn: { w: 0, h: 24 },
  teststrecke: { w: 0, h: 56 },
  heliport: { w: 46, h: 42 },
};
/** The fenced plot for the next building. */
export const PLOT = { w: 58, h: 34 };

const BUILDING_SIGNS: Record<BuildingId, string> = {
  kantine: "Kantine",
  wasserturm: "Wasserturm",
  parkhaus: "Parkhaus",
  ausbildung: "Ausbildung",
  solarpark: "Solarpark",
  bahn: "Gleis",
  teststrecke: "Teststrecke",
  heliport: "Heliport",
};

/** Tool shed sizes by toolbox level: 1–9, 10–19, 20+. */
export const SHED = [
  { w: 20, h: 16 },
  { w: 26, h: 18 },
  { w: 32, h: 20 },
];

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
  const up = (id: UpgradeId) => upgradeLevel(inp.upgrades, id);
  const roads: Rect[] = [];
  const walkways: Rect[] = [];
  const halls: HallBox[] = [];
  const sites: Site[] = [];
  const stations: Station[] = [];
  const walks: Walk[] = [];
  const decor: Decor[] = [];
  const lines: Line[] = [];
  const aisles: Aisle[] = [];

  let y = TREE_BAND;
  roads.push({ x: 0, y, w: W, h: ROAD_H });
  y += ROAD_H + 4;

  // headquarters (one floor more per HQ upgrade) and the delivery lot
  const hqW = W >= 260 ? 80 : 68;
  const floors = 1 + Math.min(6, up("verwaltung"));
  const hqH = 10 + 16 + 8 + 10 * floors + 3;
  const hq = { x: M, y, w: hqW, h: hqH, floors, streak: inp.streak, total: inp.total, level: inp.level, stars: up("meisterbrief") };
  if (up("akkorduhr") > 0) decor.push({ kind: "clock", x: hq.x + hq.w + 1, y: hq.y + hq.h - 22, v: 0 });
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
  const yardBottom = layoutYard(inp.upgrades, lot.x, lot.y + lot.h + 4, lot.w, decor);
  y = Math.max(hq.y + hq.h, lot.y + lot.h, yardBottom) + 6;

  // the factory grounds: buildings bought with Taler, and the plot for the next one
  const campus = layoutCampus(inp.upgrades, M, y, W - 2 * M, walks);
  if (campus.buildings.length) y += campus.h + 6;

  const addWalkway = () => {
    walkways.push({ x: 0, y, w: W, h: WALK_H });
    decor.push({ kind: "lamp", x: Math.max(0, M - 8), y: y + WALK_H - 18, v: 0 });
    decor.push({ kind: "lamp", x: W - M + 1, y: y + WALK_H - 18, v: 1 });
    lines.push({ x0: M, x1: W - M - 12, y: y + WALK_H - 2 });
    y += WALK_H;
  };

  addWalkway();
  for (const h of inp.halls) {
    if (!h.unlocked) {
      sites.push({ id: h.id, x: M, y, w: W - 2 * M, h: SITE_H, sign: SIGNS[h.id], unlockLevel: h.unlockLevel });
      decor.push({ kind: "cone", x: M + 6, y: y + SITE_H - 9, v: 0 });
      decor.push({ kind: "cone", x: W - M - 14, y: y + SITE_H - 9, v: 1 });
      y += SITE_H;
      addWalkway();
      continue;
    }
    const box = layoutHall(h, M, y, W - 2 * M, stations, aisles, inp.upgrades);
    halls.push(box);
    y += box.h;
    addWalkway();
  }
  placeStaff(inp.upgrades, lines, aisles, walks, rand);

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
  return { w: W, h: y, roads, walkways, hq, lot, buildings: campus.buildings, halls, sites, stations, walks, decor, fleet: up("lkw") };
}

/** A walkway between the halls: people walk on it in two lanes, 4 px apart. */
interface Line {
  x0: number;
  x1: number;
  /** Feet line of the front lane. */
  y: number;
}

/** The aisle under a row of machines. */
interface Aisle {
  x0: number;
  x1: number;
  y: number;
  rack: boolean;
}

/**
 * The yard under the delivery lot: tool shed (toolbox), combo press, containers
 * (warehouse) and oil barrels, in rows. Returns the bottom edge.
 */
function layoutYard(upgrades: Partial<Record<UpgradeId, number>>, x0: number, y0: number, w: number, decor: Decor[]): number {
  const things: { kind: DecorKind; w: number; h: number; v: number }[] = [];
  const tools = upgradeLevel(upgrades, "werkzeug");
  if (tools > 0) {
    const v = tools >= 20 ? 2 : tools >= 10 ? 1 : 0;
    things.push({ kind: "shed", ...SHED[v], v });
  }
  const combo = upgradeLevel(upgrades, "kombipresse");
  if (combo > 0) things.push({ kind: "combopress", w: 20, h: 22, v: combo });
  for (let i = 0; i < upgradeLevel(upgrades, "lagerhalle"); i++) things.push({ kind: "container", w: 24, h: 12, v: i });
  for (let i = 0; i < upgradeLevel(upgrades, "schmieroel"); i++) things.push({ kind: "barrel", w: 8, h: 10, v: i });
  if (!things.length) return y0 - 4;
  const GAP = 3;
  const rows: (typeof things)[] = [[]];
  let used = 0;
  for (const t of things) {
    const row = rows[rows.length - 1];
    if (row.length && used + GAP + t.w > w) {
      rows.push([t]);
      used = t.w;
    } else {
      row.push(t);
      used += (row.length > 1 ? GAP : 0) + t.w;
    }
  }
  let y = y0;
  for (const row of rows) {
    const rh = Math.max(...row.map((t) => t.h));
    let x = x0;
    for (const t of row) {
      decor.push({ kind: t.kind, x, y: y + rh - t.h, v: t.v });
      x += t.w + GAP;
    }
    y += rh + GAP;
  }
  return y - GAP;
}

/**
 * Buildings on the factory grounds, in the order of the shop, plus the fenced plot of
 * the cheapest one not built yet. Small buildings share rows and stand on one ground
 * line; the rail siding and the test track take the full width.
 */
function layoutCampus(
  upgrades: Partial<Record<UpgradeId, number>>,
  x0: number,
  y0: number,
  w: number,
  walks: Walk[],
): { buildings: Building[]; h: number } {
  const owned = (id: BuildingId) => upgradeLevel(upgrades, id) > 0;
  const next = BUILDINGS.filter((id) => !owned(id)).sort((a, b) => UPGRADE_BY_ID.get(a)!.base - UPGRADE_BY_ID.get(b)!.base)[0];
  const shown = BUILDINGS.filter((id) => owned(id) || id === next);
  const GAP = 6;
  type Cell = { id: BuildingId; w: number; h: number; built: boolean };
  const rows: { cells: Cell[]; wide: boolean }[] = [];
  let used = 0;
  for (const id of shown) {
    const built = id !== next;
    const size = built ? BUILDING_SIZE[id] : PLOT;
    if (size.w === 0) {
      rows.push({ cells: [{ id, w, h: size.h, built }], wide: true });
      continue;
    }
    const cell = { id, w: Math.min(w, size.w), h: size.h, built };
    const row = rows[rows.length - 1];
    if (row && !row.wide && used + GAP + cell.w <= w) {
      row.cells.push(cell);
      used += GAP + cell.w;
    } else {
      rows.push({ cells: [cell], wide: false });
      used = cell.w;
    }
  }
  const buildings: Building[] = [];
  let y = y0;
  for (const row of rows) {
    const rh = Math.max(...row.cells.map((c) => c.h));
    const total = row.cells.reduce((n, c) => n + c.w, 0) + GAP * (row.cells.length - 1);
    let x = x0 + Math.floor((w - total) / 2);
    for (const c of row.cells) {
      buildings.push({ id: c.id, built: c.built, price: UPGRADE_BY_ID.get(c.id)!.base, sign: BUILDING_SIGNS[c.id], x, y: y + rh - c.h, w: c.w, h: c.h });
      x += c.w + GAP;
    }
    y += rh + GAP;
  }
  // apprentices in green helmets cross the forecourt of the training centre
  const school = buildings.find((b) => b.id === "ausbildung" && b.built);
  if (school) {
    walks.push({ who: "trainee", x0: school.x + 2, x1: school.x + school.w - 14, y: school.y + school.h - 1, speed: 6, phase: 0.15 });
    walks.push({ who: "trainee", x0: school.x + 2, x1: school.x + school.w - 14, y: school.y + school.h - 5, speed: 8, phase: 0.6 });
  }
  return { buildings, h: Math.max(0, y - y0 - GAP) };
}

/**
 * Staff from the shop: forklifts take the warehouse aisles first, then other aisles,
 * then the back lane of the walkways. Workers (one is always there, plus one per
 * hire) fill the walkways, then the free aisles, then more lanes. Shift supervisors
 * walk one per walkway from the top.
 */
function placeStaff(upgrades: Partial<Record<UpgradeId, number>>, lines: Line[], aisles: Aisle[], walks: Walk[], rand: () => number): void {
  if (!lines.length) return;
  let forklifts = upgradeLevel(upgrades, "gabelstapler");
  const busy = new Set<Aisle>();
  for (const a of [...aisles.filter((a) => a.rack), ...aisles.filter((a) => !a.rack)]) {
    if (forklifts <= 0) break;
    walks.push({ who: "forklift", x0: a.x0, x1: a.x1 - 18, y: a.y, speed: 10 + rand() * 6, phase: rand() });
    busy.add(a);
    forklifts--;
  }
  const backTaken = new Set<number>();
  for (let i = 0; forklifts > 0 && i < lines.length; i++, forklifts--) {
    const l = lines[i];
    walks.push({ who: "forklift", x0: l.x0, x1: l.x1 - 6, y: l.y - 4, speed: 10 + rand() * 6, phase: rand() });
    backTaken.add(i);
  }
  let workers = 1 + upgradeLevel(upgrades, "arbeiter");
  const put = (x0: number, x1: number, y: number) => {
    walks.push({ who: "worker", x0, x1, y, speed: 7 + rand() * 7, phase: rand() });
    workers--;
  };
  for (const l of lines) if (workers > 0) put(l.x0, l.x1, l.y);
  for (const a of aisles) if (workers > 0 && !busy.has(a)) put(a.x0, a.x1 - 12, a.y);
  for (let round = 0; round < 3 && workers > 0; round++) {
    const back = round % 2 === 0;
    lines.forEach((l, i) => {
      if (workers > 0 && !(back && backTaken.has(i))) put(l.x0, l.x1, back ? l.y - 4 : l.y);
    });
  }
  const bosses = upgradeLevel(upgrades, "schichtleiter");
  for (let i = 0; i < bosses; i++) {
    const l = lines[i % lines.length];
    walks.push({ who: "boss", x0: l.x0, x1: l.x1, y: l.y, speed: 6 + i, phase: (0.5 + i * 0.37) % 1 });
  }
}

function layoutHall(
  h: HallInput,
  x0: number,
  y0: number,
  hw: number,
  out: Station[],
  aisles: Aisle[],
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
    if (rowItems.length >= 2) aisles.push({ x0: inner.x + 2, x1: inner.x + inner.w - 2, y: y + st.h + st.aisle - 1, rack: kind === "rack" });
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
    note = "Wartet auf Lieferung";
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
