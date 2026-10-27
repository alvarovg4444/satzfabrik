import type { GradeResult } from "../ai/schema";
import type { Catalog } from "../content/catalog";
import type { ErrorType, Gender, Item, NounItem } from "../content/types";
import { norm } from "../engine/text";
import type { GameState } from "./state";

/*
 * Fehlerwörter: words the learner got wrong in their own sentences (wrong article, wrong
 * plural, spelling, wrong word) come back as Schnellkarten after 1, 3, 7, 14 and 30 days.
 * A miss starts the word over; a right answer after 30 days takes it off the pile.
 * Mistakes in case, endings or verb forms are not word mistakes: they go to Akkord.
 */

export interface MistakeCard {
  /** Dictionary form, nouns with their article: "der Tisch". */
  word: string;
  en: string;
  /** The word in the course, when there is one. */
  itemId?: string;
  type: ErrorType;
  /** What the learner wrote. */
  wrong: string;
  /** The corrected sentence it was in. */
  sentence: string;
  /** Right answers so far (0–4); the next one after `MISTAKE_DAYS[step]` days. */
  step: number;
  due: number;
  added: number;
}

/** Days until the next review after 0, 1, 2, 3 and 4 right answers. */
export const MISTAKE_DAYS = [1, 3, 7, 14, 30];
/** Fehlerwörter mixed into one round of Schnellkarten. */
export const MISTAKES_PER_ROUND = 6;
/** The pile keeps the newest this many. */
const MAX_PILE = 300;
const DAY = 86_400_000;
const WORD_TYPES = new Set<ErrorType>(["gender", "plural", "spelling", "word_choice"]);
const KINDS = new Set<Item["kind"]>(["noun", "verb", "adj", "adv"]);
const ARTICLE = /^(der|die|das)\s+/i;

interface Lexicon {
  lemma: Map<string, Item[]>;
  plural: Map<string, NounItem>;
}
const lexicons = new WeakMap<Catalog, Lexicon>();

function lexicon(catalog: Catalog): Lexicon {
  let lex = lexicons.get(catalog);
  if (lex) return lex;
  lex = { lemma: new Map(), plural: new Map() };
  for (const it of catalog.items) {
    if (!KINDS.has(it.kind) && it.kind !== "word") continue;
    const key = norm("lemma" in it ? it.lemma : it.de);
    const list = lex.lemma.get(key) ?? [];
    list.push(it);
    lex.lemma.set(key, list);
    if (it.kind === "noun" && it.plural) lex.plural.set(norm(it.plural), it);
  }
  lexicons.set(catalog, lex);
  return lex;
}

/** The genders an article or determiner can stand for (in some case): "einen" → m, "der" → m or f. */
const ENDINGS: Record<string, Gender[]> = { "": ["m", "n"], e: ["f"], en: ["m"], em: ["m", "n"], er: ["f"], es: ["m", "n"] };
const DEFINITE: Record<string, Gender[]> = { der: ["m", "f"], die: ["f"], das: ["n"], den: ["m"], dem: ["m", "n"], des: ["m", "n"] };
function articleGenders(word: string): Gender[] | null {
  const w = word.toLowerCase();
  if (DEFINITE[w]) return DEFINITE[w];
  const m = /^(k?ein|mein|dein|sein|ihr|unser|euer|eur)(e|en|em|er|es)?$/.exec(w);
  return m ? ENDINGS[m[2] ?? ""] : null;
}

/**
 * The noun had an article that fits its gender in another case ("den Tisch" for "dem Tisch"):
 * a case mistake, even when it was labelled as a gender one.
 */
function caseSlip(noun: NounItem, wrong: string): boolean {
  const first = wrong.trim().split(/\s+/)[0] ?? "";
  const genders = articleGenders(first);
  return !!genders && genders.includes(noun.gender);
}

/** Finds the course word a mistake is about: from the AI's dictionary form, else from the corrected words. */
function findItem(catalog: Catalog, e: { type: ErrorType; right: string; word?: string }): Item | undefined {
  const lex = lexicon(catalog);
  if (e.word) {
    const hasArticle = ARTICLE.test(e.word.trim());
    const list = lex.lemma.get(norm(e.word.replace(ARTICLE, ""))) ?? [];
    return (hasArticle ? list.find((i) => i.kind === "noun") : undefined) ?? list.find((i) => KINDS.has(i.kind)) ?? list[0];
  }
  for (const raw of e.right.split(/\s+/)) {
    const t = norm(raw);
    if (t.length < 3) continue;
    const list = lex.lemma.get(t) ?? [];
    const noun = list.find((i) => i.kind === "noun") ?? lex.plural.get(t);
    if (noun) return noun;
    if (e.type === "spelling" || e.type === "word_choice") {
      const other = list.find((i) => KINDS.has(i.kind));
      if (other) return other;
    }
  }
  return undefined;
}

function put(s: GameState, card: MistakeCard): void {
  const pile = (s.mistakes ??= {});
  pile[norm(card.word)] = card;
  const keys = Object.keys(pile);
  if (keys.length > MAX_PILE) {
    keys
      .sort((a, b) => pile[a].added - pile[b].added)
      .slice(0, keys.length - MAX_PILE)
      .forEach((k) => delete pile[k]);
  }
}

/** Puts the word mistakes of one corrected answer on the pile (again from day 1 if already there). */
export function noteMistakes(s: GameState, catalog: Catalog, grade: Pick<GradeResult, "errors" | "corrected">, now: number): number {
  let n = 0;
  for (const e of grade.errors) {
    if (!WORD_TYPES.has(e.type)) continue;
    const it = findItem(catalog, e);
    if (it?.kind === "noun" && e.type === "gender" && caseSlip(it, e.wrong)) continue;
    const word = it ? it.de : e.word?.trim();
    const en = it ? it.en : e.en?.trim();
    if (!word || !en) continue;
    put(s, { word, en, itemId: it?.id, type: e.type, wrong: e.wrong, sentence: grade.corrected, step: 0, due: now + MISTAKE_DAYS[0] * DAY, added: now });
    n++;
  }
  return n;
}

/** Once: the mistakes already in the sentence archive (only clear matches with course words). */
export function seedMistakes(s: GameState, catalog: Catalog, now: number): void {
  if (s.mistakesSeeded) return;
  s.mistakesSeeded = true;
  for (const j of [...s.journal].reverse()) {
    const errors = j.errors.filter((e) => WORD_TYPES.has(e.type)).map((e) => ({ ...e, rule: "", word: "", en: "" }));
    if (errors.length) noteMistakes(s, catalog, { errors, corrected: j.corrected }, now);
  }
}

/** Fehlerwörter due now, longest waiting first. */
export function dueMistakes(s: GameState, now: number): { key: string; card: MistakeCard }[] {
  return Object.entries(s.mistakes ?? {})
    .filter(([, c]) => c.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([key, card]) => ({ key, card }));
}

/** A Fehlerwort answered: right moves it on (and off the pile after 30 days), wrong starts it over. */
export function reviewMistake(s: GameState, key: string, ok: boolean, now: number): "next" | "done" | "again" {
  const c = s.mistakes?.[key];
  if (!c) return "again";
  if (!ok) {
    s.mistakes![key] = { ...c, step: 0, due: now + MISTAKE_DAYS[0] * DAY };
    return "again";
  }
  const step = c.step + 1;
  if (step >= MISTAKE_DAYS.length) {
    delete s.mistakes![key];
    return "done";
  }
  s.mistakes![key] = { ...c, step, due: now + MISTAKE_DAYS[step] * DAY };
  return "next";
}

/** The card for a Fehlerwort: the course word, or one made from the AI's dictionary form. */
export function mistakeItem(catalog: Catalog, c: MistakeCard): Item {
  const known = c.itemId ? catalog.get(c.itemId) : undefined;
  if (known) return known;
  const m = ARTICLE.exec(c.word);
  const base = { id: `m.${norm(c.word).replace(/[^a-z0-9]+/g, "-")}`, hall: "woerter" as const, level: "B1" as const, en: c.en, example: { de: c.sentence, en: "" } };
  if (m) {
    const gender: Gender = m[1].toLowerCase() === "der" ? "m" : m[1].toLowerCase() === "die" ? "f" : "n";
    return { ...base, kind: "noun", de: c.word, lemma: c.word.slice(m[0].length), gender, plural: null, topic: "alltag" } as Item;
  }
  return { ...base, kind: "word", de: c.word, lemma: c.word } as Item;
}
