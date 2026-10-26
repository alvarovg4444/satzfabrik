import { useSyncExternalStore } from "react";
import { OFFLINE, resolveProvider, type AIProvider } from "../ai/providers";
import { makeCatalog, type Catalog } from "../content/catalog";
import { rollover, tick } from "../game/actions";
import { migrate, newGame, type GameState } from "../game/state";
import { CloudSave, loadLocal, saveLocal } from "./persist";

/**
 * A tiny external store: the whole game is one immutable GameState object.
 * `update` clones, applies a mutation from game/actions, persists (debounced).
 */

type Listener = () => void;

export interface Welcome {
  amount: number;
  hours: number;
  capped: boolean;
}

interface Meta {
  provider: AIProvider;
  providerReady: boolean;
  cloud: "connecting" | "on" | "off";
  welcome: Welcome | null;
}

let state: GameState = newGame(Date.now());
let catalog: Catalog = makeCatalog([]);
let meta: Meta = { provider: OFFLINE, providerReady: false, cloud: "connecting", welcome: null };
let cloud: CloudSave | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

let localTimer: ReturnType<typeof setTimeout> | undefined;
let cloudTimer: ReturnType<typeof setTimeout> | undefined;

function schedulePersist(toCloud = true) {
  clearTimeout(localTimer);
  localTimer = setTimeout(() => saveLocal(state), 800);
  if (cloud && toCloud) {
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(() => void cloud?.save(state).catch(() => setMeta({ cloud: "off" })), 4000);
  }
}

export function flush() {
  clearTimeout(localTimer);
  saveLocal(state);
  if (cloud) {
    clearTimeout(cloudTimer);
    void cloud.save(state).catch(() => undefined);
  }
}

function setMeta(p: Partial<Meta>) {
  meta = { ...meta, ...p };
  emit();
}

export const store = {
  get: () => state,
  catalog: () => catalog,
  meta: () => meta,
  /**
   * Clone, mutate, publish. Returns whatever the mutation returns.
   * `quiet` updates (the idle ticker) are saved locally only; the cloud save
   * follows real actions and closing the page.
   */
  update<R>(fn: (draft: GameState, catalog: Catalog) => R, opts: { quiet?: boolean } = {}): R {
    const draft = structuredClone(state);
    const customBefore = JSON.stringify(state.custom);
    const r = fn(draft, catalog);
    if (!opts.quiet) draft.updatedAt = Math.max(draft.updatedAt, Date.now());
    state = draft;
    if (JSON.stringify(draft.custom) !== customBefore) catalog = makeCatalog(draft.custom);
    schedulePersist(!opts.quiet);
    emit();
    return r;
  },
  /** Replace the whole save (import, reset, cloud restore). */
  replace(next: GameState) {
    state = next;
    catalog = makeCatalog(next.custom);
    schedulePersist();
    emit();
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  dismissWelcome() {
    setMeta({ welcome: null });
  },
  async refreshProvider() {
    const provider = await resolveProvider(state.settings.ai);
    setMeta({ provider, providerReady: true });
  },
};

export function useGame(): GameState {
  return useSyncExternalStore(store.subscribe, store.get);
}

export function useCatalog(): Catalog {
  useSyncExternalStore(store.subscribe, store.get);
  return catalog;
}

export function useMeta(): Meta {
  return useSyncExternalStore(store.subscribe, store.meta);
}

const WELCOME_MIN_MS = 10 * 60_000;

function creditIdle(now: number) {
  const away = now - state.lastTick;
  const earned = store.update((d, c) => {
    const e = tick(d, c, now);
    rollover(d, c, now);
    return e;
  });
  if (away > WELCOME_MIN_MS && earned.amount >= 1) setMeta({ welcome: earned });
}

/** Start: local save first (instant), then cloud save and the AI corrector in the background. */
export async function boot(hotData?: { game?: unknown }) {
  const now = Date.now();
  const local = loadLocal(now);
  const hot = hotData?.game ? migrate(hotData.game, now) : null;
  const start = [local, hot].filter((x): x is GameState => !!x).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (start) {
    state = start;
    catalog = makeCatalog(start.custom);
  }
  creditIdle(now);
  void store.refreshProvider();

  cloud = await CloudSave.connect();
  if (!cloud) {
    setMeta({ cloud: "off" });
    return;
  }
  try {
    const remote = await cloud.load(Date.now());
    if (remote && remote.updatedAt > state.updatedAt) {
      // Keep API keys from this browser; they are never stored in the cloud.
      remote.settings.ai.anthropicKey = state.settings.ai.anthropicKey;
      remote.settings.ai.openaiKey = state.settings.ai.openaiKey;
      state = remote;
      catalog = makeCatalog(remote.custom);
      saveLocal(state);
      emit();
      creditIdle(Date.now());
    } else {
      await cloud.save(state);
    }
    setMeta({ cloud: "on" });
  } catch {
    setMeta({ cloud: "off" });
  }
}

/** Idle production while the app is open. */
export function startTicker(): () => void {
  const id = setInterval(() => {
    store.update(
      (d, c) => {
        tick(d, c, Date.now());
        rollover(d, c, Date.now());
      },
      { quiet: true },
    );
  }, 5000);
  const onHide = () => {
    if (document.visibilityState === "hidden") flush();
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", flush);
  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", flush);
  };
}
