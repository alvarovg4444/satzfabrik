import type { Item } from "../content/types";

/** Lowercase, unify ß/quotes/dashes, strip punctuation, collapse whitespace. Keeps umlauts. */
export function norm(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[„“”"«»‚‘’']/g, "")
    .replace(/[.,!?;:()[\]{}…–—\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** norm() plus umlaut folding, for lenient matching (ä→a, ö→o, ü→u). */
export function fold(s: string): string {
  return norm(s).replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u");
}

/** Same sentence, ignoring case, punctuation and spacing. */
export function sameSentence(a: string, b: string): boolean {
  return norm(a) === norm(b);
}

const ARTICLE = /^(der|die|das|sich)\s+/i;

function stemOf(word: string): string {
  const w = fold(word);
  if (w.endsWith("eln") || w.endsWith("ern")) return w.slice(0, -1);
  if (w.endsWith("en")) return w.slice(0, -2);
  if (w.endsWith("n")) return w.slice(0, -1);
  return w;
}

function lastWord(s: string): string {
  const parts = s.trim().split(/\s+/);
  return parts[parts.length - 1] ?? "";
}

function firstWord(s: string): string {
  return s.trim().split(/\s+/)[0] ?? "";
}

/**
 * Surface strings whose presence (as a substring of the folded sentence)
 * suggests the learner used the item. Used only for a gentle "did you forget
 * the target?" hint before spending an AI call, never for grading.
 */
export function surfaceKeys(item: Item): string[] {
  const keys = new Set<string>();
  const add = (s: string | undefined | null, min = 3) => {
    if (!s) return;
    const f = fold(s);
    if (f.length >= min) keys.add(f);
  };
  for (const k of item.keys ?? []) add(k, 2);
  switch (item.kind) {
    case "noun": {
      // Substring matching: "kollege" also finds "Kollegen". (Dropping the -e would turn "Nichte" into "nicht".)
      add(item.lemma);
      add(item.plural);
      break;
    }
    case "verb": {
      const sep = item.sep ? fold(item.sep) : "";
      let base = fold(item.lemma);
      if (sep && base.startsWith(sep)) base = base.slice(sep.length);
      add(stemOf(base), 3);
      add(firstWord(item.pres.er), 3);
      add(firstWord(item.prat), 3);
      add(lastWord(item.perf), 4);
      add(item.lemma);
      break;
    }
    case "adj":
    case "adv":
    case "word": {
      const l = fold(item.lemma);
      add(l.length > 4 && l.endsWith("e") ? l.slice(0, -1) : l, 2);
      add(item.comp);
      if (item.sup) add(item.sup.replace(/^am\s+/i, ""));
      break;
    }
    case "expr":
    case "gram":
      break;
  }
  return [...keys];
}

/** True if the sentence seems to contain the item, or if we cannot tell. */
export function mentions(sentence: string, item: Item): boolean {
  const keys = surfaceKeys(item);
  if (keys.length === 0) return true;
  const hay = ` ${fold(sentence)} `;
  return keys.some((k) => (k.length <= 3 ? hay.includes(` ${k}`) : hay.includes(k)));
}

export function wordCount(s: string): number {
  const n = norm(s);
  return n ? n.split(" ").length : 0;
}

/** "der Termin" → "Termin" (display without article). */
export function withoutArticle(de: string): string {
  return de.replace(ARTICLE, "");
}

/**
 * Word-level diff between the learner's text and the correction, for highlighting.
 * Returns tokens marked same / removed (learner only) / added (correction only).
 */
export type DiffToken = { t: string; op: "same" | "del" | "add" };

export function diffWords(from: string, to: string): DiffToken[] {
  const a = from.trim().split(/\s+/).filter(Boolean);
  const b = to.trim().split(/\s+/).filter(Boolean);
  // Punctuation glued to a word does not count as a change; capitalisation does.
  const key = (w: string) => w.replace(/^[„“"'(]+|[.,!?;:„“"')]+$/g, "");
  const eq = (x: string, y: string) => key(x) === key(y);
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) {
      out.push({ t: b[j], op: "same" });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ t: a[i], op: "del" });
      i++;
    } else {
      out.push({ t: b[j], op: "add" });
      j++;
    }
  }
  while (i < n) out.push({ t: a[i++], op: "del" });
  while (j < m) out.push({ t: b[j++], op: "add" });
  return out;
}

/** Local calendar day key, e.g. "2026-10-26". */
export function dayKey(t: number): string {
  const d = new Date(t);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/** Whole days between two day keys (b - a). */
export function daysBetween(a: string, b: string): number {
  const pa = a.split("-").map(Number);
  const pb = b.split("-").map(Number);
  const ta = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const tb = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((tb - ta) / 86_400_000);
}

/** Deterministic small hash, for stable pseudo-random choices. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Seeded PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(arr: readonly T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length) % arr.length];
}

export function shuffle<T>(arr: readonly T[], r: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
