import type { Catalog } from "../content/catalog";
import type { Item } from "../content/types";
import type { Task } from "../engine/tasks";
import { mentions, sameSentence } from "../engine/text";
import { coachPrompt, genPrompt, gradePrompt, type CoachInput, type ExplainLang, type GenRequest } from "./prompts";
import { AIError, type AIProvider } from "./providers";
import { coerceCoach, coerceGen, coerceGrade, type CoachOutput, type GradeResult, type TargetStatus } from "./schema";

/** Correct one answer. Throws AIError when no corrector can answer (the UI then offers self-check). */
export async function gradeAnswer(
  provider: AIProvider,
  task: Task,
  answer: string,
  catalog: Catalog,
  opts: { lang: ExplainLang; careful: boolean; signal?: AbortSignal; level?: string },
): Promise<GradeResult> {
  if (task.reference && sameSentence(answer, task.reference)) return exactMatch(task, answer);
  if (provider.id === "offline") throw new AIError("No corrector configured.", "no_access");
  const raw = await provider.json(gradePrompt(task, answer, catalog, opts.lang, opts.level), "grade", {
    careful: opts.careful,
    signal: opts.signal,
  });
  const fallback = (id: string): TargetStatus => {
    const it = catalog.get(id);
    return it && !mentions(answer, it) ? "missing" : "correct";
  };
  const out = coerceGrade(raw, task.targets, fallback);
  if (!out.corrected) out.corrected = answer.trim();
  return { ...out, source: "ai", by: provider.label };
}

function exactMatch(task: Task, answer: string): GradeResult {
  return {
    targets: task.targets.map((id) => ({ id, status: "correct", comment: "" })),
    quality: "perfect",
    corrected: answer.trim(),
    better: "",
    errors: [],
    praise: "Genau wie die Musterlösung!",
    tip: "",
    source: "exact",
    by: "Musterlösung",
  };
}

export type SelfRating = "right" | "almost" | "wrong";

/** Without AI: the learner compares with the model answer and rates honestly. */
export function selfGrade(task: Task, answer: string, rating: SelfRating, catalog: Catalog): GradeResult {
  const status: TargetStatus = rating === "right" ? "correct" : rating === "almost" ? "flawed" : "wrong";
  return {
    targets: task.targets.map((id) => {
      const it = catalog.get(id);
      return { id, status: it && !mentions(answer, it) && rating !== "wrong" ? "flawed" : status, comment: "" };
    }),
    quality: rating === "right" ? "perfect" : rating === "almost" ? "minor" : "major",
    corrected: answer.trim(),
    better: "",
    errors: [],
    praise: "",
    tip: "",
    source: "self",
    by: "Selbstkontrolle",
  };
}

/** Is the reworked sentence acceptable? Exact match with the correction avoids an AI call. */
export async function checkRework(
  provider: AIProvider,
  task: Task,
  first: GradeResult,
  attempt: string,
  catalog: Catalog,
  opts: { lang: ExplainLang; signal?: AbortSignal; level?: string },
): Promise<GradeResult | "match"> {
  if (sameSentence(attempt, first.corrected) || (first.better && sameSentence(attempt, first.better))) return "match";
  return gradeAnswer(provider, task, attempt, catalog, { lang: opts.lang, careful: false, signal: opts.signal, level: opts.level });
}

const INSPIRATION = [
  "Montagmorgen",
  "Paketbote",
  "Nachbarin",
  "Kantine",
  "Geburtstag",
  "Zugausfall",
  "Wochenmarkt",
  "Elternabend",
  "Bewerbungsgespräch",
  "Fitnessstudio",
  "Steuererklärung",
  "Hausarzt",
  "Umzug",
  "Grillabend",
  "Schlüsseldienst",
  "Kita",
  "Wanderung",
  "Handyvertrag",
];

/**
 * Ask the AI for fresh, varied situations for the tasks of a shift. Returns a
 * partial update per task key; tasks keep their built-in content if this fails.
 */
export async function freshenTasks(
  provider: AIProvider,
  tasks: Task[],
  catalog: Catalog,
  signal?: AbortSignal,
  level?: string,
): Promise<Map<string, Partial<Task>>> {
  const out = new Map<string, Partial<Task>>();
  if (provider.id === "offline") return out;
  const reqs: GenRequest[] = [];
  const keyFor = new Map<string, string>();
  tasks.forEach((t, i) => {
    if (t.type !== "produce" && t.type !== "combo") return;
    const k = `t${i}`;
    keyFor.set(k, t.key);
    const topicItem = t.targets.map((id) => catalog.get(id)).find((it): it is Item => !!it && it.kind !== "gram");
    reqs.push({ key: k, type: t.type, targets: t.targets, topic: topicItem?.topic });
  });
  if (!reqs.length) return out;
  const seed = Math.floor(Math.random() * INSPIRATION.length);
  const words = [0, 5, 11].map((d) => INSPIRATION[(seed + d) % INSPIRATION.length]);
  const raw = await provider.json(genPrompt(reqs, catalog, words, level), "gen", { signal });
  for (const g of coerceGen(raw).tasks) {
    const key = keyFor.get(g.key);
    if (!key || !g.scenario_de) continue;
    out.set(key, { scenario: { de: g.scenario_de, en: g.scenario_en || "" } });
  }
  return out;
}

/** The coach reads a finished shift and picks the grammar the next shifts should practise. */
export async function diagnoseShift(
  provider: AIProvider,
  input: CoachInput,
  catalog: Catalog,
  opts: { lang: ExplainLang; level: string; signal?: AbortSignal },
): Promise<CoachOutput> {
  if (provider.id === "offline") throw new AIError("No coach configured.", "no_access");
  const raw = await provider.json(coachPrompt(input, catalog, opts.lang, opts.level), "coach", { signal: opts.signal });
  return coerceCoach(raw);
}
