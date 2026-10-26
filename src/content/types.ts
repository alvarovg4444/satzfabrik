// Content schema for Satzfabrik. Every learnable thing is an Item.
// Items are static curriculum (this folder) or imported by the learner (Anki CSV).

export type Level = "A1" | "A2" | "B1" | "B2";
export type Gender = "m" | "f" | "n";

/** The five factory halls. Each item lives in exactly one hall. */
export type HallId =
  | "woerter" // Wortlager: nouns, adjectives, adverbs, small words
  | "verben" // Verbschmiede: verbs and verb grammar (tenses, modal, separable, reflexive)
  | "faelle" // Kasuswerk: cases, articles, pronouns, possessives, prepositions, adjective endings
  | "satzbau" // Satzbau-Halle: connectors, word order, clauses, Konjunktiv, passive
  | "redemittel"; // Redemittel-Manufaktur: fixed expressions and chunks

export type ItemKind = "noun" | "verb" | "adj" | "adv" | "word" | "expr" | "gram";

export type TopicId =
  | "alltag" // daily routine, household
  | "wohnen" // flat, landlord, moving, neighbours
  | "arbeit" // job, office, colleagues, applications
  | "einkaufen" // shops, clothes, prices, returns
  | "essen" // food, cooking, restaurant
  | "gesundheit" // doctor, pharmacy, body, illness
  | "reisen" // travel, transport, hotel, holidays
  | "freizeit" // hobbies, sport, culture, going out
  | "familie" // family, friends, relationships, celebrations
  | "behoerden" // authorities, forms, bank, insurance, post
  | "bildung" // school, courses, learning, university
  | "kommunikation" // phone, email, internet, media
  | "natur" // weather, environment, seasons
  | "gefuehle" // feelings, opinions, character
  | "stadt"; // city, directions, places

export const TOPICS: Record<TopicId, { de: string; en: string }> = {
  alltag: { de: "Alltag", en: "Daily life" },
  wohnen: { de: "Wohnen", en: "Housing" },
  arbeit: { de: "Arbeit", en: "Work" },
  einkaufen: { de: "Einkaufen", en: "Shopping" },
  essen: { de: "Essen & Trinken", en: "Food & drink" },
  gesundheit: { de: "Gesundheit", en: "Health" },
  reisen: { de: "Reisen & Verkehr", en: "Travel & transport" },
  freizeit: { de: "Freizeit", en: "Free time" },
  familie: { de: "Familie & Freunde", en: "Family & friends" },
  behoerden: { de: "Ämter & Bank", en: "Offices & bank" },
  bildung: { de: "Lernen & Kurse", en: "Learning" },
  kommunikation: { de: "Kommunikation", en: "Communication" },
  natur: { de: "Wetter & Natur", en: "Weather & nature" },
  gefuehle: { de: "Gefühle & Meinung", en: "Feelings & opinions" },
  stadt: { de: "Stadt & Wege", en: "City & directions" },
};

/**
 * Error categories the AI corrector assigns. They drive the "weak spots"
 * statistics and link errors to grammar machines.
 */
export type ErrorType =
  | "gender" // wrong article / gender (der/die/das)
  | "case" // wrong case (Nom/Akk/Dat/Gen)
  | "adj_ending" // wrong adjective ending
  | "verb_form" // wrong conjugation / verb form
  | "tense" // wrong tense or participle
  | "aux" // haben vs sein, werden
  | "word_order" // V2, verb-final, inversion, separable prefix position
  | "preposition" // wrong preposition chosen
  | "pronoun" // wrong pronoun / possessive form
  | "plural" // wrong plural form
  | "spelling" // spelling, umlauts, ß
  | "capitalization" // nouns capitalised, Sie
  | "word_choice" // wrong word, collocation, false friend
  | "missing_word" // something missing (article, subject, verb, zu)
  | "extra_word" // something superfluous
  | "negation" // nicht vs kein, position of nicht
  | "connector" // wrong connector for the meaning
  | "punctuation" // missing comma before subordinate clause etc.
  | "other";

export const ERROR_TYPES: Record<ErrorType, { de: string; en: string }> = {
  gender: { de: "Artikel / Genus", en: "Article / gender" },
  case: { de: "Kasus", en: "Case" },
  adj_ending: { de: "Adjektivendung", en: "Adjective ending" },
  verb_form: { de: "Verbform", en: "Verb form" },
  tense: { de: "Zeitform", en: "Tense" },
  aux: { de: "haben / sein", en: "haben / sein" },
  word_order: { de: "Wortstellung", en: "Word order" },
  preposition: { de: "Präposition", en: "Preposition" },
  pronoun: { de: "Pronomen", en: "Pronoun" },
  plural: { de: "Plural", en: "Plural" },
  spelling: { de: "Rechtschreibung", en: "Spelling" },
  capitalization: { de: "Groß/klein", en: "Capitalisation" },
  word_choice: { de: "Wortwahl", en: "Word choice" },
  missing_word: { de: "Wort fehlt", en: "Missing word" },
  extra_word: { de: "Wort zu viel", en: "Extra word" },
  negation: { de: "Verneinung", en: "Negation" },
  connector: { de: "Konnektor", en: "Connector" },
  punctuation: { de: "Komma", en: "Punctuation" },
  other: { de: "Sonstiges", en: "Other" },
};

export interface Example {
  de: string;
  en: string;
}

interface BaseItem {
  /**
   * Unique, stable id. Prefix by kind: "n." noun, "v." verb, "a." adjective,
   * "d." adverb, "w." other word, "x." expression, "g." grammar.
   * Lowercase ASCII, umlauts transliterated (ä→ae, ö→oe, ü→ue, ß→ss), words joined by "-".
   * Example: "n.termin", "v.sich-freuen-auf", "x.es-kommt-darauf-an", "g.weil".
   */
  id: string;
  kind: ItemKind;
  hall: HallId;
  level: Level;
  /** Display form in German. Nouns with article ("der Termin"), verbs as infinitive. */
  de: string;
  /** Short English meaning. */
  en: string;
  topic?: TopicId;
  /** One natural example sentence at A2/B1 level, with translation. */
  example: Example;
  /** Optional usage note or typical learner mistake, in English, max ~140 characters. */
  note?: string;
  /**
   * Optional extra lowercase surface forms used to detect that the learner used
   * the item (the engine already derives forms from lemma, plural and verb forms).
   */
  keys?: string[];
}

export interface NounItem extends BaseItem {
  kind: "noun";
  hall: "woerter";
  /** Noun without article, capitalised: "Termin". */
  lemma: string;
  gender: Gender;
  /** Full plural form without article ("Termine"), or null if (almost) only singular. */
  plural: string | null;
}

export interface VerbItem extends BaseItem {
  kind: "verb";
  hall: "verben";
  /** Infinitive without "sich": "anrufen", "freuen". */
  lemma: string;
  /** Present tense du/er forms, separable prefix split: { du: "rufst an", er: "ruft an" }. */
  pres: { du: string; er: string };
  /** Präteritum, er-form: "rief an". */
  prat: string;
  /** Perfekt, er-form with auxiliary: "hat angerufen", "ist gefahren". */
  perf: string;
  /** Separable prefix, if any: "an". */
  sep?: string;
  /** Reflexive: "akk" (sich freuen) or "dat" (sich etwas merken). */
  refl?: "akk" | "dat";
  /** Government / valency, e.g. "jdn (Akk)", "jdm (Dat)", "auf + Akk", "jdm etw (Dat + Akk)". */
  gov?: string;
}

export interface WordItem extends BaseItem {
  kind: "adj" | "adv" | "word";
  hall: "woerter";
  lemma: string;
  /** Comparative and superlative for adjectives where useful: "besser", "am besten". */
  comp?: string;
  sup?: string;
}

export interface ExprItem extends BaseItem {
  kind: "expr";
  hall: "redemittel";
  /** When and how to use it, in English, max ~120 characters. */
  use: string;
}

export interface TransformTask {
  /** Instruction in German, e.g. "Verbinde die Sätze mit „trotzdem“." */
  prompt: string;
  /** Input sentence(s) to transform. */
  input: string;
  /** One correct model answer. */
  answer: string;
}

export interface GramItem extends BaseItem {
  kind: "gram";
  hall: "verben" | "faelle" | "satzbau";
  /** Short label shown on the machine, e.g. "weil + Nebensatz". */
  name: string;
  /** What to show the learner in a production task, e.g. "weil (Verb ans Ende)". */
  cue: string;
  /** 1–3 sentences in English explaining the rule clearly. */
  rule: string;
  /** Schematic pattern, e.g. "…, weil + Subjekt + … + Verb." */
  pattern: string;
  /** Three example sentences. */
  examples: Example[];
  /** Three English sentences to translate that force the structure, with model answers. */
  translate: { en: string; de: string }[];
  /** Optional transformation tasks (1–2). */
  transform?: TransformTask[];
  /** Typical mistake + how to avoid it, in English. */
  tip: string;
  /** Error categories this rule covers; used to link corrector errors to this machine. */
  errors: ErrorType[];
}

export type Item = NounItem | VerbItem | WordItem | ExprItem | GramItem;

export interface Scenario {
  id: string;
  topic: TopicId;
  /** Situation in simple German (A2), second person, 1 sentence. */
  de: string;
  /** Same situation in English. */
  en: string;
}

export const HALLS: Record<
  HallId,
  { de: string; en: string; blurb: string; unlockLevel: number }
> = {
  woerter: {
    de: "Wortlager",
    en: "Word warehouse",
    blurb: "Nouns, adjectives and small words. Raw material for every sentence.",
    unlockLevel: 1,
  },
  satzbau: {
    de: "Satzbau-Halle",
    en: "Sentence assembly",
    blurb: "Connectors and word order: weil, trotzdem, dass, obwohl and friends.",
    unlockLevel: 1,
  },
  verben: {
    de: "Verbschmiede",
    en: "Verb forge",
    blurb: "Verbs, tenses, modal and separable verbs.",
    unlockLevel: 1,
  },
  faelle: {
    de: "Kasuswerk",
    en: "Case works",
    blurb: "Akkusativ, Dativ, pronouns, possessives, prepositions, endings.",
    unlockLevel: 2,
  },
  redemittel: {
    de: "Redemittel-Manufaktur",
    en: "Phrase workshop",
    blurb: "Ready-made chunks for real conversations.",
    unlockLevel: 3,
  },
};
