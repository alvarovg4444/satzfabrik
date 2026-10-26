import type { Catalog } from "../content/catalog";
import type { Item, TopicId } from "../content/types";

const STARTER_GRAMMAR = ["g.weil", "g.dass", "g.trotzdem", "g.perfekt-haben", "g.deshalb", "g.obwohl", "g.perfekt-sein", "g.doch"];
export const DEFAULT_TOPICS: TopicId[] = ["arbeit", "wohnen", "alltag"];

const LEVEL_RANK = { A1: 0, A2: 1, B1: 2, B2: 3 } as const;

/** Starter pack: core connectors and the Perfekt, interleaved with words from the learner's own life. */
export function starterItems(catalog: Catalog, topics: TopicId[]): Item[] {
  const grammar = STARTER_GRAMMAR.map((id) => catalog.get(id)).filter((x): x is Item => !!x);
  const words: Item[] = [];
  for (const t of topics) {
    const pool = catalog.items
      .filter((it) => it.topic === t && !it.id.startsWith("c.") && (it.kind === "noun" || it.kind === "verb"))
      .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);
    words.push(...pool.filter((i) => i.kind === "noun").slice(0, 3), ...pool.filter((i) => i.kind === "verb").slice(0, 1));
  }
  const out: Item[] = [];
  const n = Math.max(grammar.length, Math.ceil(words.length / 2));
  for (let i = 0; i < n; i++) {
    if (i < grammar.length) out.push(grammar[i]);
    if (i * 2 < words.length) out.push(words[i * 2]);
    if (i * 2 + 1 < words.length) out.push(words[i * 2 + 1]);
  }
  return out;
}
