import { describe, expect, it } from "vitest";
import type { NounItem, VerbItem } from "../src/content/types";
import { buildDrillRound, checkDrill } from "../src/engine/drills";
import { pluralFrom, importText } from "../src/engine/importer";
import { isDue, newCard, review, rustOf, stageOf } from "../src/engine/srs";
import { diffWords, mentions, norm, sameSentence, surfaceKeys } from "../src/engine/text";

const DAY = 86_400_000;
const T0 = new Date("2026-10-26T09:00:00").getTime();

const termin: NounItem = {
  id: "n.termin",
  kind: "noun",
  hall: "woerter",
  level: "A2",
  de: "der Termin",
  en: "appointment",
  lemma: "Termin",
  gender: "m",
  plural: "Termine",
  example: { de: "Ich habe morgen einen Termin.", en: "I have an appointment tomorrow." },
};

const anrufen: VerbItem = {
  id: "v.anrufen",
  kind: "verb",
  hall: "verben",
  level: "A2",
  de: "anrufen",
  en: "to call",
  lemma: "anrufen",
  pres: { du: "rufst an", er: "ruft an" },
  prat: "rief an",
  perf: "hat angerufen",
  sep: "an",
  example: { de: "Ich rufe dich morgen an.", en: "I'll call you tomorrow." },
};

const beschweren: VerbItem = {
  id: "v.sich-beschweren",
  kind: "verb",
  hall: "verben",
  level: "B1",
  de: "sich beschweren (über)",
  en: "to complain",
  lemma: "beschweren",
  pres: { du: "beschwerst", er: "beschwert" },
  prat: "beschwerte",
  perf: "hat beschwert",
  refl: "akk",
  gov: "über + Akk",
  example: { de: "Ich beschwere mich über den Lärm.", en: "I complain about the noise." },
};

describe("text", () => {
  it("normalises punctuation, case and ß", () => {
    expect(norm("Straße, bitte!")).toBe("strasse bitte");
    expect(sameSentence("Ich gehe nach Hause.", "ich gehe nach hause")).toBe(true);
  });

  it("detects separable verbs in any position", () => {
    expect(mentions("Ich rufe dich morgen an.", anrufen)).toBe(true);
    expect(mentions("Er hat gestern angerufen.", anrufen)).toBe(true);
    expect(mentions("Ich schreibe dir eine E-Mail.", anrufen)).toBe(false);
  });

  it("detects nouns in plural and compounds", () => {
    expect(mentions("Ich habe zwei Termine.", termin)).toBe(true);
    expect(mentions("Mein Arzttermin ist um acht.", termin)).toBe(true);
    expect(surfaceKeys(termin)).toContain("termin");
  });

  it("diffs words and treats glued punctuation as unchanged", () => {
    const d = diffWords("Ich fahre mit der Bus", "Ich fahre mit dem Bus.");
    expect(d.filter((t) => t.op === "del").map((t) => t.t)).toEqual(["der"]);
    expect(d.filter((t) => t.op === "add").map((t) => t.t)).toEqual(["dem"]);
  });
});

describe("srs", () => {
  it("starts as a blueprint and becomes a machine after the first correct sentence", () => {
    const c = newCard("n.termin", T0);
    expect(stageOf(c)).toBe(0);
    expect(isDue(c, T0)).toBe(false);
    const r = review(c, "correct", { now: T0 });
    expect(r.scheduled).toBe(true);
    expect(stageOf(r.card)).toBe(1);
    expect(r.card.due).toBeGreaterThan(T0 + DAY / 2);
  });

  it("only the first review of a day changes the schedule", () => {
    const c = review(newCard("x", T0), "correct", { now: T0 }).card;
    const again = review(c, "wrong", { now: T0 + 60_000 });
    expect(again.scheduled).toBe(false);
    expect(again.card.due).toBe(c.due);
    expect(again.card.fail).toBe(1);
  });

  it("grows the interval with spaced successes and climbs stages", () => {
    let c = review(newCard("x", T0), "correct", { now: T0 }).card;
    let t = T0;
    for (let i = 0; i < 4; i++) {
      t = c.due + 1000;
      c = review(c, "correct", { now: t }).card;
    }
    expect(stageOf(c)).toBeGreaterThanOrEqual(3);
    expect(c.sched).toBeGreaterThan(10);
  });

  it("rusts after the due date and is fully rusty after another interval", () => {
    const c = review(newCard("x", T0), "correct", { now: T0 }).card;
    expect(rustOf(c, c.due - 1000)).toBe(0);
    expect(rustOf(c, c.due + DAY)).toBeGreaterThan(0);
    expect(rustOf(c, c.due + 60 * DAY)).toBe(1);
  });

  it("a failure shortens the interval", () => {
    let c = review(newCard("x", T0), "correct", { now: T0 }).card;
    c = review(c, "correct", { now: c.due + 1000 }).card;
    const before = c.s;
    const failed = review(c, "wrong", { now: c.due + 1000 }).card;
    expect(failed.s).toBeLessThan(before);
    expect(failed.lapses).toBe(1);
  });
});

describe("drills", () => {
  const pool = [termin, anrufen, beschweren];

  it("builds rounds with valid answers", () => {
    const round = buildDrillRound(pool, pool, 42, 30);
    expect(round.length).toBeGreaterThan(10);
    for (const q of round) {
      expect(q.answer.length).toBeGreaterThan(0);
      expect(checkDrill(q, q.answer)).toBe(true);
      if (q.options) expect(q.options).toContain(q.answer);
    }
  });

  it("puts the reflexive pronoun in the right place", () => {
    const round = buildDrillRound([beschweren], [beschweren], 7, 40, ["perfekt", "praeteritum", "praesens"]);
    const perf = round.find((q) => q.kind === "perfekt");
    expect(perf?.answer).toBe("hat sich beschwert");
    const pres = round.filter((q) => q.kind === "praesens").map((q) => q.answer);
    for (const a of pres) expect(["beschwerst dich", "beschwert sich"]).toContain(a);
  });

  it("uses contractions with zu/bei/von", () => {
    const round = buildDrillRound([termin], [termin], 3, 60, ["prep_case"]);
    for (const q of round) {
      expect(q.answer).not.toMatch(/^(zu|bei|von) dem$/);
      expect(q.answer).not.toMatch(/^zu der$/);
    }
  });

  it("checks typed answers leniently on case and punctuation only", () => {
    const q = buildDrillRound([termin], [termin], 1, 10, ["plural"])[0];
    expect(checkDrill(q, "termine")).toBe(true);
    expect(checkDrill(q, "die Termine")).toBe(true);
    expect(checkDrill(q, "Terminen")).toBe(false);
  });
});

describe("importer", () => {
  it("derives Goethe-style plurals", () => {
    expect(pluralFrom("Termin", "-e")).toBe("Termine");
    expect(pluralFrom("Stadt", "¨-e")).toBe("Städte");
    expect(pluralFrom("Apfel", "¨-")).toBe("Äpfel");
    expect(pluralFrom("Lehrer", "-")).toBe("Lehrer");
    expect(pluralFrom("Haus", "¨-er")).toBe("Häuser");
    expect(pluralFrom("Auto", "-s")).toBe("Autos");
  });

  it("imports nouns, verbs and phrases from Anki text and skips duplicates", () => {
    const text = [
      "#separator:tab",
      "der Vertrag, ¨-e\tcontract\tB1",
      "unterschreiben, unterschreibt, unterschrieb, hat unterschrieben\tto sign",
      "appointment\tder Termin, -e",
      "Das kommt darauf an.\tIt depends.",
      "pünktlich\ton time",
    ].join("\n");
    const res = importText(text, [termin]);
    expect(res.duplicates).toBe(1);
    const byKind = Object.fromEntries(res.items.map((i) => [i.kind, i]));
    expect(byKind.noun).toMatchObject({ lemma: "Vertrag", gender: "m", plural: "Verträge", level: "B1" });
    expect(byKind.verb).toMatchObject({ lemma: "unterschreiben", perf: "hat unterschrieben", prat: "unterschrieb" });
    expect(byKind.expr?.de).toBe("Das kommt darauf an.");
    expect(byKind.word?.de).toBe("pünktlich");
  });
});
