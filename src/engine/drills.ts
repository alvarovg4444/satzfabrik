import type { Gender, Item, NounItem, VerbItem } from "../content/types";
import { hash, norm, pick, rng, shuffle } from "./text";

/**
 * "Akkord" speed drills: form practice that needs no AI. Quick taps and short
 * typed answers train the forms until they come out without thinking.
 */
export type DrillKind =
  | "gender"
  | "plural"
  | "praesens"
  | "perfekt"
  | "praeteritum"
  | "prep_case"
  | "wechsel"
  | "pronoun"
  | "possessive"
  | "adj_ending";

export interface DrillQ {
  id: string;
  kind: DrillKind;
  /** Prompt with "___" for the gap. */
  prompt: string;
  hint?: string;
  /** Tap answers; when absent the learner types. */
  options?: string[];
  answer: string;
  /** Other accepted answers (normalised compare). */
  accept?: string[];
  explain: string;
  itemId?: string;
  /** For case questions: why this case, why not the other, and all forms with the right one marked. */
  caseHelp?: CaseHelp;
}

export interface CaseHelp {
  c: Case;
  /** Why this case here. */
  why: string;
  /** When it would be the other case, with an example where there is one. */
  whyNot: string;
  table: CaseTable;
}

/** A small table: head row, then rows; the cell at [row, col] is the answer. */
export interface CaseTable {
  title: string;
  head: string[];
  rows: { label: string; cells: string[] }[];
  hl: [number, number];
}

/** The four questions that pick the case, in order (shown with every case mistake and on the start screen). */
export const CASE_CHECK: { q: string; a: string }[] = [
  {
    q: "1. Steht eine Präposition davor?",
    a: "Dann entscheidet sie. Immer Dativ: aus, bei, mit, nach, seit, von, zu. Immer Akkusativ: durch, für, gegen, ohne, um. Wechselpräpositionen (an, auf, hinter, in, neben, über, unter, vor, zwischen): Wo? → Dativ, Wohin? → Akkusativ.",
  },
  { q: "2. Wer oder was tut etwas?", a: "Das Subjekt steht im Nominativ. Auch nach sein, werden, bleiben: Das ist mein Bruder." },
  { q: "3. Wen oder was?", a: "Das direkte Objekt steht im Akkusativ. Die meisten Verben: sehen, brauchen, besuchen, anrufen, fragen …" },
  {
    q: "4. Wem?",
    a: "Die Person, die etwas bekommt (geben, schicken, zeigen, schenken: jemandem etwas), und alle Dativ-Verben: helfen, danken, gefallen, gehören, passen, schmecken, gratulieren, antworten, zuhören.",
  },
];

/** The article table in one line each, to say out loud until it sits. */
export const CASE_CHANT = [
  "Nominativ: der · die · das · die",
  "Akkusativ: den · die · das · die (nur der → den ändert sich)",
  "Dativ: dem · der · dem · den (+ n am Plural: den Kindern)",
];

const CASES: Case[] = ["nom", "akk", "dat"];
const SLOTS: Slot[] = ["m", "f", "n", "pl"];
const SLOT_HEAD = ["m", "f", "n", "Pl."];
const CASE_ROW = (c: Case) => CASES.indexOf(c);

function articleTable(c: Case, slot: Slot, title = "Bestimmter Artikel"): CaseTable {
  return {
    title,
    head: ["", ...SLOT_HEAD],
    rows: CASES.map((k) => ({ label: CASE_DE[k], cells: SLOTS.map((g) => DEF[k][g]) })),
    hl: [CASE_ROW(c), SLOTS.indexOf(slot)],
  };
}

const DAT_PREPS = "aus, bei, mit, nach, seit, von, zu";
const AKK_PREPS = "durch, für, gegen, ohne, um"; 

export const DRILL_LABELS: Record<DrillKind, string> = {
  gender: "der, die oder das?",
  plural: "Plural",
  praesens: "Präsens",
  perfekt: "Perfekt",
  praeteritum: "Präteritum",
  prep_case: "Präposition + Kasus",
  wechsel: "Wo? oder Wohin?",
  pronoun: "Pronomen",
  possessive: "Possessivartikel",
  adj_ending: "Adjektivendungen",
};

export type Case = "nom" | "akk" | "dat";
type Slot = Gender | "pl";

export const CASE_DE: Record<Case, string> = { nom: "Nominativ", akk: "Akkusativ", dat: "Dativ" };

const DEF: Record<Case, Record<Slot, string>> = {
  nom: { m: "der", f: "die", n: "das", pl: "die" },
  akk: { m: "den", f: "die", n: "das", pl: "die" },
  dat: { m: "dem", f: "der", n: "dem", pl: "den" },
};

const ARTICLE_OF: Record<Gender, string> = { m: "der", f: "die", n: "das" };

// Prepositions that combine sensibly with almost any noun.
const PREP_DAT = ["mit", "bei", "von", "zu", "seit"];
const PREP_AKK = ["für", "ohne", "gegen"];

// Contractions that are the normal form in everyday German.
const CONTRACT: Record<string, string> = {
  "zu dem": "zum",
  "zu der": "zur",
  "bei dem": "beim",
  "von dem": "vom",
  "in dem": "im",
  "in das": "ins",
  "an dem": "am",
  "an das": "ans",
};

const PRONOUNS = [
  { nom: "ich", akk: "mich", dat: "mir" },
  { nom: "du", akk: "dich", dat: "dir" },
  { nom: "er", akk: "ihn", dat: "ihm" },
  { nom: "sie (Sg.)", akk: "sie", dat: "ihr" },
  { nom: "wir", akk: "uns", dat: "uns" },
  { nom: "ihr", akk: "euch", dat: "euch" },
  { nom: "sie (Pl.)", akk: "sie", dat: "ihnen" },
  { nom: "Sie", akk: "Sie", dat: "Ihnen" },
] as const;

const NOT_WITH_DU = ["du", "ihr", "Sie"];
const NOT_WITH_ICH = ["ich", "wir"];
const NOT_WITH_WIR = ["ich", "wir"];

/** why: the short rule; long: the question that finds the case. */
const PRONOUN_FRAMES: { de: string; c: "akk" | "dat"; why: string; long: string; exclude: string[] }[] = [
  { de: "Kannst du ___ morgen anrufen?", c: "akk", why: "anrufen + Akkusativ", long: "anrufen hat ein direktes Objekt: Wen rufst du an?", exclude: NOT_WITH_DU },
  { de: "Ich helfe ___ gern beim Umzug.", c: "dat", why: "helfen + Dativ", long: "helfen ist ein Dativ-Verb: Wem helfe ich? (nicht „wen“)", exclude: NOT_WITH_ICH },
  { de: "Wir laden ___ zum Essen ein.", c: "akk", why: "einladen + Akkusativ", long: "einladen hat ein direktes Objekt: Wen laden wir ein?", exclude: NOT_WITH_WIR },
  { de: "Die Wohnung gefällt ___ sehr.", c: "dat", why: "gefallen + Dativ", long: "Bei gefallen ist die Wohnung das Subjekt. Die Person, der sie gefällt, steht im Dativ: Wem gefällt die Wohnung?", exclude: [] },
  { de: "Ich habe ___ gestern im Supermarkt gesehen.", c: "akk", why: "sehen + Akkusativ", long: "sehen hat ein direktes Objekt: Wen habe ich gesehen?", exclude: NOT_WITH_ICH },
  { de: "Ich schicke ___ die Unterlagen per E-Mail.", c: "dat", why: "jemandem etwas schicken: Person im Dativ", long: "schicken hat zwei Objekte: was (die Unterlagen, Akkusativ) und wem (die Person, die sie bekommt, Dativ).", exclude: NOT_WITH_ICH },
  { de: "Der Arzt hat ___ sofort untersucht.", c: "akk", why: "untersuchen + Akkusativ", long: "untersuchen hat ein direktes Objekt: Wen hat der Arzt untersucht?", exclude: [] },
  { de: "Die Jacke passt ___ leider nicht.", c: "dat", why: "passen + Dativ", long: "Bei passen ist die Jacke das Subjekt. Die Person steht im Dativ: Wem passt die Jacke?", exclude: [] },
  { de: "Ich vermisse ___ sehr.", c: "akk", why: "vermissen + Akkusativ", long: "vermissen hat ein direktes Objekt: Wen vermisse ich?", exclude: NOT_WITH_ICH },
  { de: "Kannst du ___ bitte kurz zuhören?", c: "dat", why: "zuhören + Dativ", long: "zuhören ist ein Dativ-Verb: Wem hörst du zu?", exclude: NOT_WITH_DU },
  { de: "Ich frage ___ morgen nach dem Termin.", c: "akk", why: "fragen + Akkusativ", long: "fragen hat ein direktes Objekt: Wen frage ich? (Auch wenn es sich nach „wem“ anfühlt: fragen ist Akkusativ.)", exclude: NOT_WITH_ICH },
  { de: "Ich gratuliere ___ zum Geburtstag!", c: "dat", why: "gratulieren + Dativ", long: "gratulieren ist ein Dativ-Verb: Wem gratuliere ich?", exclude: NOT_WITH_ICH },
];

const POSS = [
  { owner: "ich", stem: "mein" },
  { owner: "du", stem: "dein" },
  { owner: "er", stem: "sein" },
  { owner: "sie (Sg.)", stem: "ihr" },
  { owner: "wir", stem: "unser" },
  { owner: "ihr", stem: "euer" },
  { owner: "Sie", stem: "Ihr" },
] as const;

const POSS_END: Record<Case, Record<Slot, string>> = {
  nom: { m: "", f: "e", n: "", pl: "e" },
  akk: { m: "en", f: "e", n: "", pl: "e" },
  dat: { m: "em", f: "er", n: "em", pl: "en" },
};

/** People nouns that work in every possessive frame (none of them n-declension). */
const PEOPLE: { lemma: string; g: Slot; dat?: string }[] = [
  { lemma: "Bruder", g: "m" },
  { lemma: "Vater", g: "m" },
  { lemma: "Freund", g: "m" },
  { lemma: "Chef", g: "m" },
  { lemma: "Schwester", g: "f" },
  { lemma: "Mutter", g: "f" },
  { lemma: "Freundin", g: "f" },
  { lemma: "Nachbarin", g: "f" },
  { lemma: "Kind", g: "n" },
  { lemma: "Eltern", g: "pl", dat: "Eltern" },
  { lemma: "Kinder", g: "pl", dat: "Kindern" },
  { lemma: "Freunde", g: "pl", dat: "Freunden" },
];

const POSS_FRAMES: { c: Case; why: string; de: (np: string, plural: boolean) => string }[] = [
  { c: "nom", why: "Nach „sein“ (ist, sind) steht Nominativ: Es ist kein Objekt, nur „A = B“. Das ist wer?", de: (np, pl) => `Das ${pl ? "sind" : "ist"} ${np}.` },
  { c: "akk", why: "besuchen hat ein direktes Objekt: Wen besuche ich? → Akkusativ.", de: (np) => `Ich besuche ${np} am Wochenende.` },
  { c: "dat", why: `„mit“ steht immer mit Dativ (wie ${DAT_PREPS}).`, de: (np) => `Ich telefoniere oft mit ${np}.` },
];
const WHY_NOT: Record<Case, string> = {
  nom: "Akkusativ wäre es als direktes Objekt (Ich sehe meinen Bruder), Dativ nach mit, bei, von … (mit meinem Bruder).",
  akk: "Nominativ wäre es als Subjekt oder nach „sein“ (Das ist mein Bruder), Dativ nach mit, bei, von … oder bei Dativ-Verben (Ich helfe meinem Bruder).",
  dat: "Ohne Präposition und als direktes Objekt wäre es Akkusativ (Ich besuche meinen Bruder), als Subjekt Nominativ.",
};

// Adjective endings: weak after der-words, mixed after ein-words.
const ADJ_DEF: Record<Case, Record<Gender, string>> = {
  nom: { m: "e", f: "e", n: "e" },
  akk: { m: "en", f: "e", n: "e" },
  dat: { m: "en", f: "en", n: "en" },
};
const ADJ_INDEF: Record<Case, Record<Gender, string>> = {
  nom: { m: "er", f: "e", n: "es" },
  akk: { m: "en", f: "e", n: "es" },
  dat: { m: "en", f: "en", n: "en" },
};
const INDEF: Record<Case, Record<Gender, string>> = {
  nom: { m: "ein", f: "eine", n: "ein" },
  akk: { m: "einen", f: "eine", n: "ein" },
  dat: { m: "einem", f: "einer", n: "einem" },
};
const ADJECTIVES = ["neu", "alt", "groß", "klein", "gut", "wichtig"];

const ADJ_FRAMES: { c: Case; why: string; de: (np: string) => string }[] = [
  { c: "nom", why: "„Hier ist …“: Das Ding ist das Subjekt (Was ist hier?) → Nominativ.", de: (np) => `Hier ist ${np}.` },
  { c: "akk", why: "brauchen hat ein direktes Objekt: Was brauchen wir? → Akkusativ.", de: (np) => `Wir brauchen ${np}.` },
  { c: "dat", why: `„mit“ steht immer mit Dativ (wie ${DAT_PREPS}).`, de: (np) => `Das hat mit ${np} zu tun.` },
];

/** Wo? (Dativ) vs Wohin? (Akkusativ) with position verbs. Hand-made so every sentence is natural. */
const WECHSEL: { wo: string; wohin: string; prep: string; noun: string; g: Gender }[] = [
  { wo: "Die Tasche steht", wohin: "Ich stelle die Tasche", prep: "neben", noun: "Tür", g: "f" },
  { wo: "Das Handy liegt", wohin: "Ich lege das Handy", prep: "auf", noun: "Tisch", g: "m" },
  { wo: "Das Bild hängt", wohin: "Ich hänge das Bild", prep: "an", noun: "Wand", g: "f" },
  { wo: "Die Katze sitzt", wohin: "Die Katze springt", prep: "auf", noun: "Sofa", g: "n" },
  { wo: "Die Schuhe stehen", wohin: "Ich stelle die Schuhe", prep: "vor", noun: "Tür", g: "f" },
  { wo: "Der Schlüssel liegt", wohin: "Ich lege den Schlüssel", prep: "in", noun: "Schublade", g: "f" },
  { wo: "Die Kinder spielen", wohin: "Die Kinder laufen", prep: "in", noun: "Garten", g: "m" },
  { wo: "Wir sitzen", wohin: "Wir setzen uns", prep: "an", noun: "Fenster", g: "n" },
  { wo: "Die Lampe hängt", wohin: "Ich hänge die Lampe", prep: "über", noun: "Tisch", g: "m" },
  { wo: "Das Auto steht", wohin: "Ich fahre das Auto", prep: "in", noun: "Garage", g: "f" },
  { wo: "Die Flaschen stehen", wohin: "Ich stelle die Flaschen", prep: "in", noun: "Kühlschrank", g: "m" },
  { wo: "Das Taxi wartet", wohin: "Das Taxi fährt", prep: "vor", noun: "Haus", g: "n" },
];

const WEAK_NOUNS = new Set(["Herr", "Nachbar", "Mensch", "Bauer", "Held", "Prinz", "Bär", "Kunde", "Kollege", "Junge"]);

/** Masculine nouns of the n-declension change in Akk/Dat, so case drills skip them. */
function isWeakNoun(n: NounItem): boolean {
  if (n.gender !== "m") return false;
  const note = (n.note ?? "").toLowerCase();
  if (note.includes("n-dekl") || note.includes("n-decl") || note.includes("weak")) return true;
  if (WEAK_NOUNS.has(n.lemma)) return true;
  return /(e|ent|ant|ist|oge|at|graf)$/.test(n.lemma);
}

function joinPrep(prep: string, art: string): string {
  return CONTRACT[`${prep} ${art}`] ?? `${prep} ${art}`;
}

/** ("beschwert", "sich") → "beschwert sich"; ("meldest an", "dich") → "meldest dich an". */
function withPronoun(form: string, pron: string): string {
  const [head, ...rest] = form.split(" ");
  return [head, pron, ...rest].join(" ");
}

function nouns(items: Item[]): NounItem[] {
  return items.filter((i): i is NounItem => i.kind === "noun");
}

function verbs(items: Item[]): VerbItem[] {
  return items.filter((i): i is VerbItem => i.kind === "verb");
}

function infinitive(v: VerbItem): string {
  return v.refl ? `sich ${v.lemma}` : v.lemma;
}

function genderQ(n: NounItem): DrillQ {
  return {
    id: `gender:${n.id}`,
    kind: "gender",
    prompt: `___ ${n.lemma}`,
    hint: n.en,
    options: ["der", "die", "das"],
    answer: ARTICLE_OF[n.gender],
    explain: `${n.de}${n.plural ? `, die ${n.plural}` : ""}`,
    itemId: n.id,
  };
}

function pluralQ(n: NounItem): DrillQ | null {
  if (!n.plural) return null;
  return {
    id: `plural:${n.id}`,
    kind: "plural",
    prompt: `${n.de} → die ___`,
    hint: n.en,
    answer: n.plural,
    accept: [`die ${n.plural}`],
    explain: `${n.de} → die ${n.plural}`,
    itemId: n.id,
  };
}

function praesensQ(v: VerbItem, r: () => number): DrillQ {
  // Imported verbs only have a guessed du-form, so they are asked in the er-form.
  const du = !v.id.startsWith("c.") && r() < 0.5;
  const base = du ? v.pres.du : v.pres.er;
  const pron = !v.refl ? null : du ? (v.refl === "akk" ? "dich" : "dir") : "sich";
  const answer = pron ? withPronoun(base, pron) : base;
  const duForm = v.refl ? withPronoun(v.pres.du, v.refl === "akk" ? "dich" : "dir") : v.pres.du;
  const erForm = v.refl ? withPronoun(v.pres.er, "sich") : v.pres.er;
  return {
    id: `praesens:${v.id}:${du ? "du" : "er"}`,
    kind: "praesens",
    prompt: `${infinitive(v)} → ${du ? "du" : "er"} ___`,
    hint: v.en,
    answer,
    explain: `du ${duForm} · er ${erForm}`,
    itemId: v.id,
  };
}

function perfektQ(v: VerbItem): DrillQ {
  const answer = v.refl ? withPronoun(v.perf, "sich") : v.perf;
  return {
    id: `perfekt:${v.id}`,
    kind: "perfekt",
    prompt: `${infinitive(v)} → er ___`,
    hint: `${v.en} (Perfekt)`,
    answer,
    explain: `er ${answer}${v.perf.startsWith("ist") ? " (mit sein!)" : ""}`,
    itemId: v.id,
  };
}

function praeteritumQ(v: VerbItem): DrillQ {
  const answer = v.refl ? withPronoun(v.prat, "sich") : v.prat;
  return {
    id: `praeteritum:${v.id}`,
    kind: "praeteritum",
    prompt: `${infinitive(v)} → er ___`,
    hint: `${v.en} (Präteritum)`,
    answer,
    explain: `er ${answer}`,
    itemId: v.id,
  };
}

function prepQ(n: NounItem, r: () => number): DrillQ {
  const dat = r() < 0.6;
  const prep = pick(dat ? PREP_DAT : PREP_AKK, r);
  const c: Case = dat ? "dat" : "akk";
  const answer = joinPrep(prep, DEF[c][n.gender]);
  const options = new Set([answer]);
  for (const k of ["nom", "akk", "dat"] as Case[]) {
    if (k !== c) options.add(`${prep} ${DEF[k][n.gender]}`);
  }
  return {
    id: `prep:${n.id}:${prep}`,
    kind: "prep_case",
    prompt: `${prep} + ${n.de} → ___ ${n.lemma}`,
    hint: n.en,
    options: shuffle([...options], r),
    answer,
    explain: `${prep} + ${CASE_DE[c]} → ${answer} ${n.lemma}`,
    itemId: n.id,
    caseHelp: {
      c,
      why: dat
        ? `„${prep}“ steht immer mit Dativ, egal was im Satz passiert. Immer Dativ: ${DAT_PREPS}.`
        : `„${prep}“ steht immer mit Akkusativ, egal was im Satz passiert. Immer Akkusativ: ${AKK_PREPS}.`,
      whyNot: dat
        ? `Akkusativ kommt nach ${AKK_PREPS}: für ${DEF.akk[n.gender]} ${n.lemma}.`
        : `Dativ kommt nach ${DAT_PREPS}: mit ${DEF.dat[n.gender]} ${n.lemma}.`,
      table: articleTable(c, n.gender, `${n.de}: alle Fälle`),
    },
  };
}

function wechselQ(r: () => number): DrillQ {
  const w = pick(WECHSEL, r);
  const wo = r() < 0.5;
  const right = joinPrep(w.prep, DEF[wo ? "dat" : "akk"][w.g]);
  const wrong = joinPrep(w.prep, DEF[wo ? "akk" : "dat"][w.g]);
  return {
    id: `wechsel:${w.noun}:${w.prep}:${wo ? "wo" : "wohin"}`,
    kind: "wechsel",
    prompt: `${wo ? w.wo : w.wohin} ___ ${w.noun}.`,
    hint: wo ? "Wo?" : "Wohin?",
    options: shuffle([right, wrong], r),
    answer: right,
    explain: `${wo ? "Wo? → Dativ" : "Wohin? → Akkusativ"}: ${right} ${w.noun}`,
    caseHelp: {
      c: wo ? "dat" : "akk",
      why: wo
        ? `„${w.prep}“ ist eine Wechselpräposition. „${w.wo}“ sagt, wo etwas ist (Ort, keine Bewegung zu einem Ziel): Wo? → Dativ.`
        : `„${w.prep}“ ist eine Wechselpräposition. „${w.wohin}“ ist eine Bewegung zu einem Ziel: Wohin? → Akkusativ.`,
      whyNot: wo
        ? `Mit Bewegung zum Ziel wäre es Akkusativ: ${w.wohin} ${wrong} ${w.noun}. (Wohin?)`
        : `Ohne Bewegung, nur der Ort, wäre es Dativ: ${w.wo} ${wrong} ${w.noun}. (Wo?)`,
      table: articleTable(wo ? "dat" : "akk", w.g, `${ARTICLE_OF[w.g]} ${w.noun}: alle Fälle`),
    },
  };
}

function pronounQ(r: () => number): DrillQ {
  const f = pick(PRONOUN_FRAMES, r);
  const allowed = PRONOUNS.filter((p) => !f.exclude.includes(p.nom));
  const p = pick(allowed, r);
  const answer = p[f.c];
  return {
    id: `pronoun:${f.de}:${p.nom}`,
    kind: "pronoun",
    prompt: f.de,
    hint: `(${p.nom})`,
    answer,
    explain: `${f.why}: ${p.nom} → ${answer}`,
    caseHelp: {
      c: f.c,
      why: `${f.long} → ${CASE_DE[f.c]}.`,
      whyNot:
        f.c === "akk"
          ? "Dativ wäre es bei Dativ-Verben (helfen, danken, gefallen, gehören, passen, gratulieren) oder für die Person, die etwas bekommt: Ich gebe dir das Buch."
          : "Akkusativ wäre es bei einem direkten Objekt (Wen? Was?): Ich sehe dich. Ich rufe dich an.",
      table: {
        title: "Personalpronomen",
        head: ["Nom.", "Akk.", "Dat."],
        rows: PRONOUNS.map((x) => ({ label: x.nom, cells: [x.akk, x.dat] })),
        hl: [PRONOUNS.indexOf(p), f.c === "akk" ? 0 : 1],
      },
    },
  };
}

function possessiveQ(r: () => number): DrillQ {
  const owner = pick(POSS, r);
  const person = pick(PEOPLE, r);
  const frame = pick(POSS_FRAMES, r);
  const end = POSS_END[frame.c][person.g];
  // euer drops its second e before an ending: eure, euren, eurem, eurer
  const stem = owner.stem === "euer" && end ? "eur" : owner.stem;
  const det = stem + end;
  const plural = person.g === "pl";
  const noun = frame.c === "dat" && plural ? (person.dat ?? person.lemma) : person.lemma;
  return {
    id: `poss:${owner.stem}:${person.lemma}:${frame.c}`,
    kind: "possessive",
    prompt: frame.de(`___ ${noun}`, plural),
    hint: `(${owner.owner})`,
    answer: det,
    explain: `${owner.owner} → ${owner.stem}, ${CASE_DE[frame.c]}: ${det} ${noun}`,
    caseHelp: {
      c: frame.c,
      why: frame.why,
      whyNot: WHY_NOT[frame.c],
      table: {
        title: `${owner.stem}: alle Fälle (Endung wie ein/eine)`,
        head: ["", ...SLOT_HEAD],
        rows: CASES.map((k) => ({
          label: CASE_DE[k],
          cells: SLOTS.map((g) => (owner.stem === "euer" && POSS_END[k][g] ? "eur" : owner.stem) + POSS_END[k][g]),
        })),
        hl: [CASE_ROW(frame.c), SLOTS.indexOf(person.g)],
      },
    },
  };
}

function adjQ(n: NounItem, r: () => number): DrillQ {
  const adj = pick(ADJECTIVES, r);
  const frame = pick(ADJ_FRAMES, r);
  const indef = r() < 0.5;
  const art = indef ? INDEF[frame.c][n.gender] : DEF[frame.c][n.gender];
  const answer = adj + (indef ? ADJ_INDEF[frame.c][n.gender] : ADJ_DEF[frame.c][n.gender]);
  return {
    id: `adj:${n.id}:${adj}:${frame.c}:${indef ? "i" : "d"}`,
    kind: "adj_ending",
    prompt: frame.de(`${art} ___ ${n.lemma}`),
    hint: `(${adj})`,
    answer,
    explain: `${CASE_DE[frame.c]}, ${n.de}: ${art} ${answer} ${n.lemma}`,
    itemId: n.id,
    caseHelp: {
      c: frame.c,
      why: frame.why,
      whyNot: WHY_NOT[frame.c],
      table: {
        title: `${indef ? "ein" : "der"} + ${adj}: alle Fälle`,
        head: ["", "m", "f", "n"],
        rows: CASES.map((k) => ({
          label: CASE_DE[k],
          cells: (["m", "f", "n"] as Gender[]).map((g) => `${indef ? INDEF[k][g] : DEF[k][g]} ${adj}${indef ? ADJ_INDEF[k][g] : ADJ_DEF[k][g]}`),
        })),
        hl: [CASE_ROW(frame.c), (["m", "f", "n"] as Gender[]).indexOf(n.gender)],
      },
    },
  };
}

/** The drills that are about Nominativ, Akkusativ and Dativ. */
export const CASE_KINDS: DrillKind[] = ["prep_case", "prep_case", "wechsel", "wechsel", "pronoun", "pronoun", "possessive", "adj_ending"];

const DEFAULT_MIX: DrillKind[] = [
  "gender",
  "gender",
  "plural",
  "praesens",
  "perfekt",
  "perfekt",
  "praeteritum",
  "prep_case",
  "wechsel",
  "pronoun",
  "possessive",
  "adj_ending",
];

/**
 * Build a drill round. Words come from the learner's own machines when there
 * are enough of them, so the drills reinforce what they are building.
 */
export function buildDrillRound(
  pool: Item[],
  fallback: Item[],
  seed: number,
  count = 12,
  kinds: DrillKind[] = DEFAULT_MIX,
  /** Words to ask about more often (half the time, when there are some). */
  prefer: Set<string> = new Set(),
): DrillQ[] {
  const r = rng(seed);
  const allNouns = nouns(pool).length >= 6 ? nouns(pool) : nouns(fallback);
  const allVerbs = verbs(pool).length >= 6 ? verbs(pool) : verbs(fallback);
  const favour = <T extends Item>(list: T[]): T[] => {
    const hot = list.filter((x) => prefer.has(x.id));
    // listing the hot words again as often as the rest gives them about half the picks
    return hot.length ? [...list, ...Array.from({ length: Math.ceil(list.length / hot.length) }, () => hot).flat()] : list;
  };
  const ns = favour(allNouns);
  const vs = favour(allVerbs);
  const safeNouns = ns.filter((n) => !isWeakNoun(n));
  const strong = vs.filter((v) => !/te( |$)/.test(v.prat));
  const out: DrillQ[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < count && guard++ < count * 25) {
    const kind = pick(kinds, r);
    let q: DrillQ | null = null;
    if (kind === "gender" && ns.length) q = genderQ(pick(ns, r));
    else if (kind === "plural" && ns.length) q = pluralQ(pick(ns, r));
    else if (kind === "praesens" && vs.length) q = praesensQ(pick(vs, r), r);
    else if (kind === "perfekt" && vs.length) q = perfektQ(pick(vs, r));
    else if (kind === "praeteritum" && vs.length) q = praeteritumQ(pick(strong.length ? strong : vs, r));
    else if (kind === "prep_case" && safeNouns.length) q = prepQ(pick(safeNouns, r), r);
    else if (kind === "wechsel") q = wechselQ(r);
    else if (kind === "pronoun") q = pronounQ(r);
    else if (kind === "possessive") q = possessiveQ(r);
    else if (kind === "adj_ending" && safeNouns.length) q = adjQ(pick(safeNouns, r), r);
    if (q && !seen.has(q.id)) {
      seen.add(q.id);
      out.push(q);
    }
  }
  return out;
}

/** The same question without answer buttons: the calm round asks for the answer typed. */
export function typed(q: DrillQ): DrillQ {
  return { ...q, options: undefined };
}

export function checkDrill(q: DrillQ, given: string): boolean {
  const g = norm(given);
  if (g === norm(q.answer)) return true;
  return (q.accept ?? []).some((a) => norm(a) === g);
}

export function drillSeed(now: number, n: number): number {
  return hash(`${Math.floor(now / 60_000)}:${n}`);
}
