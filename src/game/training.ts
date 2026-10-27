import type { Catalog } from "../content/catalog";
import type { ErrorType, Item } from "../content/types";
import type { DrillKind } from "../engine/drills";
import { isDue, stageOf } from "../engine/srs";
import { dayKey, norm } from "../engine/text";
import { dueMistakes, mistakeItem, MISTAKES_PER_ROUND, type MistakeCard } from "./mistakes";
import type { GameState } from "./state";

/*
 * Training has two jobs that do not overlap:
 * - Schnellkarten ("Welches Wort?"): recall the word itself, meaning → German with article.
 *   It works on the machines that are due and today's new words.
 * - Akkord ("Welche Form?"): bend known words correctly (cases, endings, verb forms),
 *   aimed at the grammar that goes wrong in the learner's sentences.
 */

// --- Schnellkarten ---------------------------------------------------------------

const CARD_KINDS = new Set<Item["kind"]>(["noun", "verb", "adj", "adv", "word"]);
/** Cards per round: about three minutes. */
export const CARDS_PER_ROUND = 15;

/** Words to recall now: rusting machines first (longest overdue first), then today's new words. */
export function cardQueue(s: GameState, catalog: Catalog, now: number, max = CARDS_PER_ROUND): Item[] {
  const today = dayKey(now);
  const due: { it: Item; due: number }[] = [];
  const fresh: { it: Item; t: number }[] = [];
  for (const c of Object.values(s.cards)) {
    const it = catalog.get(c.id);
    if (!it || !CARD_KINDS.has(it.kind)) continue;
    if (isDue(c, now)) due.push({ it, due: c.due });
    else if (dayKey(c.unlockedAt) === today || (c.lastDay === today && stageOf(c) <= 1)) fresh.push({ it, t: c.unlockedAt });
  }
  due.sort((a, b) => a.due - b.due);
  fresh.sort((a, b) => b.t - a.t);
  return [...due.map((x) => x.it), ...fresh.map((x) => x.it)].slice(0, max);
}

/** One Schnellkarte: a course word, or a Fehlerwort from the learner's own sentences. */
export interface CardEntry {
  key: string;
  item: Item;
  mistake?: MistakeCard;
}

/**
 * A round: due Fehlerwörter (up to MISTAKES_PER_ROUND) mixed in between the rusting and
 * new words, every second card, so a round stays about three minutes.
 */
export function trainingCards(s: GameState, catalog: Catalog, now: number, max = CARDS_PER_ROUND): CardEntry[] {
  const mistakes = dueMistakes(s, now)
    .slice(0, MISTAKES_PER_ROUND)
    .map(({ key, card }): CardEntry => ({ key: `m:${key}`, item: mistakeItem(catalog, card), mistake: card }));
  const taken = new Set(mistakes.map((m) => m.item.id));
  const words = cardQueue(s, catalog, now, max)
    .filter((it) => !taken.has(it.id))
    .slice(0, Math.max(0, max - mistakes.length))
    .map((it): CardEntry => ({ key: it.id, item: it }));
  const out: CardEntry[] = [];
  while (words.length || mistakes.length) {
    const w = words.shift();
    if (w) out.push(w);
    const m = mistakes.shift();
    if (m) out.push(m);
  }
  return out;
}

/** How many cards are waiting (for the start screen), and how many of them are Fehlerwörter. */
export function cardsWaiting(s: GameState, catalog: Catalog, now: number): { total: number; mistakes: number; pile: number } {
  const mistakes = dueMistakes(s, now).length;
  return { total: cardQueue(s, catalog, now, 999).length + mistakes, mistakes, pile: Object.keys(s.mistakes ?? {}).length };
}

export type CardCheck = "ok" | "article" | "wrong";

const ARTICLES = /^(der|die|das)\s+/;

/** What the learner should type for a card. */
export function cardAnswer(it: Item): string {
  return it.de;
}

/** Checks a typed answer: nouns need their article; "sich" and an added "sein" are optional. */
export function checkCard(it: Item, given: string): CardCheck {
  const g = norm(given);
  if (!g) return "wrong";
  if (it.kind === "noun") {
    if (g === norm(it.de)) return "ok";
    const bare = g.replace(ARTICLES, "");
    return bare === norm(it.lemma) ? "article" : "wrong";
  }
  const ok = new Set([norm(it.de), norm("lemma" in it ? it.lemma : it.de)]);
  for (const a of [...ok]) {
    ok.add(a.replace(/^sich /, ""));
    ok.add(a.replace(/ sein$/, ""));
  }
  return ok.has(g) || ok.has(g.replace(/^sich /, "")) ? "ok" : "wrong";
}

/** The line under the English meaning: what kind of answer is wanted. */
export function cardHint(it: Item): string {
  switch (it.kind) {
    case "noun":
      return "Nomen · mit Artikel";
    case "verb":
      return "Verb · Infinitiv";
    case "adj":
      return "Adjektiv";
    case "adv":
      return "Adverb";
    default:
      return "Wort";
  }
}

// --- Akkord focus -------------------------------------------------------------------

/** Akkord exercises for each grammar topic of the course. */
const RULE_KINDS: Record<string, DrillKind[]> = {
  "g.praep-akkusativ": ["prep_case"],
  "g.praep-dativ": ["prep_case"],
  "g.akkusativ": ["prep_case", "pronoun"],
  "g.dativ": ["prep_case", "pronoun"],
  "g.wechselpraepositionen": ["wechsel"],
  "g.wohin-wo": ["wechsel"],
  "g.stellen-stehen": ["wechsel"],
  "g.adj-bestimmter-artikel": ["adj_ending"],
  "g.adj-unbestimmter-artikel": ["adj_ending"],
  "g.adj-ohne-artikel": ["adj_ending"],
  "g.perfekt-haben": ["perfekt"],
  "g.perfekt-sein": ["perfekt"],
  "g.sein-haben": ["perfekt"],
  "g.praeteritum": ["praeteritum"],
  "g.praesens": ["praesens"],
  "g.praesens-vokalwechsel": ["praesens"],
  "g.personalpronomen": ["pronoun"],
  "g.personalpronomen-nominativ": ["pronoun"],
  "g.possessivartikel": ["possessive"],
};

/** Akkord exercises for the corrector's error types. */
const ERROR_KINDS: Partial<Record<ErrorType, DrillKind[]>> = {
  case: ["prep_case", "pronoun", "possessive"],
  preposition: ["prep_case", "wechsel"],
  adj_ending: ["adj_ending"],
  verb_form: ["praesens", "praeteritum"],
  tense: ["perfekt", "praeteritum"],
  aux: ["perfekt"],
  pronoun: ["pronoun", "possessive"],
};

/** The grammar topic a missed Akkord answer feeds back into (weak spots for the shifts). */
export const KIND_RULE: Record<DrillKind, string> = {
  gender: "g.artikel",
  plural: "g.plural",
  praesens: "g.praesens-vokalwechsel",
  perfekt: "g.perfekt-sein",
  praeteritum: "g.praeteritum",
  prep_case: "g.praep-dativ",
  wechsel: "g.wechselpraepositionen",
  pronoun: "g.personalpronomen",
  possessive: "g.possessivartikel",
  adj_ending: "g.adj-bestimmter-artikel",
};

/** Forms only: der/die/das and plurals belong to the word, so they are on the Schnellkarten. */
export const AKKORD_KINDS: DrillKind[] = ["praesens", "perfekt", "praeteritum", "prep_case", "wechsel", "pronoun", "possessive", "adj_ending"];

export interface DrillFocus {
  /** Exercise mix for the round: focus kinds appear three times as often. */
  mix: DrillKind[];
  /** The kinds in focus, strongest first (empty: an even mix). */
  focus: DrillKind[];
  /** Words to ask more often (missed recently). */
  words: Set<string>;
}

/** What Akkord practises today: the forms behind the learner's recent mistakes. */
export function drillFocus(s: GameState): DrillFocus {
  const score = new Map<DrillKind, number>();
  const add = (k: DrillKind, n: number) => score.set(k, (score.get(k) ?? 0) + n);
  for (const [rule, heat] of Object.entries(s.stats.ruleHeat)) for (const k of RULE_KINDS[rule] ?? []) add(k, heat);
  // the last week's error types from the corrector
  const days = Object.entries(s.stats.days)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 7);
  for (const [, d] of days)
    for (const [type, n] of Object.entries(d.errors ?? {})) for (const k of ERROR_KINDS[type as ErrorType] ?? []) add(k, (n ?? 0) * 0.5);
  const focus = [...score.entries()]
    .filter(([k, n]) => n >= 1 && AKKORD_KINDS.includes(k))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);
  const mix = [...AKKORD_KINDS, ...focus.flatMap((k) => [k, k, k])];
  const words = new Set(
    Object.entries(s.stats.wordHeat ?? {})
      .filter(([, h]) => h >= 0.5)
      .map(([id]) => id),
  );
  // words the learner got wrong in sentences, too
  for (const c of Object.values(s.cards)) if (c.fail > c.ok && c.ok + c.fail >= 2) words.add(c.id);
  return { mix, focus, words };
}
