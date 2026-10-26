import { z } from "zod";
import { ERROR_TYPES, type ErrorType } from "../content/types";

const ERROR_KEYS = Object.keys(ERROR_TYPES) as [ErrorType, ...ErrorType[]];

export const TargetStatus = z.enum(["correct", "flawed", "synonym", "wrong", "missing"]);
export type TargetStatus = z.infer<typeof TargetStatus>;

/** What the corrector returns for one answer. Every field is required (structured outputs). */
export const GradeSchema = z.object({
  targets: z.array(
    z.object({
      id: z.string(),
      status: TargetStatus,
      comment: z.string(),
    }),
  ),
  quality: z.enum(["perfect", "minor", "major"]),
  corrected: z.string(),
  better: z.string(),
  errors: z.array(
    z.object({
      wrong: z.string(),
      right: z.string(),
      type: z.enum(ERROR_KEYS),
      rule: z.string(),
      explain: z.string(),
    }),
  ),
  praise: z.string(),
  tip: z.string(),
});

export type GradeOutput = z.infer<typeof GradeSchema>;

export type GradeSource = "ai" | "exact" | "self";

export interface GradeResult extends GradeOutput {
  source: GradeSource;
  /** Which corrector answered, for display. */
  by: string;
}

export const GenSchema = z.object({
  tasks: z.array(
    z.object({
      key: z.string(),
      scenario_de: z.string(),
      scenario_en: z.string(),
      source_en: z.string(),
      reference_de: z.string(),
    }),
  ),
});

export type GenOutput = z.infer<typeof GenSchema>;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Accept slightly malformed JSON from models without structured outputs:
 * unknown enum values fall back to safe defaults, missing fields become "".
 */
export function coerceGrade(
  raw: unknown,
  targetIds: string[],
  fallback: (id: string) => TargetStatus = () => "correct",
): GradeOutput {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const statuses = TargetStatus.options as readonly string[];
  const rawTargets = Array.isArray(o.targets) ? o.targets : [];
  const targets = targetIds.map((id) => {
    const t = rawTargets.find((x) => x && typeof x === "object" && str((x as Record<string, unknown>).id) === id) as
      | Record<string, unknown>
      | undefined;
    const status = t && statuses.includes(str(t.status)) ? (str(t.status) as TargetStatus) : fallback(id);
    return { id, status, comment: t ? str(t.comment) : "" };
  });
  const errorsRaw = Array.isArray(o.errors) ? o.errors : [];
  const qualityRaw = str(o.quality);
  const quality: GradeOutput["quality"] =
    qualityRaw === "perfect" || qualityRaw === "minor" || qualityRaw === "major"
      ? qualityRaw
      : errorsRaw.length === 0
        ? "perfect"
        : "minor";
  const errors = errorsRaw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({
      wrong: str(e.wrong),
      right: str(e.right),
      type: (ERROR_KEYS as readonly string[]).includes(str(e.type)) ? (str(e.type) as ErrorType) : "other",
      rule: str(e.rule),
      explain: str(e.explain),
    }))
    .filter((e) => e.wrong || e.right || e.explain);
  return {
    targets,
    quality,
    corrected: str(o.corrected),
    better: str(o.better),
    errors,
    praise: str(o.praise),
    tip: str(o.tip),
  };
}

export function coerceGen(raw: unknown): GenOutput {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(o.tasks) ? o.tasks : Array.isArray(raw) ? (raw as unknown[]) : [];
  return {
    tasks: list
      .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
      .map((t) => ({
        key: str(t.key),
        scenario_de: str(t.scenario_de),
        scenario_en: str(t.scenario_en),
        source_en: str(t.source_en),
        reference_de: str(t.reference_de),
      }))
      .filter((t) => t.key),
  };
}

/** Pull one JSON value out of a model reply that may have prose or a code fence around it. */
export function parseJsonLoose(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    /* fall through */
  }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      /* fall through */
    }
  }
  const start = t.search(/[[{]/);
  const end = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
  throw new Error("No JSON in reply");
}
