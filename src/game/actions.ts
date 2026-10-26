import type { GradeResult, TargetStatus } from "../ai/schema";
import type { Catalog } from "../content/catalog";
import { HALLS, type HallId, type Item, type TopicId } from "../content/types";
import { isDue, newCard, review, rustOf, stageOf } from "../engine/srs";
import type { Task } from "../engine/tasks";
import { dayKey, daysBetween, hash, wordCount } from "../engine/text";
import { ACHIEVEMENTS, type Achievement } from "./achievements";
import {
  comboCap,
  factoryRate,
  idleEarnings,
  levelOf,
  shiftBonus,
  taskReward,
  unlockCost,
} from "./economy";
import { dailyOrders, openChest, type ChestPrize, type Order } from "./orders";
import { emptyDay, type DayStat, type GameState } from "./state";
import { UPGRADE_BY_ID, upgradeCost, type UpgradeId } from "./upgrades";

/*
 * All state changes live here as mutations on a draft copy; the store clones
 * before calling them. Keeping them pure (no I/O, time passed in) makes them testable.
 */

export function today(s: GameState, now: number): DayStat {
  const k = dayKey(now);
  return (s.stats.days[k] ??= emptyDay());
}

function addTaler(s: GameState, now: number, n: number): void {
  s.taler += n;
  if (n > 0) {
    s.lifetimeTaler += n;
    today(s, now).taler += n;
  }
}

/** Credit idle production since the last tick. Returns what was added. */
export function tick(s: GameState, catalog: Catalog, now: number): { amount: number; hours: number; capped: boolean } {
  const earned = idleEarnings(s, catalog, now);
  if (earned.amount > 0) addTaler(s, now, earned.amount);
  s.lastTick = now;
  return earned;
}

export function hallUnlocked(s: GameState, hall: HallId): boolean {
  return levelOf(s.xp) >= HALLS[hall].unlockLevel;
}

export function ownedHalls(s: GameState, catalog: Catalog): HallId[] {
  const set = new Set<HallId>();
  for (const id of Object.keys(s.cards)) {
    const it = catalog.get(id);
    if (it) set.add(it.hall);
  }
  return [...set];
}

function ownedTopics(s: GameState, catalog: Catalog): TopicId[] {
  const set = new Set<TopicId>();
  for (const id of Object.keys(s.cards)) {
    const t = catalog.get(id)?.topic;
    if (t) set.add(t);
  }
  return [...set];
}

/** Once per calendar day: streak bookkeeping, fresh orders, cooling weak spots. */
export function rollover(s: GameState, catalog: Catalog, now: number): void {
  const day = dayKey(now);
  if (s.stats.heatDay !== day) {
    const gap = s.stats.heatDay ? Math.max(1, daysBetween(s.stats.heatDay, day)) : 1;
    const f = Math.pow(0.7, gap);
    for (const k of Object.keys(s.stats.ruleHeat)) {
      s.stats.ruleHeat[k] *= f;
      if (s.stats.ruleHeat[k] < 0.2) delete s.stats.ruleHeat[k];
    }
    s.stats.heatDay = day;
  }
  if (s.streak.lastDay && s.streak.current > 0) {
    const missed = daysBetween(s.streak.lastDay, day) - 1;
    if (missed > 0) {
      if (s.streak.freezes >= missed) {
        s.streak.freezes -= missed;
        // Frozen days count as kept: move the marker so the streak continues today.
        const d = new Date(now);
        d.setDate(d.getDate() - 1);
        s.streak.lastDay = dayKey(d.getTime());
      } else {
        s.streak.current = 0;
      }
    }
  }
  if (s.orders.day !== day) {
    s.orders = {
      day,
      chestClaimed: false,
      list: dailyOrders({
        day,
        rate: factoryRate(s, catalog, now),
        ownedHalls: ownedHalls(s, catalog),
        ownedTopics: ownedTopics(s, catalog),
        hasRepairs: Object.values(s.cards).some((c) => stageOf(c) > 0),
      }),
    };
  }
}

export type UnlockError = "owned" | "locked_hall" | "too_expensive";

export function canUnlock(s: GameState, it: Item): UnlockError | null {
  if (s.cards[it.id]) return "owned";
  if (!hallUnlocked(s, it.hall)) return "locked_hall";
  if (s.freeBlueprints <= 0 && s.taler < unlockCost(s, it)) return "too_expensive";
  return null;
}

export function unlock(s: GameState, it: Item, now: number, opts: { free?: boolean } = {}): UnlockError | null {
  if (s.cards[it.id]) return "owned";
  if (!opts.free) {
    const err = canUnlock(s, it);
    if (err) return err;
    if (s.freeBlueprints > 0) s.freeBlueprints--;
    else s.taler -= unlockCost(s, it);
  }
  s.cards[it.id] = newCard(it.id, now);
  return null;
}

export function buyUpgrade(s: GameState, id: UpgradeId): boolean {
  const def = UPGRADE_BY_ID.get(id);
  if (!def) return false;
  const lvl = s.upgrades[id] ?? 0;
  if (lvl >= def.max) return false;
  const cost = upgradeCost(def, lvl);
  if (s.taler < cost) return false;
  s.taler -= cost;
  s.upgrades[id] = lvl + 1;
  return true;
}

export interface TaskEvents {
  taler: number;
  xp: number;
  combo: number;
  comboBroken: boolean;
  built: string[];
  repaired: string[];
  stageUps: { id: string; from: number; to: number }[];
  orders: Order[];
  achievements: Achievement[];
  levelUp: number | null;
  streakUp: boolean;
  success: boolean;
}

const SUCCESS: TargetStatus[] = ["correct", "flawed"];

function addXp(s: GameState, n: number): number | null {
  const before = levelOf(s.xp);
  s.xp += n;
  const after = levelOf(s.xp);
  if (after > before) {
    s.freeBlueprints += after - before;
    return after;
  }
  return null;
}

function progressOrders(s: GameState, apply: (o: Order) => number, now: number): Order[] {
  const done: Order[] = [];
  for (const o of s.orders.list) {
    if (o.done) continue;
    const p = apply(o);
    if (p <= 0) continue;
    o.progress = Math.min(o.goal, o.progress + p);
    if (o.progress >= o.goal) {
      o.done = true;
      addTaler(s, now, o.reward);
      addXp(s, 40);
      done.push(o);
    }
  }
  return done;
}

function checkAchievements(s: GameState, catalog: Catalog, now: number): Achievement[] {
  const got: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (s.achievements[a.id]) continue;
    if (a.test(s, catalog, now)) {
      s.achievements[a.id] = now;
      addTaler(s, now, a.reward);
      got.push(a);
    }
  }
  return got;
}

function updateStreak(s: GameState, now: number): boolean {
  const day = dayKey(now);
  if (s.streak.lastDay === day) return false;
  if (today(s, now).tasks < s.settings.dailyGoal) return false;
  const continues = s.streak.lastDay && daysBetween(s.streak.lastDay, day) === 1;
  s.streak.current = continues ? s.streak.current + 1 : 1;
  s.streak.best = Math.max(s.streak.best, s.streak.current);
  s.streak.lastDay = day;
  return true;
}

/** Apply one graded answer: schedule, stats, rewards, orders, achievements. */
export function applyGrade(
  s: GameState,
  catalog: Catalog,
  task: Task,
  grade: GradeResult,
  answer: string,
  now: number,
  opts: { gaveUp?: boolean } = {},
): TaskEvents {
  const rate = factoryRate(s, catalog, now);
  const day = today(s, now);
  const statuses = grade.targets.map((t) => t.status);
  const success = statuses.length > 0 && statuses.every((st) => SUCCESS.includes(st));
  const perfect = grade.quality === "perfect" && success;
  const sentence = grade.corrected || answer;

  const built: string[] = [];
  const repaired: string[] = [];
  const stageUps: TaskEvents["stageUps"] = [];
  let rustSum = 0;
  let xp = 5;
  for (const t of grade.targets) {
    const card = s.cards[t.id];
    if (!card) continue;
    const wasDue = isDue(card, now);
    rustSum += rustOf(card, now);
    const res = review(card, t.status, { now, sentence });
    s.cards[t.id] = res.card;
    if (SUCCESS.includes(t.status)) {
      xp += 10;
      if (res.stageBefore === 0 && res.stageAfter > 0) built.push(t.id);
      else if (wasDue) repaired.push(t.id);
      if (res.stageAfter > res.stageBefore && res.stageBefore > 0) {
        stageUps.push({ id: t.id, from: res.stageBefore, to: res.stageAfter });
      }
    }
  }

  // Stats
  if (!opts.gaveUp) {
    day.tasks++;
    s.stats.sentences++;
  }
  if (success) day.good++;
  if (perfect) {
    day.perfect++;
    s.stats.perfect++;
  }
  day.built += built.length;
  day.repaired += repaired.length;
  for (const e of grade.errors) {
    day.errors[e.type] = (day.errors[e.type] ?? 0) + 1;
    s.stats.errors[e.type] = (s.stats.errors[e.type] ?? 0) + 1;
    if (e.rule && catalog.get(e.rule)) s.stats.ruleHeat[e.rule] = (s.stats.ruleHeat[e.rule] ?? 0) + 1;
  }
  for (const t of grade.targets) {
    const it = catalog.get(t.id);
    if (it?.kind === "gram" && !SUCCESS.includes(t.status)) {
      s.stats.ruleHeat[t.id] = (s.stats.ruleHeat[t.id] ?? 0) + 1;
    }
  }

  // Combo and reward
  const comboBefore = s.combo;
  const taler = taskReward(s, rate, {
    type: task.type,
    quality: grade.quality,
    statuses,
    words: wordCount(answer),
    rust: grade.targets.length ? rustSum / grade.targets.length : 0,
  });
  addTaler(s, now, taler);
  if (success) {
    s.combo = Math.min(comboCap(s), Math.round((s.combo + 0.1) * 10) / 10);
    s.bestCombo = Math.max(s.bestCombo, s.combo);
  } else {
    s.combo = 1;
  }
  const levelUp = addXp(s, xp);

  // Journal (only real attempts)
  if (!opts.gaveUp) s.journal.unshift({
    t: now,
    type: task.type,
    targets: task.targets,
    prompt: task.source ?? task.scenario?.de ?? task.instruction,
    answer,
    corrected: grade.corrected || answer,
    better: grade.better || undefined,
    quality: grade.quality,
    errors: grade.errors.map((e) => ({ type: e.type, wrong: e.wrong, right: e.right, explain: e.explain })),
  });
  if (s.journal.length > 300) s.journal.length = 300;

  // Orders
  const words = wordCount(answer);
  const orders = progressOrders(
    s,
    (o) => {
      switch (o.kind) {
        case "good_sentences":
          return success ? 1 : 0;
        case "perfect_sentences":
          return perfect ? 1 : 0;
        case "long_sentence":
          return perfect && words >= 12 ? 1 : 0;
        case "build":
          return built.length;
        case "repair":
          return repaired.length;
        case "hall_targets":
          return grade.targets.filter((t) => SUCCESS.includes(t.status) && catalog.get(t.id)?.hall === o.hall).length;
        case "topic_targets":
          return grade.targets.filter((t) => SUCCESS.includes(t.status) && catalog.get(t.id)?.topic === o.topic).length;
        default:
          return 0;
      }
    },
    now,
  );

  const streakUp = updateStreak(s, now);
  const achievements = checkAchievements(s, catalog, now);
  s.updatedAt = now;
  return {
    taler,
    xp,
    combo: s.combo,
    comboBroken: !success && comboBefore > 1,
    built,
    repaired,
    stageUps,
    orders,
    achievements,
    levelUp,
    streakUp,
    success,
  };
}

/** The learner fixed their own sentence after feedback: a bonus, no schedule change. */
export function applyRework(s: GameState, now: number, previousReward: number, fixed: string): number {
  const bonus = Math.max(1, Math.round(previousReward * 0.4));
  addTaler(s, now, bonus);
  if (s.journal[0]) s.journal[0].corrected = fixed;
  addXp(s, 3);
  s.updatedAt = now;
  return bonus;
}

export function finishShift(s: GameState, catalog: Catalog, now: number): { bonus: number; orders: Order[]; achievements: Achievement[] } {
  const bonus = shiftBonus(s, factoryRate(s, catalog, now));
  addTaler(s, now, bonus);
  s.stats.shifts++;
  today(s, now).shifts++;
  addXp(s, 30);
  const orders = progressOrders(s, (o) => (o.kind === "shifts" ? 1 : 0), now);
  const achievements = checkAchievements(s, catalog, now);
  s.updatedAt = now;
  return { bonus, orders, achievements };
}

export function applyDrill(
  s: GameState,
  catalog: Catalog,
  now: number,
  r: { correct: number; total: number; earned: number },
): { orders: Order[]; achievements: Achievement[] } {
  addTaler(s, now, r.earned);
  const day = today(s, now);
  day.drills += r.total;
  day.drillOk += r.correct;
  s.stats.drillOk += r.correct;
  addXp(s, r.correct * 2);
  const orders = progressOrders(s, (o) => (o.kind === "drill" && r.correct >= o.goal ? o.goal : 0), now);
  const achievements = checkAchievements(s, catalog, now);
  s.updatedAt = now;
  return { orders, achievements };
}

export function chestReady(s: GameState): boolean {
  return s.orders.list.length > 0 && !s.orders.chestClaimed && s.orders.list.every((o) => o.done);
}

export function claimChest(s: GameState, catalog: Catalog, now: number): ChestPrize | null {
  if (!chestReady(s)) return null;
  const prize = openChest(hash(`chest:${s.orders.day}:${s.createdAt}`), factoryRate(s, catalog, now));
  s.orders.chestClaimed = true;
  if (prize.kind === "taler") addTaler(s, now, prize.amount);
  if (prize.kind === "freeze") s.streak.freezes++;
  if (prize.kind === "blueprint") s.freeBlueprints++;
  s.updatedAt = now;
  return prize;
}

/** Grammar ids with recent mistakes, hottest first. */
export function weakRules(s: GameState): string[] {
  return Object.entries(s.stats.ruleHeat)
    .filter(([, h]) => h >= 1)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

/** Free starter blueprints, introduced in the given order. */
export function grantStarter(s: GameState, items: Item[], now: number): void {
  items.forEach((it, i) => {
    if (!s.cards[it.id]) s.cards[it.id] = newCard(it.id, now + i);
  });
}
