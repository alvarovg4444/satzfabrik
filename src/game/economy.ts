import type { Catalog } from "../content/catalog";
import type { HallId, Item, ItemKind } from "../content/types";
import type { TargetStatus } from "../ai/schema";
import { rustOf, stageOf, type CardState } from "../engine/srs";
import type { TaskType } from "../engine/tasks";
import type { GameState } from "./state";
import { has, level } from "./upgrades";

const HOUR = 3_600_000;

/**
 * Taler per hour for one machine at stage 1. Machines are the steady, slow income;
 * the fast income is writing (Taler per sentence) and the staff you hire.
 */
const BASE_RATE: Record<ItemKind, number> = { noun: 0.3, verb: 0.35, adj: 0.25, adv: 0.25, word: 0.25, expr: 0.45, gram: 0.9 };
/** Output multiplier by stage 0–5 (blueprints produce nothing). */
export const STAGE_MULT = [0, 1, 1.6, 2.4, 3.4, 5];

/** Taler per hour from each hired worker, forklift and truck. */
const STAFF_RATE = { arbeiter: 1, gabelstapler: 5, lkw: 15 } as const;

export function rustFloor(s: GameState): number {
  return 0.1 + 0.1 * level(s.upgrades, "schmieroel");
}

export function hallMult(s: GameState, hall: HallId): number {
  return 1 + 0.25 * level(s.upgrades, `halle_${hall}`);
}

/** Bonus from the HQ floors: +5 % on everything per floor. */
function hqMult(s: GameState): number {
  return (1 + 0.05 * level(s.upgrades, "verwaltung")) * (has(s.upgrades, "heliport") ? 1.5 : 1);
}

/** Multiplier on everything produced per hour. */
export function globalMult(s: GameState): number {
  const u = s.upgrades;
  return (
    (1 + 0.15 * level(u, "fliessband")) *
    (has(u, "parkhaus") ? 1.2 : 1) *
    (has(u, "solarpark") ? 1.3 : 1) *
    (has(u, "bahn") ? 1.3 : 1) *
    hqMult(s)
  );
}

/** Taler for one sentence before quality and combo: 1 to start, more with every Werkstatt upgrade. */
export function perSentence(s: GameState): number {
  const u = s.upgrades;
  return (
    (1 + level(u, "werkzeug")) *
    Math.pow(1.25, level(u, "meisterbrief")) *
    (has(u, "kantine") ? 1.25 : 1) *
    (has(u, "ausbildung") ? 1.2 : 1) *
    (has(u, "teststrecke") ? 1.5 : 1) *
    hqMult(s)
  );
}

/** Taler per hour this machine produces right now. */
export function machineRate(s: GameState, it: Item, card: CardState, now: number): number {
  const stage = stageOf(card);
  if (stage === 0) return 0;
  const rust = rustOf(card, now);
  const floor = rustFloor(s);
  const condition = 1 - rust * (1 - floor);
  return BASE_RATE[it.kind] * STAGE_MULT[stage] * condition * hallMult(s, it.hall) * globalMult(s);
}

/** Taler per hour from workers, forklifts and trucks. */
export function staffRate(s: GameState): number {
  const u = s.upgrades;
  const raw = STAFF_RATE.arbeiter * level(u, "arbeiter") + STAFF_RATE.gabelstapler * level(u, "gabelstapler") + STAFF_RATE.lkw * level(u, "lkw");
  return raw * globalMult(s);
}

/** All production per hour: machines plus staff. */
export function factoryRate(s: GameState, catalog: Catalog, now: number): number {
  let sum = staffRate(s);
  for (const c of Object.values(s.cards)) {
    const it = catalog.get(c.id);
    if (it) sum += machineRate(s, it, c, now);
  }
  return sum;
}

/** Hours of production that pile up while the app is closed. */
export function storageHours(s: GameState): number {
  return 8 + 4 * level(s.upgrades, "lagerhalle") + level(s.upgrades, "lkw") + (has(s.upgrades, "wasserturm") ? 4 : 0);
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
  const steps = span > HOUR ? 8 : 1;
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
