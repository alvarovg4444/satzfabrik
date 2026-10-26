import type { ExplainLang } from "../ai/prompts";
import type { AISettings } from "../ai/providers";
import type { ErrorType, Item } from "../content/types";
import { newLevelState, type LevelState } from "../engine/level";
import type { CardState } from "../engine/srs";
import type { TaskType } from "../engine/tasks";
import type { Order } from "./orders";
import type { UpgradeId } from "./upgrades";

export interface Settings {
  explainLang: ExplainLang;
  /** Show the English line under German situations. */
  showEnglish: boolean;
  /** Careful corrector: slower, more thorough model tier. */
  careful: boolean;
  /** Production tasks per day that count as a streak day. */
  dailyGoal: number;
  /** At most this many new machines are built per day (like Anki's new cards per day). */
  newPerDay: number;
  /** The level engine delivers that many fitting blueprints every day, free. */
  autoDeliver: boolean;
  /** Mix A1 basics back into shifts now and then. */
  refresh: boolean;
  shiftSize: number;
  sound: boolean;
  /** Read corrected sentences aloud automatically. */
  autoSpeak: boolean;
  speechRate: number;
  /** Let the AI write fresh situations for each shift. */
  freshTasks: boolean;
  ai: AISettings;
}

export interface DayStat {
  tasks: number;
  /** Tasks where every target was used correctly. */
  good: number;
  perfect: number;
  drills: number;
  drillOk: number;
  taler: number;
  shifts: number;
  built: number;
  repaired: number;
  errors: Partial<Record<ErrorType, number>>;
}

export interface JournalEntry {
  t: number;
  type: TaskType;
  targets: string[];
  prompt: string;
  answer: string;
  corrected: string;
  better?: string;
  quality: "perfect" | "minor" | "major";
  errors: { type: ErrorType; wrong: string; right: string; explain: string }[];
}

export interface GameState {
  v: 1;
  createdAt: number;
  updatedAt: number;
  onboarded: boolean;
  taler: number;
  lifetimeTaler: number;
  xp: number;
  /** Last time idle production was credited. */
  lastTick: number;
  upgrades: Partial<Record<UpgradeId, number>>;
  cards: Record<string, CardState>;
  /** Items the learner imported (Anki CSV). */
  custom: Item[];
  combo: number;
  bestCombo: number;
  /** Blueprints that can be unlocked for free (from chests and level-ups). */
  freeBlueprints: number;
  stats: {
    days: Record<string, DayStat>;
    errors: Partial<Record<ErrorType, number>>;
    /** Recent mistakes per grammar id, decayed daily; drives weak-spot tasks. */
    ruleHeat: Record<string, number>;
    heatDay?: string;
    sentences: number;
    perfect: number;
    drillOk: number;
    shifts: number;
  };
  streak: { current: number; best: number; lastDay?: string; freezes: number };
  orders: { day: string; list: Order[]; chestClaimed: boolean };
  achievements: Record<string, number>;
  journal: JournalEntry[];
  settings: Settings;
  /** The learner's estimated CEFR level, from their own answers. */
  level: LevelState;
  /** Blueprints the level engine delivered today: how many were free, what the rest cost. */
  delivery?: { day: string; ids: string[]; free: number; paid: number };
}

export const DEFAULT_SETTINGS: Settings = {
  explainLang: "en",
  showEnglish: true,
  careful: false,
  dailyGoal: 20,
  newPerDay: 10,
  autoDeliver: true,
  refresh: true,
  shiftSize: 10,
  sound: true,
  autoSpeak: false,
  speechRate: 0.95,
  freshTasks: true,
  ai: {
    preferred: "auto",
    anthropicKey: "",
    anthropicModel: "claude-opus-5-5",
    openaiBase: "http://localhost:11434/v1",
    openaiModel: "",
    openaiKey: "",
  },
};

export const START_TALER = 300;

export function newGame(now: number): GameState {
  return {
    v: 1,
    createdAt: now,
    updatedAt: now,
    onboarded: false,
    taler: START_TALER,
    lifetimeTaler: 0,
    xp: 0,
    lastTick: now,
    upgrades: {},
    cards: {},
    custom: [],
    combo: 1,
    bestCombo: 1,
    freeBlueprints: 0,
    stats: { days: {}, errors: {}, ruleHeat: {}, sentences: 0, perfect: 0, drillOk: 0, shifts: 0 },
    streak: { current: 0, best: 0, freezes: 0 },
    orders: { day: "", list: [], chestClaimed: false },
    achievements: {},
    journal: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    level: newLevelState(),
  };
}

export function emptyDay(): DayStat {
  return { tasks: 0, good: 0, perfect: 0, drills: 0, drillOk: 0, taler: 0, shifts: 0, built: 0, repaired: 0, errors: {} };
}

/** Fill in fields added in later versions so old saves keep working. */
export function migrate(raw: unknown, now: number): GameState {
  const base = newGame(now);
  if (!raw || typeof raw !== "object") return base;
  const s = raw as Partial<GameState>;
  return {
    ...base,
    ...s,
    stats: { ...base.stats, ...(s.stats ?? {}) },
    streak: { ...base.streak, ...(s.streak ?? {}) },
    orders: { ...base.orders, ...(s.orders ?? {}) },
    settings: {
      ...base.settings,
      ...(s.settings ?? {}),
      ai: { ...base.settings.ai, ...(s.settings?.ai ?? {}) },
    },
    level: s.level
      ? { ...base.level, ...s.level, areas: { ...base.level.areas, ...(s.level.areas ?? {}) }, ai: { ...base.level.ai, ...(s.level.ai ?? {}) } }
      : base.level,
    v: 1,
  };
}
