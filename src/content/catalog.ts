import { EXPRESSIONS } from "./expressions";
import { GRAMMAR_FAELLE } from "./grammar-faelle";
import { GRAMMAR_SATZBAU } from "./grammar-satzbau";
import { GRAMMAR_VERBEN } from "./grammar-verben";
import { NOUNS } from "./nouns";
import { SCENARIOS } from "./scenarios";
import type { GramItem, HallId, Item, Scenario, TopicId } from "./types";
import { VERBS } from "./verbs";
import { WORDS } from "./words";

export const BUILTIN_ITEMS: Item[] = [
  ...GRAMMAR_SATZBAU,
  ...GRAMMAR_VERBEN,
  ...GRAMMAR_FAELLE,
  ...NOUNS,
  ...VERBS,
  ...WORDS,
  ...EXPRESSIONS,
];

const BUILTIN_IDS = new Set(BUILTIN_ITEMS.map((i) => i.id));

export const GRAMMAR: GramItem[] = [...GRAMMAR_SATZBAU, ...GRAMMAR_VERBEN, ...GRAMMAR_FAELLE];

export { SCENARIOS };

export interface Catalog {
  items: Item[];
  get(id: string): Item | undefined;
  inHall(hall: HallId): Item[];
  scenarios: Scenario[];
  scenariosFor(topic: TopicId | undefined): Scenario[];
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
  };
}
