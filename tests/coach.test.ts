import { describe, expect, it } from "vitest";
import { coachPrompt } from "../src/ai/prompts";
import type { GradeResult } from "../src/ai/schema";
import { makeCatalog } from "../src/content/catalog";
import { review, stageOf } from "../src/engine/srs";
import { buildShift, taskForItem } from "../src/engine/tasks";
import { applyGrade, unlock } from "../src/game/actions";
import {
  afterShift,
  applyDiagnosis,
  cleanShift,
  coachInput,
  FOCUS_DONE,
  FOCUS_SHIFTS,
  focusForShift,
  localDiagnosis,
  type ShiftLog,
} from "../src/game/coach";
import { xpForLevel } from "../src/game/economy";
import { newGame } from "../src/game/state";

const T0 = new Date("2026-10-26T09:00:00").getTime();
const catalog = makeCatalog([]);

function game() {
  const s = newGame(T0);
  s.onboarded = true;
  s.xp = xpForLevel(5);
  return s;
}

const dativ = (wrong: string, right: string) => ({ wrong, right, type: "case" as const, rule: "g.praep-dativ", explain: "mit + Dativ" });

function grade(id: string, ok: boolean): GradeResult {
  return {
    targets: [{ id, status: ok ? "correct" : "wrong", comment: "" }],
    quality: ok ? "perfect" : "major",
    corrected: "x",
    better: "",
    errors: [],
    praise: "",
    tip: "",
    source: "ai",
    by: "test",
  };
}

describe("coach without AI", () => {
  it("puts a grammar topic in focus after the same mistake twice", () => {
    const s = game();
    const log: ShiftLog = { mistakes: [dativ("mit den Kollege", "mit dem Kollegen"), dativ("aus die Stadt", "aus der Stadt")], results: [] };
    const d = localDiagnosis(s, catalog, log);
    expect(d.focus.map((f) => f.id)).toEqual(["g.praep-dativ"]);
    expect(d.focus[0].why).toContain("mit den Kollege");
    expect(d.note).toMatch(/Präpositionen|Dativ/);
  });

  it("ignores a single slip and a clean shift", () => {
    const s = game();
    expect(localDiagnosis(s, catalog, { mistakes: [dativ("mit den Kollege", "mit dem Kollegen")], results: [] }).focus).toEqual([]);
    const clean: ShiftLog = { mistakes: [], results: [{ id: "g.weil", status: "correct" }] };
    expect(cleanShift(clean)).toBe(true);
    expect(localDiagnosis(s, catalog, clean).focus).toEqual([]);
  });

  it("counts one new mistake on top of an earlier weak spot", () => {
    const s = game();
    s.stats.ruleHeat["g.praep-dativ"] = 3;
    const d = localDiagnosis(s, catalog, { mistakes: [dativ("mit den Kollege", "mit dem Kollegen")], results: [] });
    expect(d.focus.map((f) => f.id)).toEqual(["g.praep-dativ"]);
  });
});

describe("applying a diagnosis", () => {
  it("keeps only grammar the learner can reach, at most three, and delivers missing machines", () => {
    const s = game();
    applyDiagnosis(
      s,
      catalog,
      {
        note: "Gut gemacht.",
        focus: [
          { id: "g.praep-dativ", why: "mit den Kollege" },
          { id: "n.termin", why: "not grammar" },
          { id: "g.nope", why: "unknown" },
          { id: "g.futur2", why: "B2, not open yet" },
          { id: "g.weil", why: "a" },
          { id: "g.dass", why: "b" },
          { id: "g.obwohl", why: "c" },
        ],
      },
      "ai",
      T0,
    );
    expect(s.coach!.focus.map((f) => f.id)).toEqual(["g.praep-dativ", "g.weil", "g.dass"]);
    expect(s.coach!.focus.every((f) => f.left === FOCUS_SHIFTS)).toBe(true);
    expect(s.cards["g.praep-dativ"]).toBeDefined();
    expect(stageOf(s.cards["g.praep-dativ"])).toBe(0);
    expect(s.cards["g.futur2"]).toBeUndefined();
  });

  it("keeps unfinished topics from before, new ones first", () => {
    const s = game();
    applyDiagnosis(s, catalog, { note: "", focus: [{ id: "g.weil", why: "" }] }, "ai", T0);
    applyDiagnosis(s, catalog, { note: "", focus: [{ id: "g.praep-dativ", why: "" }] }, "ai", T0 + 1);
    expect(s.coach!.focus.map((f) => f.id)).toEqual(["g.praep-dativ", "g.weil"]);
  });
});

describe("focus in the next shifts", () => {
  it("adds focus practice early in the shift, and a focus blueprint even past today's limit", () => {
    const s = game();
    const weil = catalog.get("g.weil")!;
    unlock(s, weil, T0);
    s.cards[weil.id] = review(s.cards[weil.id], "correct", { now: T0, sentence: "x" }).card;
    applyDiagnosis(s, catalog, { note: "", focus: [{ id: "g.weil", why: "" }, { id: "g.praep-dativ", why: "" }] }, "ai", T0);
    const tasks = buildShift({ cards: s.cards, catalog, now: T0 + 3600_000, weakRules: [], size: 8, maxNew: 0, focus: focusForShift(s) });
    const focus = tasks.filter((t) => t.reason === "focus");
    expect(focus.map((t) => t.targets[0])).toEqual(["g.weil"]);
    expect(tasks.findIndex((t) => t.reason === "focus")).toBeLessThan(3);
    expect(tasks.some((t) => t.reason === "new" && t.targets.includes("g.praep-dativ"))).toBe(true);
  });

  it("counts down per shift and ends a topic once it sits", () => {
    const s = game();
    applyDiagnosis(s, catalog, { note: "", focus: [{ id: "g.weil", why: "" }, { id: "g.dass", why: "" }] }, "ai", T0);
    afterShift(s, new Set(["g.weil"]));
    expect(s.coach!.focus.find((f) => f.id === "g.weil")!.left).toBe(FOCUS_SHIFTS - 1);
    expect(s.coach!.focus.find((f) => f.id === "g.dass")!.left).toBe(FOCUS_SHIFTS);
    const weil = catalog.get("g.weil")!;
    unlock(s, weil, T0);
    const task = taskForItem(weil, s.cards[weil.id], catalog, T0, "focus");
    for (let i = 0; i < FOCUS_DONE; i++) applyGrade(s, catalog, task, grade("g.weil", true), "Ich komme, weil ich Zeit habe.", T0 + i);
    applyGrade(s, catalog, taskForItem(catalog.get("g.dass")!, s.cards["g.dass"] ?? s.cards[weil.id], catalog, T0, "focus"), grade("g.dass", false), "x", T0);
    const done = afterShift(s, new Set(["g.weil"]));
    expect(done.map((f) => f.id)).toEqual(["g.weil"]);
    expect(s.coach!.focus.map((f) => f.id)).toEqual(["g.dass"]);
    expect(s.coach!.focus[0].streak).toBe(0);
  });
});

describe("the coach prompt", () => {
  it("lists the mistakes, the level and only reachable grammar", () => {
    const s = game();
    const log: ShiftLog = { mistakes: [dativ("mit den Kollege", "mit dem Kollegen")], results: [{ id: "g.weil", status: "wrong" }] };
    const inp = coachInput(s, catalog, log, 6);
    expect(inp.allowed.some((g) => g.id === "g.praep-dativ")).toBe(true);
    expect(inp.allowed.some((g) => g.level === "B2")).toBe(false);
    const p = coachPrompt(inp, catalog, "en", "A2+");
    expect(p).toContain('"mit den Kollege" → "mit dem Kollegen"');
    expect(p).toContain("g.praep-dativ:");
    expect(p).toContain("Wortschatz");
    expect(p).not.toContain("g.futur2");
  });
});
