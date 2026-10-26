import { describe, expect, it } from "vitest";
import { BUILTIN_ITEMS, GRAMMAR, SCENARIOS, makeCatalog } from "../src/content/catalog";
import { ERROR_TYPES, TOPICS, type Item, type TopicId } from "../src/content/types";
import { mentions } from "../src/engine/text";
import { starterItems } from "../src/game/starter";

const PREFIX: Record<Item["kind"], string> = { noun: "n.", verb: "v.", adj: "a.", adv: "d.", word: "w.", expr: "x.", gram: "g." };
const HALL: Record<Item["kind"], string[]> = {
  noun: ["woerter"],
  verb: ["verben"],
  adj: ["woerter"],
  adv: ["woerter"],
  word: ["woerter"],
  expr: ["redemittel"],
  gram: ["verben", "faelle", "satzbau"],
};

function germanStrings(it: Item): string[] {
  const out = [it.de, it.example.de];
  if (it.kind === "gram") {
    out.push(...it.examples.map((e) => e.de), ...it.translate.map((t) => t.de));
    for (const t of it.transform ?? []) out.push(t.prompt, t.input, t.answer);
  }
  return out;
}

describe("curriculum", () => {
  it("has a substantial amount of content", () => {
    const by = (k: Item["kind"]) => BUILTIN_ITEMS.filter((i) => i.kind === k).length;
    expect(GRAMMAR.length).toBe(95);
    expect(by("noun")).toBeGreaterThanOrEqual(2000);
    expect(by("verb")).toBeGreaterThanOrEqual(750);
    expect(by("expr")).toBeGreaterThanOrEqual(100);
    expect(SCENARIOS.length).toBe(90);
    // the Goethe A1-B1 lists plus a B2 set: every level is well stocked
    for (const lv of ["A1", "A2", "B1", "B2"] as const) expect(BUILTIN_ITEMS.filter((i) => i.level === lv).length, lv).toBeGreaterThanOrEqual(500);
    expect(GRAMMAR.filter((g) => g.level === "A1").length).toBeGreaterThanOrEqual(10);
    expect(GRAMMAR.filter((g) => g.level === "B2").length).toBeGreaterThanOrEqual(10);
  });

  it("uses unique, well-formed ids", () => {
    const seen = new Set<string>();
    for (const it of BUILTIN_ITEMS) {
      expect(seen.has(it.id), `duplicate id ${it.id}`).toBe(false);
      seen.add(it.id);
      expect(it.id.startsWith(PREFIX[it.kind]), `${it.id} prefix`).toBe(true);
      expect(/^[a-z]\.[a-z0-9-]+$/.test(it.id), `${it.id} charset`).toBe(true);
      expect(HALL[it.kind], `${it.id} hall`).toContain(it.hall);
    }
  });

  it("fills every required field", () => {
    for (const it of BUILTIN_ITEMS) {
      expect(it.de.trim(), it.id).not.toBe("");
      expect(it.en.trim(), it.id).not.toBe("");
      expect(it.example.de.trim(), `${it.id} example`).not.toBe("");
      expect(it.example.en.trim(), `${it.id} example en`).not.toBe("");
      expect(["A1", "A2", "B1", "B2"]).toContain(it.level);
      if (it.topic) expect(Object.keys(TOPICS)).toContain(it.topic);
      for (const k of it.keys ?? []) expect(k, `${it.id} key`).toBe(k.toLowerCase());
    }
  });

  it("nouns carry consistent articles and plurals", () => {
    for (const it of BUILTIN_ITEMS) {
      if (it.kind !== "noun") continue;
      const art = { m: "der", f: "die", n: "das" }[it.gender];
      expect(it.de, it.id).toBe(`${art} ${it.lemma}`);
      expect(/^[A-ZÄÖÜ]/.test(it.lemma), `${it.id} capitalised`).toBe(true);
      if (it.plural) expect(/^[A-ZÄÖÜ]/.test(it.plural), `${it.id} plural`).toBe(true);
      expect(it.topic, `${it.id} topic`).toBeDefined();
    }
  });

  it("verbs carry complete forms", () => {
    for (const it of BUILTIN_ITEMS) {
      if (it.kind !== "verb") continue;
      expect(/^(hat|ist) \S+/.test(it.perf), `${it.id} perf "${it.perf}"`).toBe(true);
      expect(it.pres.du && it.pres.er && it.prat, it.id).toBeTruthy();
      expect(/\bsich\b/.test(it.pres.er) || /\bsich\b/.test(it.perf), `${it.id} forms without sich`).toBe(false);
      if (it.sep) {
        expect(it.pres.er.endsWith(` ${it.sep}`), `${it.id} sep in pres`).toBe(true);
        expect(it.prat.endsWith(` ${it.sep}`), `${it.id} sep in prat`).toBe(true);
        expect(it.lemma.startsWith(it.sep), `${it.id} lemma starts with sep`).toBe(true);
      }
    }
  });

  it("grammar items are complete and consistent", () => {
    for (const g of GRAMMAR) {
      expect(g.examples.length, g.id).toBe(3);
      expect(g.translate.length, g.id).toBe(3);
      expect(g.example.de, `${g.id} example = examples[0]`).toBe(g.examples[0].de);
      expect(g.name.length, `${g.id} name`).toBeLessThanOrEqual(24);
      expect(g.cue.length, `${g.id} cue`).toBeLessThanOrEqual(40);
      expect(g.errors.length, `${g.id} errors`).toBeGreaterThan(0);
      for (const e of g.errors) expect(Object.keys(ERROR_TYPES), `${g.id} error ${e}`).toContain(e);
      expect(g.rule.length, g.id).toBeGreaterThan(20);
      expect(g.tip.length, g.id).toBeGreaterThan(10);
    }
  });

  it("model answers for keyword structures use the keyword", () => {
    for (const g of GRAMMAR) {
      if (!g.keys?.length) continue;
      for (const t of g.translate) expect(mentions(t.de, g), `${g.id}: "${t.de}"`).toBe(true);
      for (const ex of g.examples) expect(mentions(ex.de, g), `${g.id}: "${ex.de}"`).toBe(true);
    }
  });

  it("examples use their own item, so detection works on real sentences", () => {
    const misses: string[] = [];
    for (const it of BUILTIN_ITEMS) {
      if (it.kind === "gram") continue;
      if (!mentions(it.example.de, it)) misses.push(`${it.id}: ${it.example.de}`);
    }
    // A few irregular forms may slip through the heuristic; it only drives a gentle hint.
    expect(misses.length, misses.join("\n")).toBeLessThanOrEqual(Math.ceil(BUILTIN_ITEMS.length * 0.02));
  });

  it("German quotes are balanced", () => {
    for (const it of BUILTIN_ITEMS) {
      for (const s of germanStrings(it)) {
        const open = (s.match(/„/g) ?? []).length;
        const close = (s.match(/“/g) ?? []).length;
        expect(open, `${it.id}: ${s}`).toBe(close);
      }
    }
  });

  it("scenarios cover every topic six times", () => {
    const ids = new Set(SCENARIOS.map((s) => s.id));
    expect(ids.size).toBe(SCENARIOS.length);
    for (const t of Object.keys(TOPICS) as TopicId[]) {
      expect(SCENARIOS.filter((s) => s.topic === t).length, t).toBe(6);
    }
  });

  it("the starter pack resolves", () => {
    const items = starterItems(makeCatalog([]), ["arbeit", "wohnen", "alltag"]);
    expect(items.filter((i) => i.kind === "gram").length).toBe(8);
    expect(items.length).toBeGreaterThanOrEqual(18);
  });
});
