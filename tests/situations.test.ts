import { describe, expect, it } from "vitest";
import { BUILTIN_ITEMS, makeCatalog } from "../src/content/catalog";
import { newCard } from "../src/engine/srs";
import { taskForItem } from "../src/engine/tasks";

const catalog = makeCatalog([]);

describe("situations written for each word", () => {
  it("every built-in word and structure has two, in German and English", () => {
    const missing = BUILTIN_ITEMS.filter((it) => catalog.situationsOf(it.id).length !== 2).map((it) => it.id);
    expect(missing).toEqual([]);
    for (const it of BUILTIN_ITEMS) for (const s of catalog.situationsOf(it.id)) expect(s.de.length > 30 && s.en.length > 20).toBe(true);
  });

  it("a word's writing task uses one of its own situations", () => {
    const lkw = catalog.get("n.lkw")!;
    const t = taskForItem(lkw, newCard(lkw.id, 0), catalog, Date.UTC(2026, 9, 26), "new");
    expect(catalog.situationsOf("n.lkw").map((s) => s.de)).toContain(t.scenario?.de);
  });
});
