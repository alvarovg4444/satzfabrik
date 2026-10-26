import type { CoachInput, CoachMistake } from "../ai/prompts";
import type { CoachOutput, TargetStatus } from "../ai/schema";
import type { Catalog } from "../content/catalog";
import { ERROR_TYPES, type ErrorType, type GramItem } from "../content/types";
import { AREA_DE, AREAS, levelLabel, levelOpen } from "../engine/level";
import { newCard } from "../engine/srs";
import { hallUnlocked, weakRules } from "./actions";
import type { GameState } from "./state";

/*
 * The coach: after each shift it reads the mistakes (with the AI, or from the grammar
 * ids the corrector attached to them), names what to work on, and puts up to three
 * grammar topics in focus. The next shifts practise each focus topic extra until it has
 * had its shifts or the learner gets it right several times in a row.
 */

export interface CoachFocus {
  /** Grammar id. */
  id: string;
  /** Why, naming the learner's own mistake. */
  why: string;
  /** Shifts with extra practice still to come. */
  left: number;
  /** Correct uses in a row since it came into focus. */
  streak: number;
}

export interface CoachState {
  at: number;
  note: string;
  by: "ai" | "local";
  focus: CoachFocus[];
}

export const FOCUS_SHIFTS = 3;
export const FOCUS_MAX = 3;
/** Topics practised per shift. */
export const FOCUS_PER_SHIFT = 2;
/** Correct uses in a row that end a focus early. */
export const FOCUS_DONE = 3;

/** What a shift showed, collected while it runs. */
export interface ShiftLog {
  mistakes: CoachMistake[];
  results: { id: string; status: TargetStatus }[];
}

export const emptyLog = (): ShiftLog => ({ mistakes: [], results: [] });

const MISSED: TargetStatus[] = ["wrong", "missing", "flawed"];

/** Grammar the coach may put in focus: halls that are built, levels that are open. */
export function coachChoices(s: GameState, catalog: Catalog): GramItem[] {
  return catalog.items.filter((it): it is GramItem => it.kind === "gram" && hallUnlocked(s, it.hall) && levelOpen(s.level, it));
}

export function coachInput(s: GameState, catalog: Catalog, log: ShiftLog, sentences: number): CoachInput {
  return {
    sentences,
    mistakes: log.mistakes.slice(0, 30),
    results: log.results,
    areas: AREAS.map((a) => `${AREA_DE[a]} ${levelLabel(s.level.areas[a].theta).code}`).join(", "),
    weak: weakRules(s).slice(0, 6),
    current: (s.coach?.focus ?? []).map((f) => ({ id: f.id, left: f.left })),
    allowed: coachChoices(s, catalog),
  };
}

/** True when there is nothing for the coach to read: no mistakes, every target right. */
export function cleanShift(log: ShiftLog): boolean {
  return log.mistakes.length === 0 && log.results.every((r) => !MISSED.includes(r.status));
}

/**
 * Without AI: grammar ids behind this shift's mistakes (named by the corrector, or
 * targets used wrongly) become focus when they happened twice, or once more on top of
 * an earlier weak spot.
 */
export function localDiagnosis(s: GameState, catalog: Catalog, log: ShiftLog): CoachOutput {
  const allowed = new Set(coachChoices(s, catalog).map((g) => g.id));
  const now = new Map<string, number>();
  const example = new Map<string, CoachMistake>();
  for (const m of log.mistakes) {
    if (!allowed.has(m.rule)) continue;
    now.set(m.rule, (now.get(m.rule) ?? 0) + 1);
    if (!example.has(m.rule)) example.set(m.rule, m);
  }
  for (const r of log.results) if (allowed.has(r.id) && MISSED.includes(r.status)) now.set(r.id, (now.get(r.id) ?? 0) + 1);
  // ruleHeat already holds this shift's mistakes; what is left over is from earlier shifts
  const scored = [...now]
    .map(([id, n]) => ({ id, n, score: 2 * n + Math.max(0, (s.stats.ruleHeat[id] ?? 0) - n) }))
    .filter((x) => x.n >= 2 || x.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, FOCUS_PER_SHIFT);
  const name = (id: string) => {
    const it = catalog.get(id);
    return it?.kind === "gram" ? it.name : id;
  };
  const focus = scored.map(({ id }) => {
    const m = example.get(id);
    return { id, why: m ? `„${m.wrong}“ → „${m.right}“` : `${name(id)} noch unsicher` };
  });
  const types = new Map<ErrorType, number>();
  for (const m of log.mistakes) types.set(m.type, (types.get(m.type) ?? 0) + 1);
  const top = [...types].sort((a, b) => b[1] - a[1])[0];
  let note: string;
  if (cleanShift(log)) note = "Keine Fehler in dieser Schicht. Es bleibt beim normalen Plan.";
  else if (focus.length) note = `Mehrmals schwierig: ${focus.map((f) => name(f.id)).join(" und ")}. Die nächsten Schichten üben das extra.`;
  else if (top) note = `Einzelne Fehler (am häufigsten: ${ERROR_TYPES[top[0]].de}), aber kein festes Muster. Es bleibt beim normalen Plan.`;
  else note = "Ein paar Bausteine waren noch unsicher. Die Wartung bringt sie bald wieder.";
  return { note, focus };
}

/**
 * Store a diagnosis: its topics come first, unfinished earlier ones stay. A topic the
 * learner has no machine for yet arrives as a free blueprint. Returns the new topics.
 */
export function applyDiagnosis(s: GameState, catalog: Catalog, diag: CoachOutput, by: CoachState["by"], now: number): CoachFocus[] {
  const allowed = new Set(coachChoices(s, catalog).map((g) => g.id));
  const fresh: CoachFocus[] = [];
  for (const f of diag.focus) {
    if (!allowed.has(f.id) || fresh.some((x) => x.id === f.id)) continue;
    fresh.push({ id: f.id, why: f.why.slice(0, 160), left: FOCUS_SHIFTS, streak: 0 });
    if (fresh.length >= FOCUS_MAX) break;
  }
  const keep = (s.coach?.focus ?? []).filter((f) => f.left > 0 && !fresh.some((x) => x.id === f.id));
  s.coach = { at: now, note: diag.note.slice(0, 400), by, focus: [...fresh, ...keep].slice(0, FOCUS_MAX) };
  for (const f of fresh) if (!s.cards[f.id]) s.cards[f.id] = newCard(f.id, now);
  s.updatedAt = now;
  return fresh;
}

/** The focus topics the next shift practises. */
export function focusForShift(s: GameState): string[] {
  return (s.coach?.focus ?? [])
    .filter((f) => f.left > 0)
    .slice(0, FOCUS_PER_SHIFT)
    .map((f) => f.id);
}

/** A graded use of an item: focus topics count correct uses in a row. */
export function noteFocusResult(s: GameState, id: string, ok: boolean): void {
  const f = s.coach?.focus.find((x) => x.id === id);
  if (f) f.streak = ok ? f.streak + 1 : 0;
}

/** After a shift: practised topics count down; finished or learned ones leave the focus. Returns those. */
export function afterShift(s: GameState, practised: Set<string>): CoachFocus[] {
  if (!s.coach) return [];
  const done: CoachFocus[] = [];
  s.coach.focus = s.coach.focus.filter((f) => {
    if (practised.has(f.id)) f.left--;
    const finished = f.left <= 0 || f.streak >= FOCUS_DONE;
    if (finished) done.push(f);
    return !finished;
  });
  return done;
}
