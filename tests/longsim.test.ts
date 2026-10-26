import { describe, expect, it } from "vitest";
import type { GradeResult } from "../src/ai/schema";
import { makeCatalog } from "../src/content/catalog";
import { buildShift } from "../src/engine/tasks";
import { dayKey, rng } from "../src/engine/text";
import { applyGrade, buyUpgrade, chestReady, claimChest, finishShift, rollover, tick, unlock, weakRules } from "../src/game/actions";
import { factoryRate, perSentence } from "../src/game/economy";
import { starterItems } from "../src/game/starter";
import { newGame, type GameState } from "../src/game/state";
import { BUILDINGS, UPGRADES, upgradeCost, type UpgradeId } from "../src/game/upgrades";

/*
 * Two years of play for three kinds of learner, to see when the factory runs out of
 * new things. Slow: run with SIM_LONG=1 npx vitest run tests/longsim.test.ts
 * (add SIM_LOG=1 for a monthly log).
 */

export interface Profile {
  name: string;
  /** Days with practice per week. */
  days: number;
  /** Shifts of 10 tasks per practice day. */
  shifts: number;
  /** Times the app is opened per day (idle earnings are collected each time). */
  visits: number;
}

export const PROFILES: Profile[] = [
  { name: "light", days: 4, shifts: 1, visits: 1 },
  { name: "typical", days: 6, shifts: 2, visits: 2 },
  { name: "heavy", days: 7, shifts: 3, visits: 3 },
];

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Visible milestones: a building, a new kind of upgrade, an HQ floor, a bigger tool shed. */
export function isMilestone(id: UpgradeId, lvl: number): boolean {
  if ((BUILDINGS as string[]).includes(id)) return true;
  const def = UPGRADES.find((u) => u.id === id);
  if (lvl === 1) return true;
  if (def?.tiers?.includes(lvl)) return true;
  // every HQ floor, every star on the roof or on a hall sign
  return id === "verwaltung" || id === "meisterbrief" || id === "export" || id.startsWith("halle_");
}

export interface SimResult {
  profile: Profile;
  /** Day (1-based) of each milestone. */
  milestones: { day: number; what: string }[];
  /** Purchases per day. */
  purchases: number[];
  /** Share of all upgrade levels bought, per day. */
  completion: number[];
  /** Share of the day's income that came from idle production. */
  idleShare: number[];
  /** Day each level of each building was bought. */
  buildingDays: Record<string, number[]>;
  maxedDay: number | null;
  log: string[];
}

function totalLevels(): number {
  return UPGRADES.reduce((n, u) => n + u.max, 0);
}

function boughtLevels(s: GameState): number {
  return UPGRADES.reduce((n, u) => n + Math.min(u.max, s.upgrades[u.id] ?? 0), 0);
}

export function simulate(profile: Profile, days: number, seed = 7): SimResult {
  const catalog = makeCatalog([]);
  const r = rng(seed);
  const start = new Date("2026-11-02T00:00:00").getTime();
  let now = start + 8 * HOUR;
  const s = newGame(now);
  for (const it of starterItems(catalog, ["arbeit", "wohnen", "alltag"])) unlock(s, it, now);
  s.onboarded = true;
  const res: SimResult = { profile, milestones: [], purchases: [], completion: [], idleShare: [], buildingDays: {}, maxedDay: null, log: [] };
  const total = totalLevels();
  for (let day = 0; day < days; day++) {
    const active = day % 7 < profile.days;
    let bought = 0;
    let idle = 0;
    const earnedBefore = s.lifetimeTaler;
    for (let v = 0; v < profile.visits; v++) {
      now = start + day * DAY + (8 + (v * 12) / Math.max(1, profile.visits)) * HOUR;
      idle += tick(s, catalog, now).amount;
      rollover(s, catalog, now);
      const shifts = active ? Math.floor(profile.shifts / profile.visits) + (v < profile.shifts % profile.visits ? 1 : 0) : 0;
      for (let k = 0; k < shifts; k++) {
        const tasks = buildShift({
          cards: s.cards,
          catalog,
          now,
          weakRules: weakRules(s),
          size: 10,
          maxNew: Math.max(0, Math.min(6, 10 - (s.stats.days[dayKey(now)]?.built ?? 0))),
        });
        for (const t of tasks) {
          if (t.type === "intro") continue;
          const ok = r() < 0.8;
          const grade: GradeResult = {
            targets: t.targets.map((id) => ({ id, status: ok ? "correct" : r() < 0.5 ? "flawed" : "wrong", comment: "" })),
            quality: ok ? (r() < 0.5 ? "perfect" : "minor") : "major",
            corrected: "x",
            better: "",
            errors: [],
            praise: "",
            tip: "",
            source: "ai",
            by: "sim",
          };
          applyGrade(s, catalog, t, grade, "Das ist ein ganz normaler Satz mit neun Wörtern.", now);
          now += 60_000;
        }
        if (tasks.length) finishShift(s, catalog, now);
      }
      if (chestReady(s)) claimChest(s, catalog, now);
      // Spend like a completionist: the cheapest thing that is affordable, again and again.
      for (let k = 0; k < 200; k++) {
        const next = UPGRADES.map((u) => ({ u, lvl: s.upgrades[u.id] ?? 0 }))
          .filter(({ u, lvl }) => lvl < u.max)
          .map(({ u, lvl }) => ({ u, lvl, cost: upgradeCost(u, lvl) }))
          .sort((a, b) => a.cost - b.cost)[0];
        if (!next || s.taler < next.cost) break;
        buyUpgrade(s, next.u.id);
        bought++;
        if ((BUILDINGS as string[]).includes(next.u.id)) (res.buildingDays[next.u.id] ??= []).push(day + 1);
        if (isMilestone(next.u.id, next.lvl + 1)) res.milestones.push({ day: day + 1, what: `${next.u.de}${next.u.max > 1 ? ` ${next.lvl + 1}` : ""}` });
      }
    }
    res.purchases.push(bought);
    const earned = s.lifetimeTaler - earnedBefore;
    res.idleShare.push(earned > 0 ? idle / earned : 0);
    const done = boughtLevels(s) / total;
    res.completion.push(done);
    if (done >= 1 && res.maxedDay === null) res.maxedDay = day + 1;
    if (process.env.SIM_LEVELS && (day + 1 === 365 || day + 1 === 730)) {
      res.log.push(`levels day ${day + 1}: ${UPGRADES.filter((u) => u.group !== "gebaeude").map((u) => `${u.id} ${s.upgrades[u.id] ?? 0}/${u.max}`).join(", ")}; taler ${Math.round(s.taler)}`);
    }
    if ((day + 1) % 30 === 0 || day === 0) {
      res.log.push(
        `${profile.name.padEnd(8)} day ${String(day + 1).padStart(3)}  done ${(done * 100).toFixed(0).padStart(3)} %  ` +
          `pro Satz ${perSentence(s).toFixed(0).padStart(7)}  rate ${factoryRate(s, catalog, now).toFixed(0).padStart(8)}/h  ` +
          `buildings ${BUILDINGS.filter((b) => s.upgrades[b]).length}/${BUILDINGS.length}  owned ${Object.keys(s.cards).length}`,
      );
    }
  }
  return res;
}

/** Longest stretch of days without a milestone, within the first `days`. */
export function longestGap(res: SimResult, days: number): { from: number; to: number; len: number } {
  const ds = [0, ...res.milestones.map((m) => m.day).filter((d) => d <= days), days];
  let best = { from: 0, to: 0, len: 0 };
  for (let i = 1; i < ds.length; i++) if (ds[i] - ds[i - 1] > best.len) best = { from: ds[i - 1], to: ds[i], len: ds[i] - ds[i - 1] };
  return best;
}

describe.skipIf(!process.env.SIM_LONG)("two-year progression", () => {
  const only = process.env.SIM_PROFILE;
  for (const p of PROFILES.filter((x) => !only || x.name === only)) {
    it(`${p.name} learner`, () => {
      const res = simulate(p, 730);
      const at = (d: number) => `${(res.completion[d - 1] * 100).toFixed(0)} %`;
      const gap = longestGap(res, 730);
      const idleAt = (d: number) => {
        const w = res.idleShare.slice(Math.max(0, d - 14), d);
        return `${((w.reduce((a, b) => a + b, 0) / w.length) * 100).toFixed(0)} %`;
      };
      const gap1 = longestGap(res, 365);
      console.log(
        [
          `== ${p.name}: ${p.days} days/week, ${p.shifts} shifts/day, ${p.visits} visits/day`,
          `completion: day 30 ${at(30)}, 90 ${at(90)}, 180 ${at(180)}, 365 ${at(365)}, 730 ${at(730)}; everything bought: ${res.maxedDay ?? "never"}`,
          `idle share of income: day 30 ${idleAt(30)}, 180 ${idleAt(180)}, 365 ${idleAt(365)}, 730 ${idleAt(730)}`,
          `milestones: ${res.milestones.length} (${res.milestones.filter((m) => m.day > 365).length} in year 2); longest gap ${gap.len} days (day ${gap.from}–${gap.to}); in year 1 ${gap1.len} days`,
          `purchases per week: year 1 ${(res.purchases.slice(0, 365).reduce((a, b) => a + b, 0) / 52).toFixed(1)}, year 2 ${(res.purchases.slice(365).reduce((a, b) => a + b, 0) / 52).toFixed(1)}`,
          `buildings (days of levels): ${BUILDINGS.map((b) => `${b} ${(res.buildingDays[b] ?? []).join("/") || "-"}`).join(", ")}`,
          ...(process.env.SIM_LOG ? res.log : []),
        ].join("\n"),
      );
      expect(res.completion.length).toBe(730);
    }, 600_000);
  }
});

/**
 * Price calibration: moves each building's first-level price until a typical learner
 * builds it near its target day. Prints the bases to copy into upgrades.ts.
 * SIM_CALIBRATE=1 npx vitest run tests/longsim.test.ts --reporter=verbose
 */
export const TARGET_DAY: Record<string, number> = {
  tankstelle: 10,
  kantine: 22,
  wasserturm: 36,
  kita: 52,
  parkhaus: 70,
  sportplatz: 90,
  ausbildung: 112,
  solarpark: 136,
  feuerwache: 162,
  autohaus: 190,
  windpark: 220,
  bahn: 252,
  forschung: 286,
  hochregal: 322,
  rechenzentrum: 360,
  hafen: 400,
  teststrecke: 445,
  heliport: 495,
  flugplatz: 560,
  rakete: 650,
};

describe.skipIf(!process.env.SIM_CALIBRATE)("calibrate building prices", () => {
  it("typical learner hits the target days", () => {
    const typical = PROFILES.find((p) => p.name === "typical")!;
    for (let round = 0; round < Number(process.env.SIM_ROUNDS ?? 4); round++) {
      const res = simulate(typical, 730);
      const lines: string[] = [];
      for (const b of BUILDINGS) {
        const def = UPGRADES.find((u) => u.id === b)!;
        const actual = res.buildingDays[b]?.[0] ?? 900;
        const target = TARGET_DAY[b];
        // Price scales with how much is earned by then; earnings grow a bit faster than linearly.
        const factor = Math.pow(target / actual, 1.6);
        def.base = Math.max(500, Math.round(def.base * Math.min(3, Math.max(0.33, factor))));
        lines.push(`${b.padEnd(14)} target ${String(target).padStart(3)} actual ${String(actual).padStart(3)} → base ${def.base}`);
      }
      console.log(`round ${round + 1}\n${lines.join("\n")}`);
    }
  }, 3_600_000);
});
