import { describe, expect, it } from "vitest";
import { makeCatalog } from "../src/content/catalog";
import { buildDrillRound } from "../src/engine/drills";
import { holdOff, MAX_HOLDS, newCard, review } from "../src/engine/srs";
import { dayKey } from "../src/engine/text";
import { applyCard, applyDrill, STREAK_CARDS, unlock } from "../src/game/actions";
import { migrate, newGame } from "../src/game/state";
import { AKKORD_KINDS, cardQueue, checkCard, drillFocus } from "../src/game/training";

const T0 = new Date("2026-10-26T09:00:00").getTime();
const DAY = 86_400_000;
const catalog = makeCatalog([]);

/** A machine built a while ago that is due now. */
function rusty(id: string) {
  let c = newCard(id, T0 - 20 * DAY);
  c = review(c, "correct", { now: T0 - 20 * DAY }).card;
  return { ...c, due: T0 - DAY };
}

describe("Schnellkarten", () => {
  it("want the article for nouns and forgive sich, ß/ss and capitals", () => {
    const termin = catalog.get("n.termin")!;
    expect(checkCard(termin, "der Termin")).toBe("ok");
    expect(checkCard(termin, "Der termin")).toBe("ok");
    expect(checkCard(termin, "die Termin")).toBe("article");
    expect(checkCard(termin, "Termin")).toBe("article");
    expect(checkCard(termin, "Tisch")).toBe("wrong");
    expect(checkCard(termin, "")).toBe("wrong");
    const verb = catalog.items.find((i) => i.kind === "verb" && i.de.startsWith("sich "))!;
    expect(checkCard(verb, verb.de)).toBe("ok");
    expect(checkCard(verb, verb.de.replace(/^sich /, ""))).toBe("ok");
  });

  it("ask the rusting machines first, then today's new words, never grammar", () => {
    const s = newGame(T0);
    s.cards["n.termin"] = rusty("n.termin");
    unlock(s, catalog.get("n.miete")!, T0);
    unlock(s, catalog.get("g.weil")!, T0);
    const q = cardQueue(s, catalog, T0).map((i) => i.id);
    expect(q[0]).toBe("n.termin");
    expect(q).toContain("n.miete");
    expect(q).not.toContain("g.weil");
  });

  it("hold off the rust a few days, but only twice before a sentence is needed", () => {
    let c = rusty("n.termin");
    for (let k = 0; k < MAX_HOLDS; k++) {
      c = holdOff(c, T0);
      expect(c.due).toBeGreaterThan(T0);
      c = { ...c, due: T0 - 1 };
    }
    expect(holdOff(c, T0).due).toBe(T0 - 1);
    // a sentence is a real review and resets the count
    const after = review(c, "correct", { now: T0 }).card;
    expect(after.held).toBe(0);
  });

  it("a missed card makes the word due and hot for Akkord; a round keeps the flame", () => {
    const s = newGame(T0);
    s.cards["n.termin"] = { ...rusty("n.termin"), due: T0 + 5 * DAY };
    applyCard(s, catalog, T0, "n.termin", false);
    expect(s.cards["n.termin"].due).toBeLessThanOrEqual(T0);
    expect(s.stats.wordHeat?.["n.termin"]).toBe(1);
    let up = false;
    for (let k = 1; k < STREAK_CARDS; k++) up = applyCard(s, catalog, T0 + k, "n.miete", true).streakUp || up;
    expect(up).toBe(true);
    expect(s.streak.current).toBe(1);
    expect(s.stats.days[dayKey(T0)].cards).toBe(STREAK_CARDS);
  });
});

describe("another right word (the AI said it means the same)", () => {
  it("counts for the round but holds nothing off and moves no Fehlerwort", () => {
    const s = newGame(T0);
    const due = rusty("n.termin");
    s.cards["n.termin"] = due;
    const r = applyCard(s, catalog, T0, "n.termin", "synonym");
    expect(r.taler).toBeGreaterThan(0);
    expect(s.cards["n.termin"].due).toBe(due.due);
    expect(s.stats.days[dayKey(T0)].cardsOk).toBe(1);
  });
});

describe("Akkord", () => {
  it("practises the forms behind the learner's mistakes, and their missed words", () => {
    const s = newGame(T0);
    expect(drillFocus(s).focus).toEqual([]);
    s.stats.ruleHeat["g.adj-bestimmter-artikel"] = 3;
    s.stats.days[dayKey(T0)] = { ...s.stats.days[dayKey(T0)], tasks: 0, good: 0, perfect: 0, drills: 0, drillOk: 0, taler: 0, shifts: 0, built: 0, repaired: 0, errors: { aux: 4 } };
    const f = drillFocus(s);
    expect(f.focus[0]).toBe("adj_ending");
    expect(f.focus).toContain("perfekt");
    expect(f.mix.filter((k) => k === "adj_ending").length).toBe(4);
    // no der/die/das or plural questions: those are on the cards
    const round = buildDrillRound(catalog.items, catalog.items, 1, 40, f.mix);
    expect(round.every((q) => AKKORD_KINDS.includes(q.kind))).toBe(true);
  });

  it("turns misses into weak spots for the shifts", () => {
    const s = newGame(T0);
    applyDrill(s, catalog, T0, { correct: 3, total: 5, earned: 10, misses: [{ kind: "adj_ending", itemId: "n.termin" }, { kind: "adj_ending" }] });
    expect(s.stats.ruleHeat["g.adj-bestimmter-artikel"]).toBe(1);
    expect(s.stats.wordHeat?.["n.termin"]).toBe(1);
  });
});

describe("keyboard", () => {
  it("the phone's own keyboard is the default, also for older saves", () => {
    expect(newGame(T0).settings.keyboard).toBe(false);
    const old = { ...newGame(T0), settings: { ...newGame(T0).settings, keyboard: true } } as Record<string, unknown>;
    delete (old.settings as Record<string, unknown>).drillTimer;
    expect(migrate(old, T0).settings.keyboard).toBe(false);
    const chosen = newGame(T0);
    chosen.settings.keyboard = true;
    expect(migrate(chosen, T0).settings.keyboard).toBe(true);
  });
});
