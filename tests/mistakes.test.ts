import { describe, expect, it } from "vitest";
import { makeCatalog } from "../src/content/catalog";
import type { ErrorType } from "../src/content/types";
import { applyMistakeCard, rollover } from "../src/game/actions";
import { dueMistakes, MISTAKE_DAYS, mistakeItem, noteMistakes } from "../src/game/mistakes";
import { newGame } from "../src/game/state";
import { trainingCards } from "../src/game/training";

const T0 = new Date("2026-10-26T09:00:00").getTime();
const DAY = 86_400_000;
const catalog = makeCatalog([]);
const err = (type: ErrorType, wrong: string, right: string, word = "", en = "") => ({ type, wrong, right, rule: "", explain: "", word, en });

describe("Fehlerwörter", () => {
  it("keeps word mistakes (article, plural, spelling) and leaves grammar to Akkord", () => {
    const s = newGame(T0);
    const n = noteMistakes(
      s,
      catalog,
      {
        corrected: "Ich brauche einen Termin.",
        errors: [
          err("gender", "eine Termin", "einen Termin", "der Termin", "appointment"),
          err("case", "mit den Termin", "mit dem Termin"),
          err("word_order", "ich morgen gehe", "ich gehe morgen"),
        ],
      },
      T0,
    );
    expect(n).toBe(1);
    const m = s.mistakes!["der termin"];
    expect(m.itemId).toBe("n.termin");
    expect(m.wrong).toBe("eine Termin");
    expect(m.due).toBe(T0 + DAY);
  });

  it("treats an article that fits the gender in another case as a case mistake", () => {
    const s = newGame(T0);
    // den Termin is masculine too (accusative): the gender was right
    noteMistakes(s, catalog, { corrected: "x", errors: [err("gender", "den Termin", "dem Termin", "der Termin", "appointment")] }, T0);
    expect(Object.keys(s.mistakes ?? {})).toHaveLength(0);
  });

  it("finds the word without the AI's help, and keeps unknown words with their meaning", () => {
    const s = newGame(T0);
    noteMistakes(s, catalog, { corrected: "x", errors: [err("plural", "die Termins", "die Termine")] }, T0);
    expect(s.mistakes!["der termin"]?.itemId).toBe("n.termin");
    noteMistakes(s, catalog, { corrected: "Das ist ein Flohmarktstand.", errors: [err("gender", "eine Flohmarktstand", "ein Flohmarktstand", "der Flohmarktstand", "flea market stall")] }, T0);
    const own = s.mistakes!["der flohmarktstand"];
    expect(own.itemId).toBeUndefined();
    const card = mistakeItem(catalog, own);
    expect(card.kind).toBe("noun");
    expect(card.de).toBe("der Flohmarktstand");
    // without a meaning there is no card to make
    noteMistakes(s, catalog, { corrected: "x", errors: [err("spelling", "Quatschwort", "Quatschwörter", "", "")] }, T0);
    expect(Object.keys(s.mistakes!)).toHaveLength(2);
  });

  it("come back after 1, 3, 7, 14 and 30 days, start over when missed, and leave the pile after that", () => {
    expect(MISTAKE_DAYS).toEqual([1, 3, 7, 14, 30]);
    const s = newGame(T0);
    noteMistakes(s, catalog, { corrected: "x", errors: [err("gender", "die Termin", "der Termin", "der Termin", "appointment")] }, T0);
    let now = T0 + DAY;
    expect(dueMistakes(s, now)).toHaveLength(1);
    applyMistakeCard(s, catalog, now, "der termin", false);
    expect(s.mistakes!["der termin"].step).toBe(0);
    expect(s.mistakes!["der termin"].due).toBe(now + DAY);
    now += DAY;
    for (const days of [3, 7, 14, 30]) {
      expect(applyMistakeCard(s, catalog, now, "der termin", true).result).toBe("next");
      expect(s.mistakes!["der termin"].due).toBe(now + days * DAY);
      now += days * DAY;
    }
    expect(applyMistakeCard(s, catalog, now, "der termin", true).result).toBe("done");
    expect(s.mistakes!["der termin"]).toBeUndefined();
  });

  it("are mixed into a round of Schnellkarten when due", () => {
    const s = newGame(T0);
    noteMistakes(s, catalog, { corrected: "x", errors: [err("gender", "das Miete", "die Miete", "die Miete", "rent")] }, T0);
    expect(trainingCards(s, catalog, T0).some((e) => e.mistake)).toBe(false);
    const round = trainingCards(s, catalog, T0 + DAY);
    expect(round.filter((e) => e.mistake).map((e) => e.item.de)).toEqual(["die Miete"]);
  });

  it("are collected once from the sentence archive", () => {
    const s = newGame(T0);
    s.journal.unshift({ t: T0, type: "produce", targets: [], prompt: "", answer: "eine Termin", corrected: "ein Termin", quality: "minor", errors: [{ type: "gender", wrong: "eine Termin", right: "ein Termin", explain: "" }] });
    rollover(s, catalog, T0);
    expect(s.mistakes!["der termin"]).toBeDefined();
    expect(s.mistakesSeeded).toBe(true);
  });
});

describe("words in [brackets]", () => {
  it("come from the corrector as lookups and become Schnellkarten due today", async () => {
    const { coerceGrade } = await import("../src/ai/schema");
    const { noteLookups } = await import("../src/game/mistakes");
    const g = coerceGrade(
      {
        targets: [],
        quality: "perfect",
        corrected: "Ich wohne in einem Haus mit einer Waschmaschine.",
        errors: [],
        lookups: [
          { en: "[house]", word: "das Haus", used: "Haus" },
          { en: "washing machine", word: "die Waschmaschine", used: "Waschmaschine" },
          { en: "", word: "x", used: "" },
        ],
      },
      [],
    );
    expect(g.lookups).toEqual([
      { en: "house", word: "das Haus", used: "Haus" },
      { en: "washing machine", word: "die Waschmaschine", used: "Waschmaschine" },
    ]);
    const s = newGame(T0);
    expect(noteLookups(s, catalog, g, T0)).toBe(2);
    const round = trainingCards(s, catalog, T0);
    const looked = round.filter((e) => e.mistake?.lookup);
    expect(looked.map((e) => e.item.de).sort()).toEqual(["das Haus", "die Waschmaschine"]);
    expect(looked.find((e) => e.item.de === "das Haus")!.item.en).toBeTruthy();
  });

  it("no brackets, no lookups", async () => {
    const { coerceGrade } = await import("../src/ai/schema");
    expect(coerceGrade({ corrected: "Hallo." }, []).lookups).toBeUndefined();
  });
});

describe("Fehlerwörter as gap sentences", () => {
  it("ask for the exact form in the learner's corrected sentence", async () => {
    const { clozeFor } = await import("../src/game/mistakes");
    const s = newGame(T0);
    noteMistakes(
      s,
      catalog,
      { corrected: "Hallo, wir müssen eine Feier organisieren.", errors: [{ ...err("word_choice", "brauchen", "müssen", "müssen", "must"), word: "müssen" }] },
      T0,
    );
    const round = trainingCards(s, catalog, T0 + DAY);
    const card = round.find((e) => e.mistake)!;
    expect(card.cloze).toEqual({ before: "Hallo, wir ", after: " eine Feier organisieren.", answer: "müssen", hint: "Du hattest: brauchen" });
    // older cards without the corrected words find them in the sentence archive
    const old = { ...card.mistake!, right: undefined };
    expect(clozeFor(s, old)).toBeNull();
    s.journal.unshift({ t: T0, type: "produce", targets: [], prompt: "", answer: "", corrected: old.sentence, quality: "minor", errors: [{ type: "word_choice", wrong: "brauchen", right: "müssen", explain: "" }] });
    expect(clozeFor(s, old)?.answer).toBe("müssen");
  });

  it("match whole words only, and fall back when the form is not in the sentence", async () => {
    const { clozeFor } = await import("../src/game/mistakes");
    const s = newGame(T0);
    const base = { word: "der Tisch", en: "table", type: "gender" as const, wrong: "die Tisch", step: 0, due: T0, added: T0 };
    expect(clozeFor(s, { ...base, right: "den Tisch", sentence: "Ich kaufe den Tischler und den Tisch." })?.before).toBe("Ich kaufe den Tischler und ");
    expect(clozeFor(s, { ...base, right: "dem Tisch", sentence: "Das Buch liegt auf dem Stuhl." })).toBeNull();
  });
});

describe("Schnellkarten in batches", () => {
  it("a round has at most CARDS_PER_ROUND cards, Fehlerwörter taking turns with words", async () => {
    const { CARDS_PER_ROUND, cardsWaiting } = await import("../src/game/training");
    const s = newGame(T0);
    for (let i = 0; i < 20; i++) {
      noteMistakes(s, catalog, { corrected: `Satz ${i} mit Wort${i}.`, errors: [err("spelling", `Wrot${i}`, `Wort${i}`, `Wort${i}`, `word ${i}`)] }, T0 + i);
    }
    const round = trainingCards(s, catalog, T0 + 2 * DAY);
    expect(round).toHaveLength(CARDS_PER_ROUND);
    expect(cardsWaiting(s, catalog, T0 + 2 * DAY).total).toBe(20);
  });
});
