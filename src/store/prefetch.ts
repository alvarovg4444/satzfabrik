import { bankKind, banked, bankPut } from "../ai/bank";
import { freshenTasks } from "../ai/corrector";
import { levelLabel, overall } from "../engine/level";
import type { Task } from "../engine/tasks";
import { planShift } from "../game/plan";
import { store } from "./store";

/** Tasks of the next shift to prepare: the first ones matter most. */
const AHEAD = 6;
/** Situations to keep per word: one for the next time it comes up, one for the time after. */
const PER_WORD = 2;
/** At most one request every few minutes (each one counts towards the learner's usage). */
const MIN_GAP_MS = 3 * 60_000;

let running = false;
let last = 0;

/**
 * Asks the AI for situations and sentences for the next shift's tasks that the bank has
 * nothing for yet, so the next shift starts with fresh ones, the first task included.
 * Returns how many were stored.
 */
export async function prefetchNextShift(force = false): Promise<number> {
  const meta = store.meta();
  const st = store.get();
  if (running || !meta.providerReady || meta.provider.id === "offline" || !st.settings.freshTasks || !st.onboarded) return 0;
  const now = Date.now();
  if (!force && now - last < MIN_GAP_MS) return 0;
  const catalog = store.catalog();
  let plan = planShift(st, catalog, now, false);
  if (!plan.length) plan = planShift(st, catalog, now, true);
  const seen = new Set<string>();
  const want: Task[] = [];
  for (const t of plan) {
    const kind = bankKind(t);
    const key = kind ? `${t.targets[0]}:${kind}` : "";
    if (!kind || seen.has(key)) continue;
    seen.add(key);
    const missing = PER_WORD - banked(t.targets[0], kind);
    // the same task twice asks for two different situations
    for (let i = 0; i < missing; i++) want.push(i ? { ...t, key: `${t.key}#${i}` } : t);
    if (seen.size >= AHEAD) break;
  }
  if (!want.length) return 0;
  running = true;
  last = now;
  try {
    const updates = await freshenTasks(meta.provider, want, catalog, undefined, levelLabel(overall(st.level).theta).code);
    return keepForLater(want, updates);
  } catch {
    return 0;
  } finally {
    running = false;
  }
}

/** Stores AI content for tasks in the bank (e.g. for tasks the learner has already passed). */
export function keepForLater(tasks: Task[], updates: Map<string, Partial<Task>>): number {
  let n = 0;
  for (const t of tasks) {
    const u = updates.get(t.key);
    const kind = bankKind(t);
    if (!u || !kind) continue;
    if (kind === "s" && u.scenario) {
      bankPut(t.targets[0], "s", u.scenario);
      n++;
    } else if (kind === "t" && u.source && u.reference) {
      bankPut(t.targets[0], "t", { source: u.source, reference: u.reference });
      n++;
    }
  }
  return n;
}
