import { describe, expect, it, vi } from "vitest";

// The game logic is tested against a tiny fixed catalog, independent of the curriculum files.
vi.mock("../src/content/catalog", () => {
  const items = [
    {
      id: "g.weil",
      kind: "gram",
      hall: "satzbau",
      level: "A2",
      de: "weil + Nebensatz",
      en: "because",
      name: "weil",
      cue: "weil … (Verb ans Ende)",
      rule: "weil sends the verb to the end.",
      pattern: "…, weil + Subjekt + … + Verb.",
      example: { de: "Ich bleibe zu Hause, weil ich krank bin.", en: "I stay at home because I am ill." },
      examples: [{ de: "Ich bleibe zu Hause, weil ich krank bin.", en: "I stay at home because I am ill." }],
      translate: [{ en: "I am tired because I worked a lot.", de: "Ich bin müde, weil ich viel gearbeitet habe." }],
      tip: "Verb at the end.",
      errors: ["word_order"],
      keys: ["weil"],
    },
    {
      id: "n.termin",
      kind: "noun",
      hall: "woerter",
      level: "A2",
      de: "der Termin",
      en: "appointment",
      topic: "alltag",
      lemma: "Termin",
      gender: "m",
      plural: "Termine",
      example: { de: "Ich habe einen Termin.", en: "I have an appointment." },
    },
  ];
  const scenarios = [{ id: "s.alltag-1", topic: "alltag", de: "Du hast morgen viel vor.", en: "You have a lot planned tomorrow." }];
  const makeCatalog = () => ({
    items,
    get: (id: string) => items.find((i) => i.id === id),
    inHall: (h: string) => items.filter((i) => i.hall === h),
    scenarios,
    scenariosFor: () => scenarios,
  });
  return { BUILTIN_ITEMS: items, GRAMMAR: items.filter((i) => i.kind === "gram"), SCENARIOS: scenarios, makeCatalog };
});

const { makeCatalog } = await import("../src/content/catalog");
const { applyGrade, buyUpgrade, claimChest, finishShift, rollover, tick, unlock } = await import("../src/game/actions");
const { factoryRate, idleEarnings, levelOf, perSentence, storageHours, xpForLevel } = await import("../src/game/economy");
const { newGame } = await import("../src/game/state");
const { buildShift } = await import("../src/engine/tasks");
const { coerceGrade } = await import("../src/ai/schema");

const HOUR = 3_600_000;
const T0 = new Date("2026-10-26T09:00:00").getTime();
const catalog = makeCatalog([]);

function grade(status: "correct" | "wrong", ids = ["n.termin"]) {
  return {
    targets: ids.map((id) => ({ id, status, comment: "" })),
    quality: status === "correct" ? ("perfect" as const) : ("major" as const),
    corrected: "Ich habe morgen einen Termin.",
    better: "",
    errors: status === "correct" ? [] : [{ wrong: "einen", right: "einen", type: "case" as const, rule: "g.weil", explain: "" }],
    praise: "",
    tip: "",
    source: "ai" as const,
    by: "test",
  };
}

describe("economy", () => {
  it("blueprints produce nothing until built, then earn idle Taler", () => {
    const s = newGame(T0);
    unlock(s, catalog.get("n.termin")!, T0);
    expect(factoryRate(s, catalog, T0)).toBe(0);
    const task = buildShift({ cards: s.cards, catalog, now: T0, weakRules: [], size: 10 }).find((t) => t.type !== "intro")!;
    applyGrade(s, catalog, task, grade("correct"), "Ich habe morgen einen Termin.", T0);
    expect(factoryRate(s, catalog, T0)).toBeGreaterThan(0);
    const e = idleEarnings({ ...s, lastTick: T0 }, catalog, T0 + 2 * HOUR);
    expect(e.amount).toBeGreaterThan(0);
    expect(e.capped).toBe(false);
  });

  it("caps offline production at the storage size", () => {
    const s = newGame(T0);
    unlock(s, catalog.get("n.termin")!, T0);
    const task = buildShift({ cards: s.cards, catalog, now: T0, weakRules: [], size: 10 }).find((t) => t.type !== "intro")!;
    applyGrade(s, catalog, task, grade("correct"), "x", T0);
    s.lastTick = T0;
    const e = idleEarnings(s, catalog, T0 + 48 * HOUR);
    expect(e.capped).toBe(true);
    expect(e.hours).toBe(storageHours(s));
  });

  it("never charges for learning material", () => {
    const s = newGame(T0);
    const before = s.taler;
    expect(unlock(s, catalog.get("g.weil")!, T0)).toBeNull();
    expect(s.taler).toBe(before);
    expect(unlock(s, catalog.get("g.weil")!, T0)).toBe("owned");
  });

  it("pays one Taler per clean sentence at the start, more with the toolbox", () => {
    const s = newGame(T0);
    expect(perSentence(s)).toBe(1);
    s.taler = 1e6;
    expect(buyUpgrade(s, "werkzeug")).toBe(true);
    expect(perSentence(s)).toBe(2);
    expect(buyUpgrade(s, "arbeiter")).toBe(true);
    expect(factoryRate(s, catalog, T0)).toBeGreaterThan(0);
  });

  it("buildings are built once", () => {
    const s = newGame(T0);
    s.taler = 1e7;
    expect(buyUpgrade(s, "kantine")).toBe(true);
    expect(buyUpgrade(s, "kantine")).toBe(false);
    expect(perSentence(s)).toBeCloseTo(1.25);
  });

  it("levels follow the XP curve", () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(xpForLevel(2))).toBe(2);
    expect(levelOf(xpForLevel(5) - 1)).toBe(4);
  });

  it("upgrades cost Taler and stop at max level", () => {
    const s = newGame(T0);
    s.taler = 1e9;
    for (let i = 0; i < 10; i++) buyUpgrade(s, "lagerhalle");
    expect(s.upgrades.lagerhalle).toBe(4);
    expect(storageHours(s)).toBe(24);
  });
});

describe("a graded answer", () => {
  it("builds the machine, pays, raises the combo and logs the sentence", () => {
    const s = newGame(T0);
    unlock(s, catalog.get("n.termin")!, T0);
    const task = buildShift({ cards: s.cards, catalog, now: T0, weakRules: [], size: 10 }).find((t) => t.type !== "intro")!;
    const ev = applyGrade(s, catalog, task, grade("correct"), "Ich habe morgen einen Termin.", T0);
    expect(ev.success).toBe(true);
    expect(ev.built).toEqual(["n.termin"]);
    expect(ev.taler).toBeGreaterThan(0);
    expect(s.combo).toBeCloseTo(1.1);
    expect(s.journal[0].corrected).toBe("Ich habe morgen einen Termin.");
    expect(s.stats.sentences).toBe(1);
  });

  it("a wrong answer resets the combo, never pays zero, and heats the rule", () => {
    const s = newGame(T0);
    unlock(s, catalog.get("n.termin")!, T0);
    s.combo = 1.5;
    const task = buildShift({ cards: s.cards, catalog, now: T0, weakRules: [], size: 10 }).find((t) => t.type !== "intro")!;
    const ev = applyGrade(s, catalog, task, grade("wrong"), "x", T0);
    expect(ev.success).toBe(false);
    expect(ev.comboBroken).toBe(true);
    expect(s.combo).toBe(1);
    expect(ev.taler).toBeGreaterThanOrEqual(1);
    expect(s.stats.ruleHeat["g.weil"]).toBe(1);
  });

  it("counts the daily goal towards the streak", () => {
    const s = newGame(T0);
    s.settings.dailyGoal = 2;
    unlock(s, catalog.get("n.termin")!, T0);
    const task = buildShift({ cards: s.cards, catalog, now: T0, weakRules: [], size: 10 }).find((t) => t.type !== "intro")!;
    applyGrade(s, catalog, task, grade("correct"), "a", T0);
    const ev = applyGrade(s, catalog, task, grade("correct"), "b", T0 + 1000);
    expect(ev.streakUp).toBe(true);
    expect(s.streak.current).toBe(1);
  });
});

describe("days", () => {
  it("creates daily orders and resets the streak after a missed day", () => {
    const s = newGame(T0);
    rollover(s, catalog, T0);
    expect(s.orders.list.length).toBe(3);
    s.streak = { current: 5, best: 5, lastDay: "2026-10-24", freezes: 0 };
    rollover(s, catalog, T0);
    expect(s.streak.current).toBe(0);
  });

  it("a streak freeze covers a missed day", () => {
    const s = newGame(T0);
    s.streak = { current: 5, best: 5, lastDay: "2026-10-24", freezes: 1 };
    rollover(s, catalog, T0);
    expect(s.streak.current).toBe(5);
    expect(s.streak.freezes).toBe(0);
  });

  it("the chest opens only when all orders are done", () => {
    const s = newGame(T0);
    rollover(s, catalog, T0);
    expect(claimChest(s, catalog, T0)).toBeNull();
    for (const o of s.orders.list) o.done = true;
    expect(claimChest(s, catalog, T0)).not.toBeNull();
    expect(claimChest(s, catalog, T0)).toBeNull();
  });

  it("idle ticks never pay twice for the same time", () => {
    const s = newGame(T0);
    unlock(s, catalog.get("n.termin")!, T0);
    const task = buildShift({ cards: s.cards, catalog, now: T0, weakRules: [], size: 10 }).find((t) => t.type !== "intro")!;
    applyGrade(s, catalog, task, grade("correct"), "a", T0);
    s.lastTick = T0;
    const a = tick(s, catalog, T0 + HOUR).amount;
    const b = tick(s, catalog, T0 + HOUR).amount;
    expect(a).toBeGreaterThan(0);
    expect(b).toBe(0);
    expect(finishShift(s, catalog, T0 + HOUR).bonus).toBeGreaterThan(0);
  });
});

describe("corrector output", () => {
  it("tolerates sloppy JSON from small models", () => {
    const g = coerceGrade(
      { targets: [{ id: "n.termin", status: "great" }], errors: [{ wrong: "der", right: "dem", type: "kasus" }], corrected: "Ich fahre mit dem Bus." },
      ["n.termin", "g.weil"],
      (id) => (id === "g.weil" ? "missing" : "correct"),
    );
    expect(g.targets).toEqual([
      { id: "n.termin", status: "correct", comment: "" },
      { id: "g.weil", status: "missing", comment: "" },
    ]);
    expect(g.errors[0].type).toBe("other");
    expect(g.quality).toBe("minor");
  });
});

describe("cloud save", () => {
  it("splits into documents under 256 KiB and joins back", async () => {
    const { split, join, MAX_CUSTOM } = await import("../src/store/persist");
    const s = newGame(T0);
    s.custom = Array.from({ length: MAX_CUSTOM }, (_, i) => ({
      id: `c.wort-${i}`,
      kind: "word" as const,
      hall: "woerter" as const,
      level: "B1" as const,
      de: `ein ziemlich langes importiertes Wort Nummer ${i}`,
      en: `a fairly long imported word number ${i} with a long meaning`,
      lemma: `Wort${i}`,
      example: { de: "", en: "" },
    }));
    s.journal = Array.from({ length: 300 }, (_, i) => ({
      t: T0 + i,
      type: "produce" as const,
      targets: ["n.termin", "g.weil"],
      prompt: "Die Heizung in deiner Wohnung ist seit gestern kaputt. Du schreibst deinem Vermieter.",
      answer: "Ich schreibe Ihnen, weil die Heizung in meiner Wohnung seit gestern nicht funktioniert.",
      corrected: "Ich schreibe Ihnen, weil die Heizung in meiner Wohnung seit gestern nicht funktioniert.",
      quality: "minor" as const,
      errors: [{ type: "punctuation" as const, wrong: "Ihnen weil", right: "Ihnen, weil", explain: "Comma before a subordinate clause." }],
    }));
    s.settings.ai.anthropicKey = "sk-ant-secret";
    const docs = split(s);
    for (const [name, body] of Object.entries(docs)) {
      expect(JSON.stringify(body).length, name).toBeLessThan(256 * 1024);
    }
    expect(JSON.stringify(docs)).not.toContain("sk-ant-secret");
    const back = join(docs, T0)!;
    expect(back.custom.length).toBe(MAX_CUSTOM);
    expect(back.journal.length).toBe(200);
    expect(back.settings.ai.anthropicKey).toBe("");
  });
});
