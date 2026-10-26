import { describe, expect, it } from "vitest";
import type { GradeResult } from "../src/ai/schema";
import type { Catalog } from "../src/content/catalog";
import type { Item, Level } from "../src/content/types";
import {
  levelLabel,
  newLevelState,
  observe,
  observeAi,
  overall,
  recommend,
  refreshCount,
  refreshers,
  seedFromHistory,
} from "../src/engine/level";
import { stageOf } from "../src/engine/srs";
import { buildShift, refreshTask } from "../src/engine/tasks";
import { applyGrade, deliver, queuedBlueprints } from "../src/game/actions";
import { newGame } from "../src/game/state";

const T0 = new Date("2026-10-26T09:00:00").getTime();

function noun(id: string, level: Level, topic: Item["topic"] = "alltag"): Item {
  const lemma = id[0].toUpperCase() + id.slice(1);
  return {
    id: `n.${id}`,
    kind: "noun",
    hall: "woerter",
    level,
    topic,
    de: `der ${lemma}`,
    en: id,
    lemma,
    gender: "m",
    plural: null,
    example: { de: `Der ${lemma} ist da.`, en: "" },
  };
}

function verb(id: string, level: Level): Item {
  return {
    id: `v.${id}`,
    kind: "verb",
    hall: "verben",
    level,
    topic: "alltag",
    de: id,
    en: id,
    lemma: id,
    pres: { du: `${id}st`, er: `${id}t` },
    prat: `${id}te`,
    perf: `hat ge${id}t`,
    example: { de: `Ich ${id}e.`, en: "" },
  };
}

function gram(id: string, level: Level): Item {
  return {
    id: `g.${id}`,
    kind: "gram",
    hall: "satzbau",
    level,
    de: id,
    en: id,
    name: id,
    cue: id,
    rule: "A rule that is long enough.",
    pattern: "x",
    example: { de: "Ich weiß, dass es geht.", en: "" },
    examples: [
      { de: "Ich weiß, dass es geht.", en: "" },
      { de: "Ich glaube, dass er kommt.", en: "" },
      { de: "Sie sagt, dass sie müde ist.", en: "" },
    ],
    translate: [
      { en: "I know it works.", de: "Ich weiß, dass es geht." },
      { en: "a", de: "b" },
      { en: "c", de: "d" },
    ],
    tip: "A useful tip.",
    errors: ["word_order"],
    keys: ["dass"],
  };
}

function catalogOf(items: Item[]): Catalog {
  const byId = new Map(items.map((i) => [i.id, i] as const));
  return {
    items,
    get: (id) => byId.get(id),
    inHall: (h) => items.filter((i) => i.hall === h),
    scenarios: [{ id: "s.1", topic: "alltag", de: "Du bist zu Hause.", en: "You are at home." }],
    scenariosFor: () => [{ id: "s.1", topic: "alltag", de: "Du bist zu Hause.", en: "You are at home." }],
    situationsOf: () => [],
  };
}

const ITEMS: Item[] = [
  ...["haus", "tisch", "stuhl", "brot", "bus", "zug"].map((w) => noun(w, "A1")),
  ...["termin", "vertrag", "urlaub", "kollege", "rechnung", "antrag", "ausweis", "umzug"].map((w) => noun(w, "A2")),
  ...["vorschlag", "zustand", "eindruck", "vorteil", "zweifel", "anspruch"].map((w) => noun(w, "B1")),
  ...["arbeit", "lern", "koch", "spiel"].map((w) => verb(w, "A2")),
  ...["beantrag", "verlang"].map((w) => verb(w, "B1")),
  gram("artikel", "A1"),
  gram("dass", "A2"),
  gram("obwohl", "B1"),
];
const catalog = catalogOf(ITEMS);

function grade(ids: string[], status: "correct" | "wrong"): GradeResult {
  return {
    targets: ids.map((id) => ({ id, status, comment: "" })),
    quality: status === "correct" ? "perfect" : "major",
    corrected: "x",
    better: "",
    errors: [],
    praise: "",
    tip: "",
    source: "ai",
    by: "test",
  };
}

describe("level estimate", () => {
  it("rises when B1 items go right and falls when A2 items go wrong", () => {
    const up = newLevelState();
    for (let i = 0; i < 30; i++) observe(up, noun(`b${i}`, "B1"), "correct", 0);
    expect(up.areas.wortschatz.theta).toBeGreaterThan(3);
    const down = newLevelState();
    for (let i = 0; i < 30; i++) observe(down, noun(`a${i}`, "A2"), "wrong", 0);
    expect(down.areas.wortschatz.theta).toBeLessThan(2);
    expect(down.areas.satzbau.theta).toBe(2.5);
  });

  it("learns less from items practised many times", () => {
    const fresh = newLevelState();
    const drilled = newLevelState();
    observe(fresh, noun("x", "B1"), "correct", 0);
    observe(drilled, noun("x", "B1"), "correct", 12);
    expect(fresh.areas.wortschatz.theta - 2.5).toBeGreaterThan(3 * (drilled.areas.wortschatz.theta - 2.5));
  });

  it("blends in the corrector's reading of the sentences", () => {
    const ls = newLevelState();
    for (let i = 0; i < 10; i++) observeAi(ls, "B1");
    expect(ls.ai.theta).toBeGreaterThan(3.2);
    expect(overall(ls).theta).toBeGreaterThan(2.7);
  });

  it("starts an existing save from its own history", () => {
    const ls = newLevelState();
    const history = ITEMS.filter((i) => i.level === "B1").map((item) => ({ item, ok: 4, fail: 0 }));
    seedFromHistory(ls, history);
    expect(ls.seeded).toBe(true);
    expect(overall(ls).theta).toBeGreaterThan(2.5);
  });

  it("labels the scale", () => {
    expect(levelLabel(2.7).code).toBe("A2+");
    expect(levelLabel(3.1)).toMatchObject({ code: "B1", band: "B1", next: "B2" });
    expect(levelLabel(1.2).code).toBe("A1");
  });
});

describe("recommendations", () => {
  const base = { catalog, cards: {}, hallOpen: () => true, weak: [], errorTypes: [], seed: "2026-10-26" };

  it("aim just above the current level and skip A1 for an A2 learner", () => {
    const ls = newLevelState(2.2);
    const recs = recommend({ ...base, level: ls }, 6);
    expect(recs.length).toBe(6);
    expect(recs.some((r) => r.level === "A1")).toBe(false);
    expect(new Set(recs.map((r) => r.kind)).size).toBeGreaterThan(1);
  });

  it("put grammar for frequent mistakes first", () => {
    const ls = newLevelState(2.5);
    const recs = recommend({ ...base, level: ls, errorTypes: ["word_order"], weak: ["g.obwohl"] }, 3);
    expect(recs[0].id).toBe("g.obwohl");
  });

  it("refresh A1 basics, more of them after basic mistakes", () => {
    const ls = newLevelState(2.6);
    expect(refreshCount(ls, 10)).toBe(1);
    ls.basics = 4;
    expect(refreshCount(ls, 10)).toBe(3);
    const r = refreshers({ catalog, cards: {}, level: ls, hallOpen: () => true, seed: "x" }, 3);
    expect(r.length).toBe(3);
    expect(r.every((it) => it.level === "A1")).toBe(true);
    expect(r[0].kind).toBe("gram");
  });
});

describe("daily delivery", () => {
  it("tops the queue up to today's allowance, once", () => {
    const s = newGame(T0);
    s.onboarded = true;
    s.settings.newPerDay = 5;
    const got = deliver(s, catalog, T0);
    expect(got.length).toBe(5);
    expect(queuedBlueprints(s)).toBe(5);
    expect(deliver(s, catalog, T0 + 1000).length).toBe(0);
    expect(s.delivery?.ids.length).toBe(5);
  });

  it("waits for onboarding and respects the setting", () => {
    const s = newGame(T0);
    expect(deliver(s, catalog, T0).length).toBe(0);
    s.onboarded = true;
    s.settings.autoDeliver = false;
    expect(deliver(s, catalog, T0).length).toBe(0);
  });
});

describe("A1 refreshers", () => {
  it("a basic known on first sight becomes a running machine without using the new-machine allowance", () => {
    const s = newGame(T0);
    const it = catalog.get("n.haus")!;
    const task = refreshTask(it, T0, catalog);
    expect(task.reason).toBe("refresh");
    expect(task.cues[0].label).toBe(it.en);
    const ev = applyGrade(s, catalog, task, grade([it.id], "correct"), "Das Haus ist groß.", T0);
    expect(ev.confirmed).toEqual([it.id]);
    expect(ev.built).toEqual([]);
    expect(stageOf(s.cards[it.id])).toBeGreaterThanOrEqual(2);
    expect(s.stats.days["2026-10-26"].built).toBe(0);
  });

  it("a forgotten basic becomes a blueprint to learn", () => {
    const s = newGame(T0);
    const it = catalog.get("g.artikel")!;
    applyGrade(s, catalog, refreshTask(it, T0, catalog), grade([it.id], "wrong"), "x", T0);
    expect(stageOf(s.cards[it.id])).toBe(0);
    expect(s.level.areas.satzbau.theta).toBeLessThan(2.5);
  });

  it("shifts include the refreshers they are given", () => {
    const s = newGame(T0);
    const tasks = buildShift({ cards: s.cards, catalog, now: T0, weakRules: [], size: 10, refresh: [catalog.get("n.tisch")!] });
    expect(tasks.filter((t) => t.reason === "refresh").map((t) => t.targets[0])).toEqual(["n.tisch"]);
  });
});
