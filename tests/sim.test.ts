import { describe, expect, it } from "vitest";
import type { GradeResult } from "../src/ai/schema";
import { makeCatalog } from "../src/content/catalog";
import { isDue, stageOf } from "../src/engine/srs";
import { buildShift } from "../src/engine/tasks";
import { dayKey, rng } from "../src/engine/text";
import { applyGrade, buyUpgrade, finishShift, rollover, tick, unlock, weakRules } from "../src/game/actions";
import { factoryRate, levelOf, unlockCost } from "../src/game/economy";
import { starterItems } from "../src/game/starter";
import { newGame } from "../src/game/state";
import { UPGRADES, upgradeCost } from "../src/game/upgrades";

/**
 * Economy sanity check: a learner plays ~30 minutes a day for 60 days.
 * Run with SIM=1 npx vitest run tests/sim.test.ts to print the daily log.
 */
describe("60-day economy simulation", () => {
  it("keeps intake and review load in a sensible range", () => {
    const catalog = makeCatalog([]);
    const r = rng(7);
    const DAY = 86_400_000;
    let now = new Date("2026-11-01T08:00:00").getTime();
    const s = newGame(now);
    for (const it of starterItems(catalog, ["arbeit", "wohnen", "alltag"])) unlock(s, it, now, { free: true });
    s.onboarded = true;
    const log: string[] = [];
    let maxDue = 0;
    let newPerDay = 0;
    for (let day = 0; day < 60; day++) {
      now = new Date("2026-11-01T08:00:00").getTime() + day * DAY;
      tick(s, catalog, now);
      rollover(s, catalog, now);
      const dueAtStart = Object.values(s.cards).filter((c) => isDue(c, now)).length;
      maxDue = Math.max(maxDue, dueAtStart);
      let graded = 0;
      for (let shift = 0; shift < 3; shift++) {
        const due = Object.values(s.cards).filter((c) => isDue(c, now)).length;
        const tasks = buildShift({
          cards: s.cards,
          catalog,
          now,
          weakRules: weakRules(s),
          size: 10,
          maxNew: Math.min(Math.max(0, 10 - (s.stats.days[dayKey(now)]?.built ?? 0)), Math.max(3, Math.min(6, 10 - due))),
        });
        if (!tasks.length) break;
        for (const t of tasks) {
          if (t.type === "intro") continue;
          const ok = r() < 0.82;
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
          graded++;
        }
        finishShift(s, catalog, now);
      }
      // Spend: blueprints first (at most 6 a day), then the cheapest upgrade.
      let bought = 0;
      const candidates = catalog.items.filter((it) => !s.cards[it.id]);
      for (const it of candidates) {
        if (bought >= 12) break;
        if (unlock(s, it, now) === null) bought++;
      }
      newPerDay += bought;
      const up = UPGRADES.map((u) => ({ u, cost: upgradeCost(u, s.upgrades[u.id] ?? 0) }))
        .filter(({ u }) => (s.upgrades[u.id] ?? 0) < u.max)
        .sort((a, b) => a.cost - b.cost)[0];
      if (up && s.taler > up.cost * 2) buyUpgrade(s, up.u.id);
      // The app is closed for 16 hours.
      now += 16 * 3_600_000;
      const owned = Object.keys(s.cards).length;
      const gold = Object.values(s.cards).filter((c) => stageOf(c) === 5).length;
      log.push(
        `day ${String(day + 1).padStart(2)}  due ${String(dueAtStart).padStart(3)}  graded ${String(graded).padStart(2)}  bought ${bought}  owned ${String(owned).padStart(3)}  gold ${String(gold).padStart(3)}  lvl ${levelOf(s.xp)}  rate ${factoryRate(s, catalog, now).toFixed(0).padStart(5)}/h  taler ${s.taler.toFixed(0).padStart(7)}  next ${unlockCost(s, catalog.items[0])}  blueprints ${Object.values(s.cards).filter((c) => stageOf(c) === 0).length}`,
      );
    }
    if (process.env.SIM) console.log(log.join("\n"));
    // Reviews must stay doable in ~30 minutes and the factory must keep growing.
    expect(maxDue).toBeLessThan(60);
    expect(newPerDay / 60).toBeGreaterThan(1.5);
    expect(Object.keys(s.cards).length).toBeGreaterThan(80);
  });
});
