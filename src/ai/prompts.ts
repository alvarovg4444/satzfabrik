import type { Catalog } from "../content/catalog";
import { GRAMMAR } from "../content/catalog";
import { ERROR_TYPES, type Item } from "../content/types";
import type { Task } from "../engine/tasks";

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

export function gradePrompt(task: Task, answer: string, catalog: Catalog, lang: ExplainLang): string {
  const L = EXPLAIN_LANGS[lang].prompt;
  const targets = task.targets
    .map((id) => catalog.get(id))
    .filter((x): x is Item => !!x)
    .map((it) => `- ${describeTarget(it)}`)
    .join("\n");
  return `You are the corrector in "Satzfabrik", a German writing trainer. The learner is an adult at level A2–B1 who wants to write and speak natural everyday German. Correct like an experienced, kind teacher of German as a foreign language: precise, never pedantic, and never inventing errors.

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
5. "better": how a native speaker would say it more naturally, only if clearly better than "corrected"; otherwise "".
6. "errors": one entry per mistake. "wrong" = the exact words from the learner's answer, "right" = the corrected words, "type" = one of: ${ERROR_LIST}. "rule" = the id of the grammar topic from the list below that explains the mistake, or "". "explain" = why, max 18 words, in ${L}.
7. "quality": "perfect" (no errors), "minor" (only small slips such as spelling, a comma or one ending), "major" (errors that change the meaning, or several errors).
8. "praise": max 8 words in simple German, about something specific they did well. "tip": one short hint in ${L} for next time, or "".

Grammar topics for "rule": ${GRAMMAR_INDEX}

Reply with only this JSON, no other text:
{"targets":[{"id":"...","status":"correct","comment":"..."}],"quality":"perfect","corrected":"...","better":"","errors":[{"wrong":"...","right":"...","type":"case","rule":"g.praep-dativ","explain":"..."}],"praise":"...","tip":""}`;
}

export interface GenRequest {
  key: string;
  type: "produce" | "combo" | "translate";
  targets: string[];
  /** Topic hint for variety. */
  topic?: string;
}

export function genPrompt(reqs: GenRequest[], catalog: Catalog, seedWords: string[]): string {
  const lines = reqs.map((r, i) => {
    const t = r.targets
      .map((id) => catalog.get(id))
      .filter((x): x is Item => !!x)
      .map((it) => (it.kind === "gram" ? `${it.name} (${it.pattern})` : `${it.de} (${it.en})`))
      .join(" + ");
    return `${i + 1}. key "${r.key}", type ${r.type === "translate" ? "translate" : "situation"}${r.topic ? `, topic ${r.topic}` : ""}: ${t}`;
  });
  return `You write practice tasks for "Satzfabrik", a German trainer for an adult learner at level A2–B1 who lives in a German-speaking country and wants to use German in daily life.

For each request of type "situation": write a short, concrete everyday situation (1–2 sentences, simple German at A2 level, address the learner as "du") in which using ALL listed targets is natural, and the same situation in English. Leave "source_en" and "reference_de" empty.
For each request of type "translate": write one natural English sentence (max 16 words) whose German translation needs ALL listed targets, and a correct, natural German translation as "reference_de". Leave the scenario fields empty.

Make every task specific and different from the others: real places, times, people's names, small problems and plans from adult life (work, flat, landlord, doctor, offices, shopping, friends, family, travel, hobbies). For inspiration only: ${seedWords.join(", ")}.

Requests:
${lines.join("\n")}

Reply with only this JSON, no other text:
{"tasks":[{"key":"...","scenario_de":"...","scenario_en":"...","source_en":"","reference_de":""}]}`;
}
