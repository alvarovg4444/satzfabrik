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
