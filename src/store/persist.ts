import { migrate, type GameState } from "../game/state";

/**
 * Two layers:
 * - Browser storage: instant start, works everywhere (also outside claude.ai).
 * - claude.ai cloud save (artifact `db`): private per person, syncs phone and laptop.
 * The save with the newest `updatedAt` wins on load.
 */

const LOCAL_KEY = "satzfabrik.save.v1";

export function loadLocal(now: number): GameState | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? migrate(JSON.parse(raw), now) : null;
  } catch {
    return null;
  }
}

export function saveLocal(s: GameState): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked: the cloud save still works */
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
  }
}

// --- claude.ai db ---------------------------------------------------------

interface DocSnap {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface DocRef {
  get(): Promise<DocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
}
interface DB {
  doc(path: string): DocRef;
}
interface UserNS {
  id(): Promise<string | null>;
}

/**
 * The save is split into documents under 256 KiB each: main (everything small),
 * cards-0..3 (learning state by id hash), custom-0..7 (imported words, 400 per
 * document) and journal (last 200 sentences).
 */
const CARD_SHARDS = 4;
const CUSTOM_SHARDS = 8;
const CUSTOM_PER_SHARD = 400;

function shardOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % CARD_SHARDS;
}

export type Docs = Record<string, Record<string, unknown>>;

/** Most imported words the cloud save can hold. */
export const MAX_CUSTOM = 8 * 400;

/** Exported for tests. */
export function split(s: GameState): Docs {
  const { cards, custom, journal, ...main } = s;
  // API keys never leave the browser.
  const safeMain = { ...main, settings: { ...main.settings, ai: { ...main.settings.ai, anthropicKey: "", openaiKey: "" } } };
  const shards: Record<string, unknown>[] = Array.from({ length: CARD_SHARDS }, () => ({}));
  for (const [id, c] of Object.entries(cards)) shards[shardOf(id)][id] = c;
  const docs: Docs = {
    main: { json: JSON.stringify(safeMain), updatedAt: s.updatedAt },
    journal: { json: JSON.stringify(journal.slice(0, 200)) },
  };
  shards.forEach((sh, i) => (docs[`cards-${i}`] = { json: JSON.stringify(sh) }));
  for (let i = 0; i < CUSTOM_SHARDS; i++) {
    docs[`custom-${i}`] = { json: JSON.stringify(custom.slice(i * CUSTOM_PER_SHARD, (i + 1) * CUSTOM_PER_SHARD)) };
  }
  return docs;
}

export function join(docs: Partial<Docs>, now: number): GameState | null {
  const main = docs.main?.json;
  if (typeof main !== "string") return null;
  const parsed = JSON.parse(main) as Record<string, unknown>;
  const cards: Record<string, unknown> = {};
  for (let i = 0; i < CARD_SHARDS; i++) {
    const j = docs[`cards-${i}`]?.json;
    if (typeof j === "string") Object.assign(cards, JSON.parse(j));
  }
  const custom: unknown[] = [];
  for (let i = 0; i < CUSTOM_SHARDS; i++) {
    const j = docs[`custom-${i}`]?.json;
    if (typeof j === "string") custom.push(...(JSON.parse(j) as unknown[]));
  }
  const journal = typeof docs.journal?.json === "string" ? JSON.parse(docs.journal.json as string) : [];
  return migrate({ ...parsed, cards, custom, journal }, now);
}

export class CloudSave {
  private last: Record<string, string> = {};
  private writing: Promise<void> = Promise.resolve();

  private constructor(
    private db: DB,
    private base: string,
  ) {}

  /** Connects when running on claude.ai with a signed-in viewer; otherwise null. */
  static async connect(): Promise<CloudSave | null> {
    if (typeof window === "undefined" || typeof window.claude?.use !== "function") return null;
    try {
      const [db, user] = (await Promise.all([window.claude.use("db"), window.claude.use("user")])) as [DB | null, UserNS | null];
      if (!db || !user) return null;
      const uid = await user.id();
      if (!uid) return null;
      return new CloudSave(db, `data/users/${uid}`);
    } catch {
      return null;
    }
  }

  async load(now: number): Promise<GameState | null> {
    const names = [
      "main",
      "journal",
      ...Array.from({ length: CARD_SHARDS }, (_, i) => `cards-${i}`),
      ...Array.from({ length: CUSTOM_SHARDS }, (_, i) => `custom-${i}`),
    ];
    const snaps = await Promise.all(names.map((n) => this.db.doc(`${this.base}/${n}`).get()));
    const docs: Partial<Docs> = {};
    snaps.forEach((snap, i) => {
      const d = snap.exists ? snap.data() : undefined;
      if (d) {
        docs[names[i]] = d;
        this.last[names[i]] = JSON.stringify(d);
      }
    });
    return join(docs, now);
  }

  /** Writes only documents that changed, one at a time. */
  save(s: GameState): Promise<void> {
    const docs = split(s);
    this.writing = this.writing.then(async () => {
      for (const [name, body] of Object.entries(docs)) {
        const ser = JSON.stringify(body);
        if (this.last[name] === ser) continue;
        await this.db.doc(`${this.base}/${name}`).set(body);
        this.last[name] = ser;
      }
    });
    return this.writing;
  }
}
