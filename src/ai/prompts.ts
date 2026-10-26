import type { Catalog } from "../content/catalog";
import { GRAMMAR } from "../content/catalog";
import { ERROR_TYPES, type ErrorType, type GramItem, type Item } from "../content/types";
import type { Task } from "../engine/tasks";
import type { TargetStatus } from "./schema";

export type ExplainLang = "en" | "es" | "pt" | "it" | "fr" | "de";

export const EXPLAIN_LANGS: Record<ExplainLang, { label: string; prompt: string }> = {
  en: { label: "English", prompt: "English" },
  es: { label: "Español", prompt: "Spanish" },
  pt: { label: "Português", prompt: "Portuguese" },
  it: { label: "Italiano", prompt: "Italian" },
  fr: { label: "Français", prompt: "French" },
  de: { label: "Deutsch (einfach)", prompt: "simple German (A2 level)" },
};

/** One line per target so the corrector knows exactly what to look for. */
export function describeTarget(it: Item): string {
  switch (it.kind) {
    case "noun":
      return `id "${it.id}": noun "${it.de}" (plural: ${it.plural ? `die ${it.plural}` : "none"}) = ${it.en}`;
    case "verb":
      return `id "${it.id}": verb "${it.de}" = ${it.en}; forms: er ${it.pres.er}, ${it.prat}, ${it.perf}${it.gov ? `; takes ${it.gov}` : ""}`;
    case "adj":
    case "adv":
    case "word":
      return `id "${it.id}": ${it.kind === "adj" ? "adjective" : it.kind === "adv" ? "adverb" : "word"} "${it.de}" = ${it.en}`;
    case "expr":
      return `id "${it.id}": expression "${it.de}" = ${it.en} (${it.use})`;
    case "gram":
      return `id "${it.id}": grammar "${it.name}": ${it.rule} Pattern: ${it.pattern}`;
  }
}

const GRAMMAR_INDEX = GRAMMAR.map((g) => `${g.id} (${g.name})`).join("; ");
const ERROR_LIST = Object.keys(ERROR_TYPES).join(", ");

function taskBlock(task: Task): string {
  const lines = [`TASK TYPE: ${task.type}`, `INSTRUCTION: ${task.instruction} (${task.instructionEn})`];
  if (task.scenario) lines.push(`SITUATION: ${task.scenario.de} (${task.scenario.en})`);
  if (task.type === "translate" && task.source) lines.push(`ENGLISH SENTENCE TO TRANSLATE: ${task.source}`);
  if (task.type === "transform" && task.source) lines.push(`SENTENCE(S) TO TRANSFORM: ${task.source}`);
  if (task.reference) lines.push(`ONE MODEL ANSWER (other correct answers are equally fine): ${task.reference}`);
  return lines.join("\n");
}

function taskRules(task: Task): string {
  switch (task.type) {
    case "translate":
      return "The answer must mean what the English sentence means. If the meaning differs, add an error of type \"word_choice\" or \"other\". Any correct, natural translation counts as correct.";
    case "transform":
      return "The answer must do what the instruction asks. If it does not, add an error of type \"other\" and give the grammar target the status \"wrong\".";
    case "combo":
      return "Every target must appear. Judge each target separately.";
    default:
      return "The answer should fit the situation, but do not mark content or creativity as errors; only language counts.";
  }
}

export function gradePrompt(task: Task, answer: string, catalog: Catalog, lang: ExplainLang, level = "A2–B1"): string {
  const L = EXPLAIN_LANGS[lang].prompt;
  const targets = task.targets
    .map((id) => catalog.get(id))
    .filter((x): x is Item => !!x)
    .map((it) => `- ${describeTarget(it)}`)
    .join("\n");
  return `You are the corrector in "Satzfabrik", a German writing trainer. The learner is an adult at about level ${level} who wants to write and speak natural everyday German. Correct like an experienced, kind teacher of German as a foreign language: precise, never pedantic, and never inventing errors.

${taskBlock(task)}

TARGETS the learner has to use:
${targets}

LEARNER'S ANSWER:
"""
${answer.trim()}
"""

How to judge:
1. Errors are only real mistakes in standard German: grammar, spelling, capitalisation, word order, missing or extra words, and word choices a native speaker would not use. Colloquial but correct German is fine. A missing full stop at the end is not an error. A missing comma before a subordinate clause is an error of type "punctuation". If you are not sure something is wrong, it is not an error.
2. ${taskRules(task)}
3. Give every target one status:
   "correct": used with the right meaning and form; for grammar targets the structure is built correctly.
   "flawed": right meaning, but a small form mistake in the target itself (article, ending, conjugation, spelling).
   "synonym": the target is not used, but a correct word or structure with the same meaning is.
   "wrong": wrong meaning, or the grammar structure is built incorrectly (for example the verb not at the end after "weil").
   "missing": not used at all.
   "comment": max 12 words in ${L} about how the target was used.
4. "corrected": the learner's answer with the smallest changes that make it correct. Keep their words and ideas. If there is no error, repeat the answer exactly.
5. "better": how a native speaker would say it more naturally, only if clearly better than "corrected"; otherwise "". Keep it one small step above the learner's level, so they can copy it.
6. "errors": one entry per mistake. "wrong" = the exact words from the learner's answer, "right" = the corrected words, "type" = one of: ${ERROR_LIST}. "rule" = the id of the grammar topic from the list below that explains the mistake, or "". "explain" = why, max 18 words, in ${L}.
7. "quality": "perfect" (no errors), "minor" (only small slips such as spelling, a comma or one ending), "major" (errors that change the meaning, or several errors).
8. "praise": max 8 words in simple German, about something specific they did well. "tip": one short hint in ${L} for next time, or "".
9. "level": the CEFR level this answer shows, judging range and accuracy together: "A1" (very simple, with basic mistakes), "A2" (simple sentences, mostly correct), "B1" (connected ideas, subordinate clauses, mostly correct), "B2" (varied and precise structures, few mistakes), "C1". A short, correct answer to a simple task is "A2", not higher.

Grammar topics for "rule": ${GRAMMAR_INDEX}

Reply with only this JSON, no other text:
{"targets":[{"id":"...","status":"correct","comment":"..."}],"quality":"perfect","corrected":"...","better":"","errors":[{"wrong":"...","right":"...","type":"case","rule":"g.praep-dativ","explain":"..."}],"praise":"...","tip":"","level":"A2"}`;
}

export interface GenRequest {
  key: string;
  type: "produce" | "combo" | "translate";
  targets: string[];
  /** Topic hint for variety. */
  topic?: string;
}

export function genPrompt(reqs: GenRequest[], catalog: Catalog, seedWords: string[], level = "A2–B1"): string {
  const lines = reqs.map((r, i) => {
    const t = r.targets
      .map((id) => catalog.get(id))
      .filter((x): x is Item => !!x)
      .map((it) => (it.kind === "gram" ? `${it.name} (${it.pattern})` : `${it.de} (${it.en})`))
      .join(" + ");
    return `${i + 1}. key "${r.key}", type ${r.type === "translate" ? "translate" : "situation"}${r.topic ? `, topic ${r.topic}` : ""}: ${t}`;
  });
  return `You write practice tasks for "Satzfabrik", a German trainer for an adult learner at about level ${level} who lives in a German-speaking country and wants to use German in daily life.

For each request of type "situation": write a short, concrete everyday situation (1–2 sentences in simple German the learner can read at their level, address the learner as "du") in which using ALL listed targets is natural, and the same situation in English. Leave "source_en" and "reference_de" empty.
For each request of type "translate": write one natural English sentence (max 16 words) whose German translation needs ALL listed targets, and a correct, natural German translation as "reference_de". Leave the scenario fields empty.

Make every task specific and different from the others: real places, times, people's names, small problems and plans from adult life (work, flat, landlord, doctor, offices, shopping, friends, family, travel, hobbies). For inspiration only: ${seedWords.join(", ")}.

Requests:
${lines.join("\n")}

Reply with only this JSON, no other text:
{"tasks":[{"key":"...","scenario_de":"...","scenario_en":"...","source_en":"","reference_de":""}]}`;
}

// --- the coach -------------------------------------------------------------------

export interface CoachMistake {
  wrong: string;
  right: string;
  type: ErrorType;
  /** Grammar id the corrector named for the mistake, or "". */
  rule: string;
  explain: string;
}

export interface CoachInput {
  sentences: number;
  mistakes: CoachMistake[];
  /** Every target of the shift with how it was used. */
  results: { id: string; status: TargetStatus }[];
  /** "Wortschatz A2+, Verben B1, …" */
  areas: string;
  /** Grammar ids with mistakes in earlier shifts. */
  weak: string[];
  current: { id: string; left: number }[];
  /** The grammar the coach may choose from. */
  allowed: GramItem[];
}

export function coachPrompt(inp: CoachInput, catalog: Catalog, lang: ExplainLang, level: string): string {
  const L = EXPLAIN_LANGS[lang].prompt;
  const name = (id: string) => {
    const it = catalog.get(id);
    return it ? (it.kind === "gram" ? it.name : it.de) : id;
  };
  const mistakes = inp.mistakes.length
    ? inp.mistakes.map((m) => `- "${m.wrong}" → "${m.right}" (${m.type}${m.rule ? `, ${m.rule}` : ""}): ${m.explain}`).join("\n")
    : "(none)";
  const tally = new Map<string, Map<string, number>>();
  for (const r of inp.results) {
    const t = tally.get(r.id) ?? new Map<string, number>();
    t.set(r.status, (t.get(r.status) ?? 0) + 1);
    tally.set(r.id, t);
  }
  const results = [...tally]
    .map(([id, t]) => `- ${name(id)} (${id}): ${[...t].map(([st, n]) => `${st} ${n}×`).join(", ")}`)
    .join("\n");
  const weak = inp.weak.length ? inp.weak.map((id) => `${id} (${name(id)})`).join(", ") : "none";
  const current = inp.current.length ? inp.current.map((c) => `${c.id} (${c.left} more shifts)`).join(", ") : "nothing";
  const allowed = inp.allowed.map((g) => `${g.id}: ${g.name} (${g.level})`).join("\n");
  return `You are the learning coach in "Satzfabrik", a German writing trainer for an adult learner at about level ${level}. After every practice shift you read what happened and decide which grammar topics the next shifts should practise extra.

THE SHIFT: ${inp.sentences} sentences written.
Mistakes (learner wrote → correction, error type, grammar topic, explanation):
${mistakes}

Targets practised and how they were used:
${results || "(none)"}

Level per area: ${inp.areas}
Weak spots from earlier shifts: ${weak}
Already in focus: ${current}

How to decide:
1. Look for patterns: the same kind of mistake twice or more, or a mistake that repeats an earlier weak spot. One typo or one slip is not a pattern.
2. For each pattern choose the ONE grammar topic from the list below that explains it best, for example "mit den Kollege" → the topic for prepositions with the dative, a verb not at the end after "weil" → the topic for "weil". Prefer topics at or below the learner's level.
3. Choose at most 3 topics, most important first. If there is no clear pattern, choose none. Only repeat a topic that is already in focus if the mistake happened again in this shift.
4. "why": max 12 words in ${L}, naming the learner's own mistake (quote it briefly).
5. "note": 1–2 short sentences in ${L} for the learner: one concrete thing that went well, and what the next shifts will practise (or that nothing needs extra practice). Friendly and specific, no generic praise.

Grammar topics you may choose (id: name (level)):
${allowed}

Reply with only this JSON, no other text:
{"note":"...","focus":[{"id":"g.praep-dativ","why":"..."}]}`;
}
