import type { TargetStatus } from "../ai/schema";
import type { Catalog } from "../content/catalog";
import type { ErrorType, HallId, Item, Level, TopicId } from "../content/types";
import type { CardState } from "./srs";
import { hash } from "./text";

/*
 * Level engine: estimates the learner's CEFR level from their own answers.
 *
 * Ability is a number on the CEFR scale (1 = A1, 2 = A2, 3 = B1, 4 = B2; 2.7 is
 * "A2, close to B1"), kept per area. Every graded use of an item is evidence: an item's
 * level is its difficulty, and a logistic model says how likely someone at the current
 * estimate gets it right. Better than expected moves the estimate up, worse moves it
 * down (an Elo-style update). First encounters count fully; items practised many
 * times count less, because success there shows memory more than level. The AI
 * corrector also rates each sentence it reads, which feeds a second, slower signal.
 */

export type Area = "wortschatz" | "verben" | "satzbau" | "faelle" | "redemittel";
export const AREAS: Area[] = ["wortschatz", "verben", "satzbau", "faelle", "redemittel"];
export const AREA_DE: Record<Area, string> = {
  wortschatz: "Wortschatz",
  verben: "Verben",
  satzbau: "Satzbau",
  faelle: "Fälle & Endungen",
  redemittel: "Redemittel",
};

export type Cefr = Level | "C1";
export const LEVEL_NUM: Record<Level, number> = { A1: 1, A2: 2, B1: 3, B2: 4 };
const BANDS: Level[] = ["A1", "A2", "B1", "B2"];

export interface Skill {
  theta: number;
  /** Weighted amount of evidence behind theta. */
  n: number;
}

export interface LevelState {
  areas: Record<Area, Skill>;
  /** Level the AI corrector reads off the sentences themselves (complexity and accuracy). */
  ai: Skill;
  /** Recent mistakes in A1 basics, decays daily; more of them means more refreshers. */
  basics: number;
  /** Day of the last decay. */
  day?: string;
  /** Set once the estimate was seeded from answers given before the engine existed. */
  seeded?: boolean;
}

/** B2 material opens per area once the estimate reaches "B1+". */
export const B2_UNLOCK = 3.6;

/** Is this item's level open to the learner yet? (Only B2 is ever closed.) */
export function levelOpen(ls: LevelState, it: Item): boolean {
  return it.level !== "B2" || ls.areas[areaOf(it)].theta >= B2_UNLOCK;
}

/** The app is made for A2–B1 learners, so the estimate starts in the middle and moves fast at first. */
export const START_THETA = 2.5;

export function newLevelState(theta = START_THETA): LevelState {
  const areas = {} as Record<Area, Skill>;
  for (const a of AREAS) areas[a] = { theta, n: 0 };
  return { areas, ai: { theta, n: 0 }, basics: 0 };
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function areaOf(it: Item): Area {
  switch (it.kind) {
    case "verb":
      return "verben";
    case "expr":
      return "redemittel";
    case "gram":
      return it.hall === "verben" ? "verben" : it.hall === "faelle" ? "faelle" : "satzbau";
    default:
      return "wortschatz";
  }
}

/** Chance that someone at ability theta uses an item of level b correctly (~80 % at their own level). */
export function pCorrect(theta: number, b: number): number {
  return 1 / (1 + Math.exp(-2.2 * (theta - b + 0.6)));
}

const SCORE: Record<TargetStatus, number> = { correct: 1, flawed: 0.7, synonym: 0.55, wrong: 0.1, missing: 0.15 };

/** One graded use of an item. `reps` is how often the item was reviewed before. */
export function observe(ls: LevelState, it: Item, status: TargetStatus, reps: number): void {
  const sk = ls.areas[areaOf(it)];
  const weight = 1 / (1 + reps / 2);
  const k = Math.max(0.06, 0.6 / Math.sqrt(1 + sk.n / 8));
  const b = LEVEL_NUM[it.level];
  sk.theta = clamp(sk.theta + k * weight * (SCORE[status] - pCorrect(sk.theta, b)), 0.6, 4.8);
  sk.n += weight;
}

/**
 * Seed the estimate from the machines a learner already has: each item's record
 * (right vs wrong uses) counts as one observation, so an existing save starts from
 * its real level instead of the default.
 */
export function seedFromHistory(ls: LevelState, items: { item: Item; ok: number; fail: number }[]): void {
  for (const { item, ok, fail } of items) {
    const uses = ok + fail;
    if (uses === 0) continue;
    const rate = ok / uses;
    const status: TargetStatus = rate >= 0.75 ? "correct" : rate >= 0.5 ? "flawed" : "wrong";
    observe(ls, item, status, Math.max(0, uses - 1));
  }
  ls.seeded = true;
}

/** The corrector's reading of one sentence ("this answer shows A2"). */
export function observeAi(ls: LevelState, cefr: Cefr): void {
  const x = cefr === "C1" ? 5 : LEVEL_NUM[cefr] + 0.5;
  const a = ls.ai.n < 5 ? 0.3 : 0.1;
  ls.ai.theta = clamp(ls.ai.theta + a * (x - ls.ai.theta), 0.6, 5);
  ls.ai.n += 1;
}

/** Mistakes that belong to the basics: an A1 grammar rule, or articles, conjugation, capitals. */
export function noteBasics(ls: LevelState, errors: { type: ErrorType; rule: string }[], ruleLevel: (id: string) => Level | undefined): void {
  for (const e of errors) {
    if (e.rule && ruleLevel(e.rule) === "A1") ls.basics += 1;
    else if (e.type === "gender" || e.type === "verb_form" || e.type === "capitalization") ls.basics += 0.5;
  }
}

/** Once a day: old basic mistakes count less. */
export function decayBasics(ls: LevelState, day: string, gapDays: number): void {
  if (ls.day === day) return;
  ls.basics *= Math.pow(0.8, Math.max(1, gapDays));
  if (ls.basics < 0.1) ls.basics = 0;
  ls.day = day;
}

/** Overall level: areas weighted by evidence, blended with the corrector's reading. */
export function overall(ls: LevelState): Skill {
  let sum = 0;
  let wsum = 0;
  let n = 0;
  for (const a of AREAS) {
    const sk = ls.areas[a];
    const w = Math.min(sk.n, 30) + 1;
    sum += sk.theta * w;
    wsum += w;
    n += sk.n;
  }
  let theta = sum / wsum;
  if (ls.ai.n >= 3) theta = 0.7 * theta + 0.3 * ls.ai.theta;
  return { theta, n };
}

export interface LevelLabel {
  /** "A2", "A2+" … */
  code: string;
  band: Level;
  next: Level | null;
  /** Progress through the band, 0–1. */
  frac: number;
}

export function levelLabel(theta: number): LevelLabel {
  const t = clamp(theta, 1, 4.99);
  const i = Math.floor(t) - 1;
  const band = BANDS[i];
  const frac = t - Math.floor(t);
  return { code: frac >= 0.6 ? `${band}+` : band, band, next: BANDS[i + 1] ?? null, frac };
}

export function confidence(n: number): "erste Schätzung" | "wird genauer" | "solide" {
  return n < 12 ? "erste Schätzung" : n < 50 ? "wird genauer" : "solide";
}

// --- what to learn next ---------------------------------------------------------------

export interface RecommendInput {
  catalog: Catalog;
  cards: Record<string, CardState>;
  level: LevelState;
  hallOpen: (hall: HallId) => boolean;
  /** Grammar ids with recent mistakes. */
  weak: string[];
  /** Most frequent error types. */
  errorTypes: ErrorType[];
  /** Varies the choice from day to day. */
  seed: string;
}

/**
 * The next items to learn: just above the current level in each area (the "i+1"),
 * in the topics the learner already works with, grammar that explains their frequent
 * mistakes first, and a mix of kinds instead of ten nouns in a row.
 * A1 items are left to the refreshers unless an area is still at A1.
 */
export function recommend(inp: RecommendInput, count: number): Item[] {
  if (count <= 0) return [];
  const { catalog, cards, level } = inp;
  const topicCount = new Map<TopicId, number>();
  for (const id of Object.keys(cards)) {
    const t = catalog.get(id)?.topic;
    if (t) topicCount.set(t, (topicCount.get(t) ?? 0) + 1);
  }
  const maxTopic = Math.max(1, ...topicCount.values());
  const weak = new Set(inp.weak);
  const errTypes = new Set(inp.errorTypes);
  const scored: { it: Item; score: number }[] = [];
  for (const it of catalog.items) {
    if (cards[it.id] || !inp.hallOpen(it.hall) || !levelOpen(level, it)) continue;
    const area = areaOf(it);
    const theta = level.areas[area].theta;
    const b = LEVEL_NUM[it.level];
    if (it.level === "A1" && theta >= 1.8) continue;
    const target = theta + 0.35;
    let score = Math.exp(-((b - target) ** 2) / (2 * 0.6 ** 2));
    if (it.topic) score += 0.3 * ((topicCount.get(it.topic) ?? 0) / maxTopic);
    if (it.kind === "gram") {
      score += 0.25;
      if (weak.has(it.id)) score += 0.8;
      if (it.errors.some((e) => errTypes.has(e))) score += 0.4;
    }
    if (it.id.startsWith("c.")) score += 0.15; // words the learner imported on purpose
    score += ((hash(`${it.id}|${inp.seed}`) % 1000) / 1000) * 0.08;
    scored.push({ it, score });
  }
  scored.sort((a, b) => b.score - a.score);
  // Greedy pick with a penalty for repeating the same kind or hall.
  const out: Item[] = [];
  const kinds = new Map<string, number>();
  const halls = new Map<string, number>();
  const pool = scored.slice(0, Math.max(60, count * 8));
  while (out.length < count && pool.length) {
    let best = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const { it, score } = pool[i];
      const s = score - 0.3 * (kinds.get(it.kind) ?? 0) - 0.15 * (halls.get(it.hall) ?? 0);
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    }
    const [{ it }] = pool.splice(best, 1);
    out.push(it);
    kinds.set(it.kind, (kinds.get(it.kind) ?? 0) + 1);
    halls.set(it.hall, (halls.get(it.hall) ?? 0) + 1);
  }
  return out;
}

/**
 * A1 basics to check again, never owned yet: grammar first when basic mistakes keep
 * happening, otherwise a word from the learner's topics. Answered correctly they become
 * running machines straight away; answered wrongly they become blueprints to learn.
 */
export function refreshers(inp: Omit<RecommendInput, "weak" | "errorTypes">, count: number): Item[] {
  if (count <= 0) return [];
  const { catalog, cards, level } = inp;
  const pool = catalog.items.filter((it) => it.level === "A1" && !cards[it.id] && inp.hallOpen(it.hall) && !it.id.startsWith("c."));
  if (!pool.length) return [];
  const grammarFirst = level.basics >= 2;
  const ranked = pool
    .map((it) => ({ it, r: (hash(`${it.id}|${inp.seed}`) % 1000) / 1000 + (it.kind === "gram" ? (grammarFirst ? 1 : 0.15) : 0) }))
    .sort((a, b) => b.r - a.r);
  return ranked.slice(0, count).map((x) => x.it);
}

/** How many refreshers a shift gets: one normally, more after basic mistakes or at a low level. */
export function refreshCount(ls: LevelState, shiftSize: number): number {
  if (shiftSize < 5) return 0;
  const o = overall(ls).theta;
  if (ls.basics >= 3 || o < 2.2) return 3;
  if (ls.basics >= 1) return 2;
  return 1;
}
