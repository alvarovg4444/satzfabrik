import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";
import { dayKey } from "./text";

/**
 * Production scheduling. One card per item, reviewed only by *using* the item
 * in a sentence (never by recognising it). Day-based FSRS: the first graded
 * production of a day updates the schedule; later ones the same day are practice.
 */
const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: true,
  enable_short_term: false,
});

const DAY = 86_400_000;

/** Compact, JSON-friendly card state stored per unlocked item. */
export interface CardState {
  id: string;
  unlockedAt: number;
  /** FSRS fields */
  due: number;
  s: number;
  d: number;
  reps: number;
  lapses: number;
  st: State;
  last?: number;
  sched: number;
  /** Productions that used the item correctly / incorrectly (all, including practice). */
  ok: number;
  fail: number;
  /** Day key of the last schedule-changing review. */
  lastDay?: string;
  /** Last few corrected sentences the learner wrote with this item. */
  ctx?: string[];
}

export type Outcome = "correct" | "flawed" | "synonym" | "wrong" | "missing";

export function newCard(id: string, now: number): CardState {
  const c = createEmptyCard(new Date(now));
  return fromFsrs(id, c, now, { ok: 0, fail: 0 });
}

function toFsrs(c: CardState): Card {
  return {
    due: new Date(c.due),
    stability: c.s,
    difficulty: c.d,
    elapsed_days: 0,
    scheduled_days: c.sched,
    learning_steps: 0,
    reps: c.reps,
    lapses: c.lapses,
    state: c.st,
    last_review: c.last ? new Date(c.last) : undefined,
  };
}

function fromFsrs(
  id: string,
  c: Card,
  unlockedAt: number,
  keep: Pick<CardState, "ok" | "fail" | "lastDay" | "ctx">,
): CardState {
  return {
    id,
    unlockedAt,
    due: c.due.getTime(),
    s: c.stability,
    d: c.difficulty,
    reps: c.reps,
    lapses: c.lapses,
    st: c.state,
    last: c.last_review ? c.last_review.getTime() : undefined,
    sched: c.scheduled_days,
    ...keep,
  };
}

/**
 * How a production result maps onto an FSRS grade. A correct sentence is
 * Good, never Easy: Easy inflates intervals, and producing a word fluently
 * fades faster than recognising it.
 */
export function gradeFor(outcome: Outcome): Grade {
  switch (outcome) {
    case "correct":
      return Rating.Good;
    case "flawed":
    case "synonym":
      return Rating.Hard;
    case "wrong":
    case "missing":
      return Rating.Again;
  }
}

export interface ReviewResult {
  card: CardState;
  /** True when this review changed the schedule (first review of the day). */
  scheduled: boolean;
  stageBefore: number;
  stageAfter: number;
}

/** Apply one production result to a card. */
export function review(
  card: CardState,
  outcome: Outcome,
  opts: { now: number; sentence?: string; known?: boolean },
): ReviewResult {
  const stageBefore = stageOf(card);
  const good = outcome === "correct" || outcome === "flawed";
  const counts = {
    ok: card.ok + (good ? 1 : 0),
    fail: card.fail + (good ? 0 : 1),
    lastDay: card.lastDay,
    ctx: opts.sentence ? [opts.sentence, ...(card.ctx ?? [])].slice(0, 3) : card.ctx,
  };
  const today = dayKey(opts.now);
  if (card.lastDay === today) {
    const next = { ...card, ...counts };
    return { card: next, scheduled: false, stageBefore, stageAfter: stageOf(next) };
  }
  // A basic the learner already knew on first sight (an A1 refresher) starts like an Easy card.
  const grade = opts.known && card.st === State.New && outcome === "correct" ? Rating.Easy : gradeFor(outcome);
  const rec = scheduler.next(toFsrs(card), new Date(opts.now), grade);
  const next = fromFsrs(card.id, rec.card, card.unlockedAt, { ...counts, lastDay: today });
  return { card: next, scheduled: true, stageBefore, stageAfter: stageOf(next) };
}

/**
 * Production ladder 0–5, derived from memory stability (days).
 * 0 = blueprint (never produced correctly), 5 = gold (stable for ~3 months).
 */
export const STAGE_STABILITY = [0, 0, 3, 10, 30, 90];

export function stageOf(card: CardState): number {
  if (card.ok === 0 || card.st === State.New) return 0;
  let stage = 1;
  for (let i = 2; i < STAGE_STABILITY.length; i++) if (card.s >= STAGE_STABILITY[i]) stage = i;
  return stage;
}

export const STAGE_NAMES = ["Bauplan", "Rohbau", "Läuft", "Solide", "Profi", "Gold"];

/** Memory retrievability right now (0–1), or 1 for cards never reviewed. */
export function retrievability(card: CardState, now: number): number {
  if (card.st === State.New || !card.last) return 1;
  return scheduler.get_retrievability(toFsrs(card), new Date(now), false);
}

export function isDue(card: CardState, now: number): boolean {
  return card.st !== State.New && card.ok > 0 && card.due <= now;
}

/**
 * Rust 0–1: how far past due the machine is, relative to its interval.
 * Fully rusted after one extra interval (at least two days) without maintenance.
 */
export function rustOf(card: CardState, now: number): number {
  if (!isDue(card, now)) return 0;
  const interval = Math.max(2 * DAY, card.sched * DAY);
  return Math.min(1, (now - card.due) / interval);
}

/** Days until due (negative when overdue). */
export function dueInDays(card: CardState, now: number): number {
  return (card.due - now) / DAY;
}
