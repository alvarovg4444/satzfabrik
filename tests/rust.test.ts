import { describe, expect, it } from "vitest";
import { BUILTIN_ITEMS, makeCatalog } from "../src/content/catalog";
import { holdOff, MAX_HOLDS, newCard, review } from "../src/engine/srs";
import { buildShift, MAX_DUE_PER_SHIFT } from "../src/engine/tasks";
import { newGame } from "../src/game/state";
import { trainingCards, CARDS_PER_ROUND } from "../src/game/training";

const T0 = new Date("2026-10-26T09:00:00").getTime();
const DAY = 86_400_000;
const catalog = makeCatalog([]);
const words = BUILTIN_ITEMS.filter((i) => i.kind === "noun" || i.kind === "verb");

function rusty(id: string, daysOver: number) {
  let c = newCard(id, T0 - 30 * DAY);
  c = review(c, "correct", { now: T0 - 20 * DAY }).card;
  return { ...c, due: T0 - daysOver * DAY };
}

/** 25 built machines, the first `nDue` rusting, plus 12 blueprints. */
function factory(nDue: number) {
  const cards: Record<string, ReturnType<typeof newCard>> = {};
  words.slice(0, 25).forEach((it, i) => (cards[it.id] = i < nDue ? rusty(it.id, i + 1) : { ...rusty(it.id, 0), due: T0 + 5 * DAY }));
  words.slice(25, 37).forEach((it, i) => (cards[it.id] = newCard(it.id, T0 - i)));
  return cards;
}
const rustIds = (n: number) => words.slice(0, n).map((w) => w.id);
const covered = (tasks: { targets: string[] }[], ids: string[]) => ids.filter((id) => tasks.some((t) => t.targets.includes(id)));

describe("rust in shifts", () => {
  it("a normal shift takes every rusting machine, ahead of focus, weak spot and refreshers", () => {
    const cards = factory(6);
    const tasks = buildShift({
      cards, catalog, now: T0, size: 10, maxNew: 3,
      focus: [words[6].id, words[7].id], weakRules: [words[8].id], refresh: words.slice(300, 302),
    });
    expect(covered(tasks, rustIds(6))).toHaveLength(6);
    const firstOther = tasks.findIndex((t) => ["focus", "weak", "refresh"].includes(t.reason));
    const lastDue = tasks.map((t) => t.reason).lastIndexOf("due");
    expect(firstOther).toBeGreaterThan(lastDue);
    expect(tasks.filter((t) => t.reason === "new" && t.type === "intro")).toHaveLength(3);
  });

  it("a Wartungsschicht is only the rusting machines, even past the shift size", () => {
    const cards = factory(14);
    const tasks = buildShift({
      cards, catalog, now: T0, size: 10, maxNew: 3, maintenance: true,
      focus: [words[20].id], weakRules: [words[21].id], refresh: words.slice(300, 302),
    });
    expect(tasks.every((t) => t.reason === "due")).toBe(true);
    expect(covered(tasks, rustIds(14))).toHaveLength(14);
    // rustiest first
    expect(tasks[0].targets).toContain(words[13].id);
  });

  it("caps a shift at MAX_DUE_PER_SHIFT rusting machines", () => {
    const cards: Record<string, ReturnType<typeof newCard>> = {};
    words.slice(0, MAX_DUE_PER_SHIFT + 5).forEach((it, i) => (cards[it.id] = rusty(it.id, i + 1)));
    const tasks = buildShift({ cards, catalog, now: T0, size: 10, weakRules: [], maintenance: true });
    expect(covered(tasks, Object.keys(cards))).toHaveLength(MAX_DUE_PER_SHIFT);
  });
});

describe("rust in Schnellkarten", () => {
  it("brings every rusting word, marked whether a right card still holds the rust off", () => {
    const s = newGame(T0);
    const ids = words.slice(0, CARDS_PER_ROUND + 5).map((w) => w.id);
    ids.forEach((id, i) => (s.cards[id] = rusty(id, i + 1)));
    let used = s.cards[ids[0]];
    for (let k = 0; k < MAX_HOLDS; k++) used = { ...holdOff(used, T0), due: T0 - DAY };
    s.cards[ids[0]] = used;
    const round = trainingCards(s, catalog, T0);
    expect(round.map((e) => e.key).sort()).toEqual([...ids].sort());
    expect(round.find((e) => e.key === ids[0])!.hold).toBe("used");
    expect(round.find((e) => e.key === ids[1])!.hold).toBe("hold");
  });
});
