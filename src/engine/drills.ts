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
}

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

type Case = "nom" | "akk" | "dat";
type Slot = Gender | "pl";

const CASE_DE: Record<Case, string> = { nom: "Nominativ", akk: "Akkusativ", dat: "Dativ" };

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

const PRONOUN_FRAMES: { de: string; c: "akk" | "dat"; why: string; exclude: string[] }[] = [
  { de: "Kannst du ___ morgen anrufen?", c: "akk", why: "anrufen + Akkusativ", exclude: NOT_WITH_DU },
  { de: "Ich helfe ___ gern beim Umzug.", c: "dat", why: "helfen + Dativ", exclude: NOT_WITH_ICH },
  { de: "Wir laden ___ zum Essen ein.", c: "akk", why: "einladen + Akkusativ", exclude: NOT_WITH_WIR },
  { de: "Die Wohnung gefällt ___ sehr.", c: "dat", why: "gefallen + Dativ", exclude: [] },
  { de: "Ich habe ___ gestern im Supermarkt gesehen.", c: "akk", why: "sehen + Akkusativ", exclude: NOT_WITH_ICH },
  { de: "Ich schicke ___ die Unterlagen per E-Mail.", c: "dat", why: "jemandem etwas schicken: Person im Dativ", exclude: NOT_WITH_ICH },
  { de: "Der Arzt hat ___ sofort untersucht.", c: "akk", why: "untersuchen + Akkusativ", exclude: [] },
  { de: "Die Jacke passt ___ leider nicht.", c: "dat", why: "passen + Dativ", exclude: [] },
  { de: "Ich vermisse ___ sehr.", c: "akk", why: "vermissen + Akkusativ", exclude: NOT_WITH_ICH },
  { de: "Kannst du ___ bitte kurz zuhören?", c: "dat", why: "zuhören + Dativ", exclude: NOT_WITH_DU },
  { de: "Ich frage ___ morgen nach dem Termin.", c: "akk", why: "fragen + Akkusativ", exclude: NOT_WITH_ICH },
  { de: "Ich gratuliere ___ zum Geburtstag!", c: "dat", why: "gratulieren + Dativ", exclude: NOT_WITH_ICH },
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

const POSS_FRAMES: { c: Case; de: (np: string, plural: boolean) => string }[] = [
  { c: "nom", de: (np, pl) => `Das ${pl ? "sind" : "ist"} ${np}.` },
  { c: "akk", de: (np) => `Ich besuche ${np} am Wochenende.` },
  { c: "dat", de: (np) => `Ich telefoniere oft mit ${np}.` },
];

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

const ADJ_FRAMES: { c: Case; de: (np: string) => string }[] = [
  { c: "nom", de: (np) => `Hier ist ${np}.` },
  { c: "akk", de: (np) => `Wir brauchen ${np}.` },
  { c: "dat", de: (np) => `Das hat mit ${np} zu tun.` },
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
  };
}

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
): DrillQ[] {
  const r = rng(seed);
  const ns = nouns(pool).length >= 6 ? nouns(pool) : nouns(fallback);
  const vs = verbs(pool).length >= 6 ? verbs(pool) : verbs(fallback);
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

export function checkDrill(q: DrillQ, given: string): boolean {
  const g = norm(given);
  if (g === norm(q.answer)) return true;
  return (q.accept ?? []).some((a) => norm(a) === g);
}

export function drillSeed(now: number, n: number): number {
  return hash(`${Math.floor(now / 60_000)}:${n}`);
}
