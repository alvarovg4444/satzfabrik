import type { Task } from "../engine/tasks";

/*
 * The situation bank: situations and translation sentences the AI wrote for particular
 * words and structures, kept on this device until a shift uses them. Shifts take from it
 * first, so even the first task is fresh and fits its word, and nothing is shown twice. It
 * is kept apart from the save, so a new game keeps it.
 */

export interface Situation {
  de: string;
  en: string;
}

export interface Sentence {
  source: string;
  reference: string;
}

/** "s": a situation for a writing task; "t": a sentence for a translation task. */
export type BankKind = "s" | "t";

interface Entry {
  s?: Situation[];
  t?: Sentence[];
  /** Last change, to drop the oldest items when the bank is full. */
  at: number;
}

const KEY = "satzfabrik.bank.v1";
/** Per word and kind: enough for the next few times it comes up. */
const PER_ITEM = 3;
/** Words and structures in the bank (about 1 KB each). */
const MAX_ITEMS = 600;

let bank: Record<string, Entry> | null = null;

function load(): Record<string, Entry> {
  if (bank) return bank;
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    bank = raw && typeof raw === "object" ? (raw as Record<string, Entry>) : {};
  } catch {
    // no storage (private mode, tests): the bank lives in memory
    bank = {};
  }
  return bank;
}

function save() {
  const b = load();
  const ids = Object.keys(b);
  if (ids.length > MAX_ITEMS) {
    ids
      .sort((x, y) => b[x].at - b[y].at)
      .slice(0, ids.length - MAX_ITEMS)
      .forEach((id) => delete b[id]);
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* no storage or full: keep it in memory */
  }
}

/** What a task can take from the bank: a situation for a one-word writing task, a sentence for a translation. */
export function bankKind(t: Task): BankKind | null {
  if (t.targets.length !== 1) return null;
  if (t.type === "produce") return "s";
  if (t.type === "translate") return "t";
  return null;
}

/** How many unused entries the bank holds for an item. */
export function banked(id: string, kind: BankKind): number {
  return load()[id]?.[kind]?.length ?? 0;
}

export function bankPut(id: string, kind: "s", value: Situation): void;
export function bankPut(id: string, kind: "t", value: Sentence): void;
export function bankPut(id: string, kind: BankKind, value: Situation | Sentence): void {
  const b = load();
  const entry = (b[id] ??= { at: Date.now() });
  const list = (kind === "s" ? (entry.s ??= []) : (entry.t ??= [])) as (Situation | Sentence)[];
  const json = JSON.stringify(value);
  if (list.some((x) => JSON.stringify(x) === json)) return;
  list.push(value);
  if (list.length > PER_ITEM) list.splice(0, list.length - PER_ITEM);
  entry.at = Date.now();
  save();
}

function take(id: string, kind: BankKind): Situation | Sentence | null {
  const b = load();
  const entry = b[id];
  const list = entry?.[kind];
  if (!entry || !list?.length) return null;
  const value = list.shift()!;
  if (!entry.s?.length && !entry.t?.length) delete b[id];
  save();
  return value;
}

/** Gives the shift's tasks what the bank holds for them. Returns the tasks, and the keys of those that got something. */
export function applyBank(tasks: Task[]): { tasks: Task[]; filled: Set<string> } {
  const filled = new Set<string>();
  const out = tasks.map((t) => {
    const kind = bankKind(t);
    const value = kind ? take(t.targets[0], kind) : null;
    if (!value) return t;
    filled.add(t.key);
    if (kind === "s") return { ...t, scenario: value as Situation };
    const s = value as Sentence;
    return { ...t, source: s.source, reference: s.reference };
  });
  return { tasks: out, filled };
}

/** Forgets the in-memory copy (tests). */
export function resetBankMemory() {
  bank = null;
}
