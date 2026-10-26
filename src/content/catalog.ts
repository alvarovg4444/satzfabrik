import { EXPRESSIONS } from "./expressions";
import { EXPRESSIONS_B2, GRAMMAR_B2 } from "./grammar-b2";
import { GRAMMAR_A1, GRAMMAR_B1_EXTRA } from "./grammar-extra";
import { GRAMMAR_FAELLE } from "./grammar-faelle";
import { GRAMMAR_SATZBAU } from "./grammar-satzbau";
import { GRAMMAR_VERBEN } from "./grammar-verben";
import ITEM_SITUATIONS from "./item-situations.json";
import { NOUNS } from "./nouns";
import { SCENARIOS } from "./scenarios";
import type { GramItem, HallId, Item, Scenario, TopicId } from "./types";
import { VERBS } from "./verbs";
import { VOCAB_A1 } from "./vocab-a1";
import { VOCAB_A2 } from "./vocab-a2";
import { VOCAB_B1 } from "./vocab-b1";
import { VOCAB_B2, VOCAB_BASICS } from "./vocab-b2";
import { WORDS } from "./words";

export const GRAMMAR: GramItem[] = [...GRAMMAR_SATZBAU, ...GRAMMAR_VERBEN, ...GRAMMAR_FAELLE, ...GRAMMAR_A1, ...GRAMMAR_B1_EXTRA, ...GRAMMAR_B2];

/**
 * The hand-written core (grammar, the first nouns, verbs, words and phrases), then the
 * vocabulary of the Goethe A1-B1 word lists and the B2 set.
 */
export const BUILTIN_ITEMS: Item[] = [
  ...GRAMMAR,
  ...NOUNS,
  ...VERBS,
  ...WORDS,
  ...EXPRESSIONS,
  ...EXPRESSIONS_B2,
  ...VOCAB_A1,
  ...VOCAB_A2,
  ...VOCAB_B1,
  ...VOCAB_BASICS,
  ...VOCAB_B2,
];

const BUILTIN_IDS = new Set(BUILTIN_ITEMS.map((i) => i.id));

export { SCENARIOS };

export interface Catalog {
  items: Item[];
  get(id: string): Item | undefined;
  inHall(hall: HallId): Item[];
  scenarios: Scenario[];
  scenariosFor(topic: TopicId | undefined): Scenario[];
  /** Situations written for this one word or structure ([German, English] pairs), if any. */
  situationsOf(id: string): Scenario[];
}

/** Two situations per item, written for that item: [[de, en], [de, en]] by id. */
const OWN = ITEM_SITUATIONS as Record<string, [string, string][]>;
const ownCache = new Map<string, Scenario[]>();
function situationsOf(id: string): Scenario[] {
  let list = ownCache.get(id);
  if (!list) {
    list = (OWN[id] ?? []).map(([de, en], i) => ({ id: `${id}#${i}`, topic: "alltag", de, en }));
    ownCache.set(id, list);
  }
  return list;
}

const byTopic = new Map<TopicId, Scenario[]>();
for (const s of SCENARIOS) {
  const list = byTopic.get(s.topic) ?? [];
  list.push(s);
  byTopic.set(s.topic, list);
}

/** Built-in curriculum plus the learner's imported items. */
export function makeCatalog(custom: Item[]): Catalog {
  const items = [...BUILTIN_ITEMS, ...custom.filter((c) => !BUILTIN_IDS.has(c.id))];
  const byId = new Map(items.map((i) => [i.id, i] as const));
  const byHall = new Map<HallId, Item[]>();
  for (const it of items) {
    const list = byHall.get(it.hall) ?? [];
    list.push(it);
    byHall.set(it.hall, list);
  }
  return {
    items,
    get: (id) => byId.get(id),
    inHall: (hall) => byHall.get(hall) ?? [],
    scenarios: SCENARIOS,
    scenariosFor: (topic) => (topic && byTopic.get(topic)) || SCENARIOS,
    situationsOf,
  };
}
