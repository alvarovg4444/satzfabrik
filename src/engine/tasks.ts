import type { Catalog } from "../content/catalog";
import type { GramItem, Item, Scenario } from "../content/types";
import { isDue, newCard, rustOf, stageOf, type CardState } from "./srs";
import { dayKey, hash, pick, rng, withoutArticle } from "./text";

export type TaskType = "intro" | "produce" | "translate" | "transform" | "combo";

/** What the learner sees for one target, faded as the item matures. */
export interface Cue {
  itemId: string;
  /** Main text on the chip, e.g. "Termin" or "appointment". */
  label: string;
  /** Second line, e.g. the English meaning or a first-letter hint. */
  sub?: string;
  /** Full info revealed on tap. */
  reveal: string;
}

export interface Task {
  key: string;
  type: TaskType;
  targets: string[];
  instruction: string;
  instructionEn: string;
  scenario?: { de: string; en: string };
  /** Sentence to translate (EN) or to transform (DE). */
  source?: string;
  /** A model answer, when the task has one. */
  reference?: string;
  cues: Cue[];
  /** Soft goal shown as a word counter. */
  minWords?: number;
  /** Why this task is in the shift. */
  reason: "new" | "due" | "weak" | "practice" | "refresh" | "focus";
}

const DE_TYPE: Record<Exclude<TaskType, "intro">, { de: string; en: string }> = {
  produce: { de: "Satz bauen", en: "Build a sentence" },
  translate: { de: "Übersetzen", en: "Translate" },
  transform: { de: "Umbauen", en: "Transform" },
  combo: { de: "Kombi-Auftrag", en: "Combo order" },
};

export function taskTitle(t: Task): { de: string; en: string } {
  return t.type === "intro" ? { de: "Neuer Bauplan", en: "New blueprint" } : DE_TYPE[t.type];
}

function nounInfo(it: Extract<Item, { kind: "noun" }>): string {
  return it.plural ? `${it.de}, die ${it.plural}` : `${it.de} (kein Plural)`;
}

/** Full description of an item, shown when the learner taps a cue. */
export function revealText(it: Item): string {
  switch (it.kind) {
    case "noun":
      return `${nounInfo(it)} — ${it.en}`;
    case "verb":
      return `${it.de} — ${it.en} · er ${it.pres.er}, ${it.prat}, ${it.perf}${it.gov ? ` · ${it.gov}` : ""}`;
    case "gram":
      return `z. B. ${it.examples[0]?.de ?? it.example.de}`;
    case "expr":
      return `${it.de} — ${it.en}`;
    default:
      return `${it.de} — ${it.en}`;
  }
}

/**
 * The first time (a blueprint, stage 0) the cue shows everything: the German word or the
 * structure. On every review it only shows what to say (the meaning, or the structure's
 * name), so the learner has to recall the rest; the full help is one tap away (reveal).
 * A first-letter hint stays for the young stages (1–2) and goes after that.
 */
export function cueFor(it: Item, stage: number): Cue {
  const reveal = revealText(it);
  const initial = (s: string) => `${s.charAt(0)}…`;
  const young = stage <= 2;
  if (stage === 0) {
    switch (it.kind) {
      case "noun":
        return { itemId: it.id, label: it.de, sub: it.en, reveal };
      case "verb":
        return { itemId: it.id, label: it.de, sub: `${it.en} · ${it.perf}`, reveal };
      case "gram":
        return { itemId: it.id, label: it.cue, sub: it.pattern, reveal };
      default:
        return { itemId: it.id, label: it.de, sub: it.en, reveal };
    }
  }
  switch (it.kind) {
    case "noun":
      return { itemId: it.id, label: it.en, sub: young ? `Nomen · ${initial(it.lemma)}` : "Nomen", reveal };
    case "verb":
      return { itemId: it.id, label: it.en, sub: young ? `Verb · ${initial(it.lemma)}` : "Verb", reveal };
    case "adj":
    case "adv":
    case "word":
      return { itemId: it.id, label: it.en, sub: young ? initial(it.lemma) : undefined, reveal };
    case "expr":
      return { itemId: it.id, label: it.en, sub: young ? `Ausdruck · ${initial(it.de)}` : "Ausdruck", reveal };
    case "gram":
      return { itemId: it.id, label: it.name, sub: undefined, reveal: `${it.cue} · ${it.pattern} · ${reveal}` };
  }
}

/** A situation written for this item if there is one, else one of its topic's. */
function scenarioFor(it: Item, catalog: Catalog, seed: number): Scenario {
  const own = catalog.situationsOf(it.id);
  if (own.length) return pick(own, rng(seed));
  const list = catalog.scenariosFor(it.kind === "gram" ? undefined : it.topic);
  return pick(list, rng(seed));
}

function produceTask(it: Item, card: CardState, catalog: Catalog, seed: number, reason: Task["reason"]): Task {
  const stage = stageOf(card);
  const sc = scenarioFor(it, catalog, seed);
  const isExpr = it.kind === "expr";
  const isGram = it.kind === "gram";
  return {
    key: `${it.id}:produce:${seed}`,
    type: "produce",
    targets: [it.id],
    instruction: isExpr
      ? "Benutze den Ausdruck in dieser Situation."
      : isGram
        ? "Schreib 1–2 Sätze zu der Situation und benutze die Struktur."
        : "Schreib einen Satz zu der Situation und benutze das Wort.",
    instructionEn: isExpr
      ? "Use the expression in this situation."
      : isGram
        ? "Write 1–2 sentences about the situation using the structure."
        : "Write a sentence about the situation using the word.",
    scenario: { de: sc.de, en: sc.en },
    cues: [cueFor(it, stage)],
    minWords: stage >= 2 ? 6 : 4,
    reason,
  };
}

function translateTask(it: GramItem, card: CardState, idx: number, reason: Task["reason"]): Task {
  const tr = it.translate[idx % it.translate.length];
  return {
    key: `${it.id}:translate:${idx}`,
    type: "translate",
    targets: [it.id],
    instruction: "Übersetze ins Deutsche.",
    instructionEn: "Translate into German.",
    source: tr.en,
    reference: tr.de,
    cues: [cueFor(it, stageOf(card))],
    reason,
  };
}

function transformTask(it: GramItem, card: CardState, idx: number, reason: Task["reason"]): Task | null {
  if (!it.transform?.length) return null;
  const tf = it.transform[idx % it.transform.length];
  return {
    key: `${it.id}:transform:${idx}`,
    type: "transform",
    targets: [it.id],
    instruction: tf.prompt,
    instructionEn: "Rewrite as asked.",
    source: tf.input,
    reference: tf.answer,
    cues: [cueFor(it, stageOf(card))],
    reason,
  };
}

/**
 * Pick the task type that fits the item's stage, rotating for variety. `salt` (the game
 * and the shift) varies the built-in situation and sentence, so a new game or a later
 * shift does not repeat the same one.
 */
export function taskForItem(
  it: Item,
  card: CardState,
  catalog: Catalog,
  now: number,
  reason: Task["reason"],
  salt = "",
): Task {
  const seed = hash(`${it.id}|${dayKey(now)}|${card.reps}${salt ? `|${salt}` : ""}`);
  if (it.kind !== "gram") return produceTask(it, card, catalog, seed, reason);
  const stage = stageOf(card);
  const turn = card.reps + card.ok + card.fail + (salt ? hash(salt) % 6 : 0);
  if (stage <= 1) {
    return turn % 3 === 2
      ? (transformTask(it, card, turn, reason) ?? translateTask(it, card, turn, reason))
      : translateTask(it, card, turn, reason);
  }
  if (stage === 2) {
    if (turn % 3 === 0) return transformTask(it, card, turn, reason) ?? produceTask(it, card, catalog, seed, reason);
    return turn % 3 === 1 ? produceTask(it, card, catalog, seed, reason) : translateTask(it, card, turn, reason);
  }
  return turn % 2 === 0 ? produceTask(it, card, catalog, seed, reason) : translateTask(it, card, turn, reason);
}

export function introTask(it: Item): Task {
  return {
    key: `${it.id}:intro`,
    type: "intro",
    targets: [it.id],
    instruction: "Neuer Bauplan! Lies ihn kurz, dann baust du die Maschine mit deinem ersten Satz.",
    instructionEn: "New blueprint! Read it, then build the machine with your first sentence.",
    cues: [cueFor(it, 0)],
    reason: "new",
  };
}

export function comboTask(items: Item[], cards: CardState[], catalog: Catalog, now: number, salt = ""): Task {
  const seed = hash(`${items.map((i) => i.id).join("+")}|${dayKey(now)}${salt ? `|${salt}` : ""}`);
  const topicItem = items.find((i) => i.kind !== "gram") ?? items[0];
  const sc = scenarioFor(topicItem, catalog, seed);
  return {
    key: `combo:${items.map((i) => i.id).join("+")}:${seed}`,
    type: "combo",
    targets: items.map((i) => i.id),
    instruction: "Schreib 1–3 Sätze zu der Situation. Benutze alle Bausteine.",
    instructionEn: "Write 1–3 sentences about the situation. Use every building block.",
    scenario: { de: sc.de, en: sc.en },
    cues: items.map((it, i) => cueFor(it, stageOf(cards[i]))),
    minWords: 8,
    reason: "due",
  };
}

export interface ShiftInput {
  cards: Record<string, CardState>;
  catalog: Catalog;
  now: number;
  /** Grammar ids the learner recently got wrong, most frequent first. */
  weakRules: string[];
  size: number;
  /** Also include items that are not due yet (extra practice). */
  extra?: boolean;
  maxNew?: number;
  /** A1 basics to check again; the learner has no machine for them yet. */
  refresh?: Item[];
  /** Grammar the coach put in focus: practised extra, early in the shift. */
  focus?: string[];
  /** Wartungsschicht: only the rusting machines, no blueprints, focus, weak spot or refreshers. */
  maintenance?: boolean;
  /** Varies the built-in situations and sentences between games and shifts (see taskForItem). */
  salt?: string;
}

/**
 * A basics check: only the meaning is shown (a word) or an English sentence to
 * translate (a structure), so the learner has to recall the German themselves.
 */
export function refreshTask(it: Item, now: number, catalog: Catalog, salt = ""): Task {
  const card = newCard(it.id, now);
  if (it.kind === "gram") {
    const t = translateTask(it, card, hash(`${it.id}|${dayKey(now)}${salt ? `|${salt}` : ""}`), "refresh");
    return { ...t, key: `${it.id}:refresh`, cues: [cueFor(it, 3)] };
  }
  const t = taskForItem(it, card, catalog, now, "refresh", salt);
  return { ...t, key: `${it.id}:refresh`, cues: [cueFor(it, 3)], minWords: 4 };
}

/** At most this many rusting machines in one shift; the rest wait for the next one. */
export const MAX_DUE_PER_SHIFT = 25;

/**
 * Compose a shift. Rusting machines come first and all of them get in (up to
 * MAX_DUE_PER_SHIFT), even if the shift grows past its size for that. Then the coach's
 * focus, one weak spot, extra practice and A1 refreshers. New blueprints (intro + first
 * sentence) are interleaved so the shift never feels like a wall.
 * A maintenance shift (Wartungsschicht) is only the rusting machines.
 */
export function buildShift(input: ShiftInput): Task[] {
  const { cards, catalog, now, size } = input;
  const salt = input.salt ?? "";
  const maint = !!input.maintenance;
  const maxNew = maint ? 0 : (input.maxNew ?? 3);
  const owned = Object.values(cards).filter((c) => catalog.get(c.id));
  const used = new Set<string>();
  const out: Task[] = [];

  const focus = new Set(maint ? [] : (input.focus ?? []));
  // A focus topic the learner has no machine for yet comes as a blueprint, even past today's limit.
  const blueprints = owned
    .filter((c) => stageOf(c) === 0)
    .sort((a, b) => Number(focus.has(b.id)) - Number(focus.has(a.id)) || a.unlockedAt - b.unlockedAt)
    .filter((c, i) => i < maxNew || focus.has(c.id));
  const fresh: Task[] = [];
  for (const c of blueprints) {
    const it = catalog.get(c.id)!;
    used.add(c.id);
    fresh.push(introTask(it));
    fresh.push(taskForItem(it, c, catalog, now, "new", salt));
  }

  // Rustiest first. Every due machine gets in (up to the cap), whatever the shift size.
  const due = owned
    .filter((c) => !used.has(c.id) && isDue(c, now))
    .sort((a, b) => rustOf(b, now) - rustOf(a, now) || a.due - b.due)
    .slice(0, MAX_DUE_PER_SHIFT);
  const singles: Task[] = [];
  const mature: CardState[] = [];
  for (const c of due) {
    used.add(c.id);
    if (stageOf(c) >= 3) mature.push(c);
    else singles.push(taskForItem(catalog.get(c.id)!, c, catalog, now, "due", salt));
  }
  const combos: Task[] = [];
  // Mature machines are maintained in combos: one structure + one or two words.
  const gram = mature.filter((c) => catalog.get(c.id)!.kind === "gram");
  const vocab = mature.filter((c) => catalog.get(c.id)!.kind !== "gram");
  while (gram.length + vocab.length > 0) {
    const group: CardState[] = [];
    if (gram.length) group.push(gram.shift()!);
    while (group.length < 3 && vocab.length) group.push(vocab.shift()!);
    if (group.length < 3 && gram.length) group.push(gram.shift()!);
    if (group.length === 1) {
      combos.push(taskForItem(catalog.get(group[0].id)!, group[0], catalog, now, "due", salt));
    } else {
      combos.push(comboTask(group.map((c) => catalog.get(c.id)!), group, catalog, now, salt));
    }
  }
  const rust = interleave(singles, combos);

  const focused: Task[] = [];
  for (const id of focus) {
    const c = cards[id];
    const it = catalog.get(id);
    if (!c || !it || used.has(id) || stageOf(c) === 0) continue;
    used.add(id);
    focused.push(taskForItem(it, c, catalog, now, "focus", salt));
  }

  let weak: Task | null = null;
  if (!maint) {
    for (const id of input.weakRules) {
      const c = cards[id];
      const it = catalog.get(id);
      if (c && it && stageOf(c) > 0 && !used.has(id)) {
        used.add(id);
        weak = taskForItem(it, c, catalog, now, "weak", salt);
        break;
      }
    }
  }

  const practice: Task[] = [];
  if (input.extra && !maint) {
    const budget = size - fresh.length / 2 - rust.length - focused.length - (weak ? 1 : 0);
    const rest = owned
      .filter((c) => !used.has(c.id) && stageOf(c) > 0)
      .sort((a, b) => a.due - b.due);
    for (const c of rest) {
      if (practice.length >= budget) break;
      used.add(c.id);
      practice.push(taskForItem(catalog.get(c.id)!, c, catalog, now, "practice", salt));
    }
  }

  // After the rust: the coach's topics, the weak spot and practice, then the A1 refreshers.
  const others: Task[] = [...focused];
  const r = rng(hash(dayKey(now) + owned.length));
  if (weak) others.splice(Math.min(others.length, Math.floor(r() * 2)), 0, weak);
  others.push(...practice);
  if (!maint) {
    (input.refresh ?? [])
      .filter((it) => !used.has(it.id) && !cards[it.id])
      .forEach((it, i) => others.splice(Math.min(others.length, 1 + i * 3), 0, refreshTask(it, now, catalog, salt)));
  }
  const maintenance = [...rust, ...others];
  let fi = 0;
  let mi = 0;
  while (fi < fresh.length || mi < maintenance.length) {
    if (mi < maintenance.length) out.push(maintenance[mi++]);
    if (fi < fresh.length) {
      out.push(fresh[fi++], fresh[fi++]);
    }
    if (mi < maintenance.length) out.push(maintenance[mi++]);
  }
  return out;
}

function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

/** Display string for a target, e.g. for summaries. */
export function shortName(it: Item): string {
  return it.kind === "gram" ? it.name : it.kind === "noun" ? withoutArticle(it.de) : it.de;
}
