import type { Catalog } from "../content/catalog";
import type { HallId, Item, ItemKind } from "../content/types";
import type { TargetStatus } from "../ai/schema";
import { rustOf, stageOf, type CardState } from "../engine/srs";
import type { TaskType } from "../engine/tasks";
import type { GameState } from "./state";
import { buildingBonus, level } from "./upgrades";

const HOUR = 3_600_000;

/*
 * Everything is measured in sentences. Writing one sentence yourself pays "Taler pro
 * Satz". Staff and machines also make sentence-equivalents while the app is closed,
 * slowly: a worker makes one every 250 hours. Their Taler value grows with the same
 * toolbox but with its own multipliers (production instead of per-sentence), so writing
 * stays the main income and the idle part a bonus.
 */

/** Sentence-equivalents per hour from each worker, forklift and truck. */
const STAFF_UNITS = { arbeiter: 0.004, gabelstapler: 0.016, lkw: 0.04 } as const;
/** Weight of one machine at stage 1, by kind: grammar machines are the big ones. */
const MACHINE_WEIGHT: Record<ItemKind, number> = { noun: 1, verb: 1.2, adj: 0.8, adv: 0.8, word: 0.8, expr: 1.5, gram: 3 };
/** Output weight by stage 0–5 (blueprints produce nothing). */
export const STAGE_MULT = [0, 1, 1.6, 2.4, 3.4, 5];
/**
 * A hall makes MACHINE_K × √(sum of its machines' weights) sentence-equivalents per
 * hour: every machine adds, but with diminishing returns, so a giant word import does
 * not outgrow writing.
 */
const MACHINE_K = 0.004;

export function rustFloor(s: GameState): number {
  return Math.min(0.9, 0.1 + 0.1 * level(s.upgrades, "schmieroel") + buildingBonus(s.upgrades, "rust"));
}

export function hallMult(s: GameState, hall: HallId): number {
  return 1 + 0.25 * level(s.upgrades, `halle_${hall}`);
}

/** HQ floors and export markets (+5 % each) and buildings that boost everything. */
export function allMult(s: GameState): number {
  return (1 + 0.05 * level(s.upgrades, "verwaltung") + 0.05 * level(s.upgrades, "export")) * (1 + buildingBonus(s.upgrades, "all"));
}

/** Multiplier on what is produced while away: conveyors and production buildings. */
export function prodMult(s: GameState): number {
  return (1 + 0.15 * level(s.upgrades, "fliessband")) * (1 + buildingBonus(s.upgrades, "prod"));
}

/** Multiplier on written sentences: master's certificates and buildings like the canteen. */
export function satzMult(s: GameState): number {
  return Math.pow(1.25, level(s.upgrades, "meisterbrief")) * (1 + buildingBonus(s.upgrades, "satz"));
}

/** Taler for one sentence before quality and combo: 1 to start, more with every Werkstatt upgrade. */
export function perSentence(s: GameState): number {
  return (1 + level(s.upgrades, "werkzeug")) * satzMult(s) * allMult(s);
}

/** Taler for one sentence-equivalent made while away. */
export function unitValue(s: GameState): number {
  return (1 + level(s.upgrades, "werkzeug")) * prodMult(s) * allMult(s);
}

/** Sentence-equivalents per hour from the staff. */
export function staffUnits(s: GameState): number {
  const u = s.upgrades;
  return STAFF_UNITS.arbeiter * level(u, "arbeiter") + STAFF_UNITS.gabelstapler * level(u, "gabelstapler") + STAFF_UNITS.lkw * level(u, "lkw");
}

/** Taler per hour from workers, forklifts and trucks. */
export function staffRate(s: GameState): number {
  return staffUnits(s) * unitValue(s);
}

function machineWeight(s: GameState, it: Item, card: CardState, now: number): number {
  const stage = stageOf(card);
  if (stage === 0) return 0;
  const condition = 1 - rustOf(card, now) * (1 - rustFloor(s));
  return MACHINE_WEIGHT[it.kind] * STAGE_MULT[stage] * condition;
}

/** Per hall: the summed machine weight and the sentence-equivalents per hour it makes. */
type HallOutput = Map<HallId, { weight: number; units: number }>;
const outputCache = new WeakMap<object, { key: string; out: HallOutput }>();

export function hallOutput(s: GameState, catalog: Catalog, now: number): HallOutput {
  // Cards change in place inside one update (a graded answer, a new blueprint), so the key
  // also follows the number of cards and sentences, not only the object and the minute.
  const key = `${Math.floor(now / 60_000)}|${Object.keys(s.cards).length}|${s.stats.sentences}|${s.updatedAt}|${JSON.stringify(s.upgrades)}`;
  const hit = outputCache.get(s.cards);
  if (hit && hit.key === key) return hit.out;
  const out: HallOutput = new Map();
  for (const c of Object.values(s.cards)) {
    const it = catalog.get(c.id);
    if (!it) continue;
    const w = machineWeight(s, it, c, now);
    if (w <= 0) continue;
    const h = out.get(it.hall) ?? { weight: 0, units: 0 };
    h.weight += w;
    out.set(it.hall, h);
  }
  for (const [hall, h] of out) h.units = MACHINE_K * Math.sqrt(h.weight) * hallMult(s, hall);
  outputCache.set(s.cards, { key, out });
  return out;
}

/** Taler per hour this machine makes right now: its share of its hall's output. */
export function machineRate(s: GameState, it: Item, card: CardState, now: number, catalog: Catalog): number {
  const w = machineWeight(s, it, card, now);
  if (w <= 0) return 0;
  const h = hallOutput(s, catalog, now).get(it.hall);
  if (!h || h.weight <= 0) return 0;
  return (h.units * w) / h.weight * unitValue(s);
}

/** All production per hour: machines plus staff. */
export function factoryRate(s: GameState, catalog: Catalog, now: number): number {
  let units = staffUnits(s);
  for (const h of hallOutput(s, catalog, now).values()) units += h.units;
  return units * unitValue(s);
}

/** Hours of production that pile up while the app is closed. */
export function storageHours(s: GameState): number {
  return 8 + 4 * level(s.upgrades, "lagerhalle") + level(s.upgrades, "lkw") + buildingBonus(s.upgrades, "lager");
}

/** Experience multiplier from the training buildings. */
export function xpMult(s: GameState): number {
  return 1 + buildingBonus(s.upgrades, "xp");
}

/**
 * Idle production between lastTick and now, capped by storage. Rust grows
 * while you are away, so production is integrated over a few sample points.
 */
export function idleEarnings(s: GameState, catalog: Catalog, now: number): { amount: number; hours: number; capped: boolean } {
  const elapsed = Math.max(0, now - s.lastTick);
  const cap = storageHours(s) * HOUR;
  const span = Math.min(elapsed, cap);
  if (span <= 0) return { amount: 0, hours: 0, capped: false };
  const steps = span > HOUR ? 4 : 1;
  let amount = 0;
  for (let i = 0; i < steps; i++) {
    const t = s.lastTick + ((i + 0.5) / steps) * span;
    amount += factoryRate(s, catalog, t) * (span / steps / HOUR);
  }
  return { amount, hours: span / HOUR, capped: elapsed > cap };
}

const QUALITY = { perfect: 1, minor: 0.75, major: 0.5 } as const;
const STATUS: Record<TargetStatus, number> = { correct: 1, flawed: 0.7, synonym: 0.5, wrong: 0.25, missing: 0.15 };
const TYPE: Record<TaskType, number> = { intro: 0, produce: 1, translate: 1, transform: 1, combo: 1.5 };

export function comboCap(s: GameState): number {
  return 2 + 0.5 * level(s.upgrades, "kombipresse");
}

/**
 * Taler for one graded answer: Taler per sentence × quality × combo. A clean
 * sentence at combo 1 pays exactly "Taler pro Satz". Never zero: effort always pays.
 */
export function taskReward(
  s: GameState,
  r: {
    type: TaskType;
    quality: keyof typeof QUALITY;
    statuses: TargetStatus[];
    /** Average rust of the targets before repair (0–1). */
    rust: number;
    /** Machines built with this answer. */
    built: number;
  },
): number {
  const targets = r.statuses.reduce((a, st) => a + STATUS[st], 0) / Math.max(1, r.statuses.length);
  const repair = 1 + 0.5 * r.rust;
  const build = 1 + r.built;
  return Math.max(1, Math.round(perSentence(s) * QUALITY[r.quality] * targets * TYPE[r.type] * repair * build * s.combo));
}

export function drillReward(s: GameState, streak: number): number {
  return Math.max(1, Math.round(perSentence(s) * 0.25 * (1 + Math.min(streak, 10) * 0.1)));
}

export function shiftBonus(s: GameState): number {
  return Math.round(perSentence(s) * 5 * (1 + 0.5 * level(s.upgrades, "schichtleiter")));
}

export function drillSeconds(s: GameState): number {
  return 60 + 15 * level(s.upgrades, "akkorduhr");
}

/** Factory level from XP: L2 at 100, L3 at 303, L4 at 580, L5 at 919, … */
export function levelOf(xp: number): number {
  return Math.floor(Math.pow(Math.max(0, xp) / 100, 1 / 1.6)) + 1;
}

export function xpForLevel(lvl: number): number {
  return Math.ceil(100 * Math.pow(lvl - 1, 1.6));
}

/** Compact number display: 1.234 → 1,2 Tsd. etc. (German style). */
/** A production rate for people: per hour when it is at least 10 an hour, otherwise per day. */
/** A rate as number and unit: per hour, or per day while it is too small to read per hour. */
export function rateParts(perHour: number): { n: string; unit: "Stunde" | "Tag" } {
  if (perHour >= 10) return { n: fmt(perHour), unit: "Stunde" };
  const day = perHour * 24;
  return { n: day >= 10 ? fmt(day) : day.toLocaleString("de-DE", { maximumFractionDigits: 1 }), unit: "Tag" };
}

export function fmtRate(perHour: number, short = false): string {
  const { n, unit } = rateParts(perHour);
  if (short) return `+${n}/${unit === "Stunde" ? "h" : "Tag"}`;
  return `${n} Taler pro ${unit}`;
}

export function fmt(n: number): string {
  const a = Math.abs(n);
  if (a < 1000) return Math.floor(n).toLocaleString("de-DE");
  const units = [
    [1e12, "Bio."],
    [1e9, "Mrd."],
    [1e6, "Mio."],
    [1e3, "Tsd."],
  ] as const;
  for (const [v, u] of units) {
    if (a >= v) return `${(n / v).toLocaleString("de-DE", { maximumFractionDigits: n / v >= 100 ? 0 : 1 })} ${u}`;
  }
  return String(Math.floor(n));
}
