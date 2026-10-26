import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CoachSchema, GenSchema, GradeSchema, parseJsonLoose } from "./schema";

/**
 * Where corrections come from:
 * - "claude-app": running on claude.ai, calls Claude on the viewer's own subscription.
 * - "anthropic": the learner's own Claude API key (standalone version).
 * - "openai": any OpenAI-compatible endpoint, e.g. a local open-source model in Ollama or LM Studio.
 * - "offline": no AI; the learner compares with a model answer and rates themselves.
 */
export type ProviderId = "claude-app" | "anthropic" | "openai" | "offline";

export interface AIProvider {
  id: ProviderId;
  label: string;
  /** Returns the parsed JSON object the model produced. */
  json(prompt: string, kind: "grade" | "gen" | "coach", opts: { careful?: boolean; signal?: AbortSignal }): Promise<unknown>;
}

export interface AISettings {
  preferred: ProviderId | "auto";
  anthropicKey: string;
  anthropicModel: string;
  openaiBase: string;
  openaiModel: string;
  openaiKey: string;
}

export const ANTHROPIC_MODELS: { id: string; label: string; note: string }[] = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", note: "Most careful, slowest. About $1.50 per 60 corrections." },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "Very good and faster. About $0.70 per 60 corrections." },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "Fastest and cheapest. About 4 cents per 60 corrections." },
];

export class AIError extends Error {
  constructor(
    message: string,
    /** Short code for the UI: what the learner can do about it. */
    public code: "no_access" | "rate_limited" | "auth" | "network" | "bad_reply" | "cancelled" | "other",
  ) {
    super(message);
  }
}

// --- claude.ai: the `sample` capability of a published artifact -------------

interface SampleError {
  code: string;
  message: string;
}

type SampleFn = {
  json<T = unknown>(
    input: string,
    options?: { modelTier?: "quick" | "default" | "complex"; signal?: AbortSignal; cache?: boolean },
  ): Promise<T>;
};

declare global {
  interface Window {
    claude?: { use(name: string): Promise<unknown> };
  }
}

let samplePromise: Promise<SampleFn | null> | null = null;

/** Resolves the claude.ai sample function, or null outside claude.ai. */
export function claudeSample(): Promise<SampleFn | null> {
  if (!samplePromise) {
    samplePromise =
      typeof window !== "undefined" && typeof window.claude?.use === "function"
        ? window.claude.use("sample").then((s) => (s ? (s as SampleFn) : null)).catch(() => null)
        : Promise.resolve(null);
  }
  return samplePromise;
}

function sampleProvider(sample: SampleFn): AIProvider {
  return {
    id: "claude-app",
    label: "Claude (dein Abo)",
    async json(prompt, kind, opts) {
      try {
        return await sample.json(prompt, {
          modelTier: (kind === "grade" && opts.careful) || kind === "coach" ? "default" : "quick",
          signal: opts.signal,
          ...(kind !== "grade" ? { cache: false } : {}),
        });
      } catch (e) {
        const err = e as SampleError;
        if (err?.code === "cancelled") throw new AIError("Cancelled", "cancelled");
        if (err?.code === "rate_limited") throw new AIError("Claude is busy or your usage limit is reached. Try again in a moment.", "rate_limited");
        if (err?.code === "not_granted" || err?.code === "sampling_disabled" || err?.code === "not_declared")
          throw new AIError("Claude is not allowed for this page. Allow it in the artifact's permissions.", "no_access");
        if (err?.code === "invalid_json") throw new AIError("The corrector's reply was not readable.", "bad_reply");
        throw new AIError(err?.message || "Claude could not answer.", "other");
      }
    },
  };
}

// --- Claude API with the learner's own key -----------------------------------

const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-1"]);

function anthropicProvider(key: string, model: string): AIProvider {
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
  const label = ANTHROPIC_MODELS.find((m) => m.id === model)?.label ?? model;
  return {
    id: "anthropic",
    label,
    async json(prompt, kind, opts) {
      try {
        const res = await client.beta.messages.parse(
          {
            model,
            max_tokens: 8000,
            // Re-run on another model if a safety classifier ever declines a request.
            ...(FALLBACK_MODELS.has(model)
              ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
              : {}),
            output_config: {
              effort: (kind === "grade" && opts.careful) || kind === "coach" ? "medium" : "low",
              format: betaZodOutputFormat(kind === "grade" ? GradeSchema : kind === "coach" ? CoachSchema : GenSchema),
            },
            messages: [{ role: "user", content: prompt }],
          },
          { signal: opts.signal },
        );
        if (res.stop_reason === "refusal") throw new AIError("The request was declined.", "other");
        if (!res.parsed_output) throw new AIError("The corrector's reply was not readable.", "bad_reply");
        return res.parsed_output;
      } catch (e) {
        if (e instanceof AIError) throw e;
        if (e instanceof Anthropic.APIUserAbortError) throw new AIError("Cancelled", "cancelled");
        if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
          throw new AIError("The API key was rejected. Check it in Settings.", "auth");
        if (e instanceof Anthropic.RateLimitError) throw new AIError("Rate limit reached. Wait a moment.", "rate_limited");
        if (e instanceof Anthropic.APIConnectionError) throw new AIError("No connection to the Claude API.", "network");
        if (e instanceof Anthropic.APIError) throw new AIError(`Claude API error ${e.status ?? ""}: ${e.message}`, "other");
        throw new AIError(e instanceof Error ? e.message : "Unknown error", "other");
      }
    },
  };
}

// --- OpenAI-compatible endpoint (local open-source models) -------------------

function openaiProvider(base: string, model: string, key: string): AIProvider {
  const url = `${base.replace(/\/+$/, "")}/chat/completions`;
  return {
    id: "openai",
    label: model || "Lokales Modell",
    async json(prompt, _kind, opts) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2,
            response_format: { type: "json_object" },
          }),
          signal: opts.signal,
        });
      } catch (e) {
        if ((e as Error)?.name === "AbortError") throw new AIError("Cancelled", "cancelled");
        throw new AIError(`Cannot reach ${base}. Is the model server running and does it allow this page (CORS)?`, "network");
      }
      if (res.status === 401 || res.status === 403) throw new AIError("The endpoint rejected the key.", "auth");
      if (res.status === 429) throw new AIError("Rate limit reached. Wait a moment.", "rate_limited");
      if (!res.ok) throw new AIError(`Model server error ${res.status}.`, "other");
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = body.choices?.[0]?.message?.content ?? "";
      try {
        return parseJsonLoose(text);
      } catch {
        throw new AIError("The model's reply was not valid JSON. Try a larger model.", "bad_reply");
      }
    },
  };
}

export const OFFLINE: AIProvider = {
  id: "offline",
  label: "Ohne KI",
  async json() {
    throw new AIError("No corrector configured.", "no_access");
  },
};

/** Pick the provider to use: claude.ai first (free with the subscription), then configured ones. */
export async function resolveProvider(s: AISettings): Promise<AIProvider> {
  const want = s.preferred;
  if (want === "offline") return OFFLINE;
  if (want === "anthropic" && s.anthropicKey) return anthropicProvider(s.anthropicKey, s.anthropicModel);
  if (want === "openai" && s.openaiBase) return openaiProvider(s.openaiBase, s.openaiModel, s.openaiKey);
  const sample = await claudeSample();
  if (sample) return sampleProvider(sample);
  if (s.anthropicKey) return anthropicProvider(s.anthropicKey, s.anthropicModel);
  if (s.openaiBase && s.openaiModel) return openaiProvider(s.openaiBase, s.openaiModel, s.openaiKey);
  return OFFLINE;
}
