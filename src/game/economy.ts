import type { Catalog } from "../content/catalog";
import type { HallId, Item, ItemKind } from "../content/types";
import type { TargetStatus } from "../ai/schema";
import { rustOf, stageOf, type CardState } from "../engine/srs";
import type { TaskType } from "../engine/tasks";
import type { GameState } from "./state";
import { level } from "./upgrades";

const HOUR = 3_600_000;

/** Taler per hour for one machine at stage 1. Grammar machines are the big ones. */
const BASE_RATE: Record<ItemKind, number> = { noun: 2, verb: 2.4, adj: 1.6, adv: 1.6, word: 1.6, expr: 3, gram: 6 };
/** Output multiplier by stage 0–5 (blueprints produce nothing). */
export const STAGE_MULT = [0, 1, 1.6, 2.4, 3.4, 5];

const BASE_COST: Record<ItemKind, number> = { noun: 40, verb: 50, adj: 35, adv: 35, word: 35, expr: 60, gram: 120 };

export function rustFloor(s: GameState): number {
  return 0.1 + 0.1 * level(s.upgrades, "schmieroel");
}

export function hallMult(s: GameState, hall: HallId): number {
  return 1 + 0.25 * level(s.upgrades, `halle_${hall}`);
}

export function globalMult(s: GameState): number {
  return 1 + 0.15 * level(s.upgrades, "fliessband");
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

export function factoryRate(s: GameState, catalog: Catalog, now: number): number {
  let sum = 0;
  for (const c of Object.values(s.cards)) {
    const it = catalog.get(c.id);
    if (it) sum += machineRate(s, it, c, now);
  }
  return sum;
}

/** Hours of production that pile up while the app is closed. */
export function storageHours(s: GameState): number {
  return 8 + 4 * level(s.upgrades, "lagerhalle");
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

/** Price of a blueprint. Grows with the number of machines you already own. */
export function unlockCost(s: GameState, it: Item): number {
  const owned = Object.keys(s.cards).length;
  return Math.round(BASE_COST[it.kind] * Math.pow(1 + owned / 15, 1.8));
}

const QUALITY = { perfect: 1, minor: 0.75, major: 0.45 } as const;
const STATUS: Record<TargetStatus, number> = { correct: 1, flawed: 0.7, synonym: 0.5, wrong: 0.25, missing: 0.15 };
const TYPE: Record<TaskType, number> = { intro: 0, produce: 1, translate: 1.1, transform: 1, combo: 1.6 };

export function comboCap(s: GameState): number {
  return 2 + 0.5 * level(s.upgrades, "kombipresse");
}

/** Taler for one graded answer. Never zero: effort always pays a little. */
export function taskReward(
  s: GameState,
  rate: number,
  r: {
    type: TaskType;
    quality: keyof typeof QUALITY;
    statuses: TargetStatus[];
    words: number;
    /** Average rust of the targets before repair (0–1). */
    rust: number;
  },
): number {
  const base = 10 + 0.15 * rate;
  const targets = r.statuses.reduce((a, st) => a + STATUS[st], 0) / Math.max(1, r.statuses.length);
  const length = r.words >= 10 ? 1.2 : 1;
  const repair = 1 + 0.25 * r.rust;
  const meister = 1 + 0.15 * level(s.upgrades, "meisterbrief");
  return Math.max(1, Math.round(base * QUALITY[r.quality] * targets * TYPE[r.type] * length * repair * s.combo * meister));
}

export function drillReward(rate: number, streak: number): number {
  return Math.max(1, Math.round((2 + 0.03 * rate) * (1 + Math.min(streak, 10) * 0.1)));
}

export function shiftBonus(s: GameState, rate: number): number {
  return Math.round((30 + 0.5 * rate) * (1 + 0.5 * level(s.upgrades, "schichtleiter")));
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
