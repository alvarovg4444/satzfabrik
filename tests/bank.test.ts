import { beforeEach, describe, expect, it } from "vitest";
import { applyBank, banked, bankPut, resetBankMemory } from "../src/ai/bank";
import { makeCatalog } from "../src/content/catalog";
import { newCard } from "../src/engine/srs";
import { taskForItem, type Task } from "../src/engine/tasks";
import { unlock } from "../src/game/actions";
import { planShift } from "../src/game/plan";
import { starterItems } from "../src/game/starter";
import { newGame } from "../src/game/state";

const T0 = new Date("2026-10-26T09:00:00").getTime();
const catalog = makeCatalog([]);

const produce = (id: string, key = `${id}:p`): Task => ({
  key,
  type: "produce",
  targets: [id],
  instruction: "",
  instructionEn: "",
  scenario: { de: "eingebaut", en: "built in" },
  cues: [],
  reason: "due",
});

describe("the situation bank", () => {
  beforeEach(() => resetBankMemory());

  it("gives a word's banked situation to its next writing task, once", () => {
    bankPut("n.lkw", "s", { de: "Ein Lkw blockiert deine Einfahrt.", en: "A lorry blocks your drive." });
    expect(banked("n.lkw", "s")).toBe(1);
    const first = applyBank([produce("n.lkw"), produce("n.miete")]);
    expect(first.tasks[0].scenario?.de).toBe("Ein Lkw blockiert deine Einfahrt.");
    expect(first.tasks[1].scenario?.de).toBe("eingebaut");
    expect([...first.filled]).toEqual(["n.lkw:p"]);
    // used up: the next time the built-in one shows (until the AI writes another)
    expect(applyBank([produce("n.lkw")]).tasks[0].scenario?.de).toBe("eingebaut");
  });

  it("fills translations with a new sentence and its model answer", () => {
    bankPut("g.weil", "t", { source: "I stayed home because it was raining.", reference: "Ich bin zu Hause geblieben, weil es geregnet hat." });
    const t: Task = { ...produce("g.weil"), type: "translate", scenario: undefined, source: "old", reference: "alt" };
    const out = applyBank([t]).tasks[0];
    expect(out.source).toBe("I stayed home because it was raining.");
    expect(out.reference).toBe("Ich bin zu Hause geblieben, weil es geregnet hat.");
  });

  it("keeps at most three per word, oldest out, and no duplicates", () => {
    for (const n of [1, 2, 3, 4, 4]) bankPut("n.termin", "s", { de: `S${n}`, en: `S${n}` });
    expect(banked("n.termin", "s")).toBe(3);
    const got = applyBank([produce("n.termin", "a"), produce("n.termin", "b"), produce("n.termin", "c")]).tasks.map((t) => t.scenario?.de);
    expect(got).toEqual(["S2", "S3", "S4"]);
  });

  it("leaves tasks with several words alone (they get their situation fresh)", () => {
    bankPut("n.lkw", "s", { de: "x", en: "x" });
    const combo: Task = { ...produce("n.lkw"), type: "combo", targets: ["n.lkw", "g.weil"] };
    expect(applyBank([combo]).filled.size).toBe(0);
  });
});

describe("built-in situations vary", () => {
  it("between games and shifts, but not within one", () => {
    const it0 = catalog.get("n.termin")!;
    const card = newCard(it0.id, T0);
    const pick = (salt: string) => taskForItem(it0, card, catalog, T0, "new", salt).scenario?.de;
    expect(pick("a")).toBe(pick("a"));
    const picks = new Set(["g1|0", "g2|0", "g3|0", "g1|1", "g1|2", "g4|0", "g5|0", "g6|0"].map(pick));
    // the word has two situations of its own: different games and shifts get both
    expect(picks.size).toBe(2);
  });

  it("a new game's first shift is planned with its own salt", () => {
    const shift = (createdAt: number) => {
      const s = newGame(createdAt);
      for (const it of starterItems(catalog, ["arbeit", "wohnen", "alltag"])) unlock(s, it, T0);
      return planShift(s, catalog, T0, false)
        .filter((t) => t.scenario || t.source)
        .map((t) => t.scenario?.de ?? t.source);
    };
    expect(shift(T0)).toEqual(shift(T0));
    expect(shift(T0)).not.toEqual(shift(T0 + 1));
  });
});
