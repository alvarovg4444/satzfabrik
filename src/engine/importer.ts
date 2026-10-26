import type { Gender, Item, Level, NounItem, VerbItem, WordItem, ExprItem } from "../content/types";
import { fold } from "./text";

/**
 * Import vocabulary from an Anki export ("Notes in Plain Text", tab separated)
 * or any CSV/TSV with a German column and a meaning column. Understands the
 * Goethe word-list style: "der Termin, -e", "die Stadt, ¨-e",
 * "anrufen, ruft an, rief an, hat angerufen".
 */

export interface ImportResult {
  items: Item[];
  skipped: number;
  duplicates: number;
}

function clean(s: string): string {
  return s
    .replace(/\[sound:[^\]]*\]/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function splitLine(line: string): string[] {
  if (line.includes("\t")) return line.split("\t");
  if (line.includes(";")) return line.split(";");
  // simple CSV with optional quotes
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function germanScore(s: string): number {
  let n = 0;
  if (/^(der|die|das)\s/i.test(s)) n += 3;
  if (/[äöüß]/i.test(s)) n += 2;
  if (/\b(sich|ein|eine|nicht|und|mit|zu)\b/i.test(s)) n += 1;
  if (/(en|ung|keit|heit|lich|isch)\b/.test(s)) n += 1;
  if (/\b(the|to|a|an|of)\b/i.test(s)) n -= 2;
  return n;
}

const UMLAUT: Record<string, string> = { a: "ä", o: "ö", u: "ü", A: "Ä", O: "Ö", U: "Ü" };

function umlautLast(word: string): string {
  const i = word.search(/au(?!.*[aou])/i);
  if (i >= 0) return word.slice(0, i) + (word[i] === "A" ? "Äu" : "äu") + word.slice(i + 2);
  for (let k = word.length - 1; k >= 0; k--) {
    if (UMLAUT[word[k]]) return word.slice(0, k) + UMLAUT[word[k]] + word.slice(k + 1);
  }
  return word;
}

/** "Termin" + "-e" → "Termine"; "Stadt" + "¨-e" → "Städte"; "Lehrer" + "-" → "Lehrer". */
export function pluralFrom(lemma: string, spec: string): string | null {
  const t = spec.trim().replace(/^die\s+/i, "");
  if (!t || /^(nur sg|sg\.|kein pl|-$)/i.test(t)) return /^-$/.test(t) ? lemma : null;
  if (/^[¨"]?-/.test(t)) {
    const uml = /^[¨"]/.test(t);
    const suffix = t.replace(/^[¨"]?-/, "");
    return (uml ? umlautLast(lemma) : lemma) + suffix;
  }
  if (/^[A-ZÄÖÜ]/.test(t)) return t.split(/[\s,(]/)[0];
  return null;
}

function slug(s: string): string {
  return fold(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function levelFrom(tags: string): Level {
  const m = tags.match(/\b(A1|A2|B1|B2)\b/i);
  return (m ? m[1].toUpperCase() : "B1") as Level;
}

export function parseGerman(de: string, en: string, level: Level): Item | null {
  const example = { de: "", en: "" };
  const noun = de.match(/^(der|die|das)\s+([A-ZÄÖÜ][^\s,]*)(?:\s*,\s*(.+))?$/);
  if (noun) {
    const gender: Gender = noun[1].toLowerCase() === "der" ? "m" : noun[1].toLowerCase() === "die" ? "f" : "n";
    const lemma = noun[2];
    const item: NounItem = {
      id: `c.${slug(lemma)}`,
      kind: "noun",
      hall: "woerter",
      level,
      de: `${noun[1].toLowerCase()} ${lemma}`,
      en,
      lemma,
      gender,
      plural: noun[3] ? pluralFrom(lemma, noun[3]) : null,
      example,
    };
    return item;
  }
  const parts = de.split(",").map((p) => p.trim()).filter(Boolean);
  const inf = parts[0] ?? "";
  const reflexive = /^sich\s+/i.test(inf);
  const bare = inf.replace(/^sich\s+/i, "");
  if (parts.length >= 4 && /^[a-zäöüß]+(en|ern|eln|n)$/.test(bare) && /^(hat|ist)\s/.test(parts[3])) {
    const pres = parts[1].replace(/^(er|sie|es)\s+/, "");
    const sep = pres.includes(" ") ? pres.split(" ").pop() : undefined;
    const item: VerbItem = {
      id: `c.${slug(inf)}`,
      kind: "verb",
      hall: "verben",
      level,
      de: inf,
      en,
      lemma: bare,
      pres: { du: pres.replace(/t(\s|$)/, "st$1"), er: pres },
      prat: parts[2].replace(/^(er|sie|es)\s+/, ""),
      perf: parts[3].replace(/^(er|sie|es)\s+/, ""),
      ...(sep ? { sep } : {}),
      ...(reflexive ? { refl: "akk" as const } : {}),
      example,
    };
    return item;
  }
  if (de.split(" ").length >= 3) {
    const item: ExprItem = {
      id: `c.${slug(de)}`,
      kind: "expr",
      hall: "redemittel",
      level,
      de,
      en,
      use: "",
      example,
      keys: [fold(de.split(" ").slice(0, 3).join(" ").replace(/[.,!?…]/g, ""))],
    };
    return item;
  }
  if (!de) return null;
  const item: WordItem = {
    id: `c.${slug(de)}`,
    kind: "word",
    hall: "woerter",
    level,
    de,
    en,
    lemma: de.replace(/^sich\s+/i, ""),
    example,
  };
  return item;
}

export function importText(text: string, existing: Item[]): ImportResult {
  const known = new Set(existing.map((i) => fold(i.kind === "noun" || i.kind === "verb" || i.kind === "adj" || i.kind === "adv" || i.kind === "word" ? i.lemma : i.de)));
  const ids = new Set(existing.map((i) => i.id));
  const items: Item[] = [];
  let skipped = 0;
  let duplicates = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const cols = splitLine(line).map(clean).filter((c, i) => c || i < 2);
    if (cols.length < 2 || !cols[0] || !cols[1]) {
      skipped++;
      continue;
    }
    const [a, b] = cols;
    const deFirst = germanScore(a) >= germanScore(b);
    const de = deFirst ? a : b;
    const en = deFirst ? b : a;
    const it = parseGerman(de, en, levelFrom(cols.slice(2).join(" ")));
    if (!it) {
      skipped++;
      continue;
    }
    const key = fold(it.kind === "noun" || it.kind === "verb" || it.kind === "word" ? it.lemma : it.de);
    if (known.has(key) || ids.has(it.id)) {
      duplicates++;
      continue;
    }
    known.add(key);
    ids.add(it.id);
    items.push(it);
  }
  return { items, skipped, duplicates };
}
