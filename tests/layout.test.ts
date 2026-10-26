import { describe, expect, it } from "vitest";
import { makeCatalog } from "../src/content/catalog";
import type { ItemKind } from "../src/content/types";
import { unlock } from "../src/game/actions";
import { newGame } from "../src/game/state";
import { layout, lookOf, mapInput, RACK_SLOTS, type HallInput, type MapInput, type Rect } from "../src/pixel/layout";

const T0 = new Date("2026-10-26T09:00:00").getTime();

function items(n: number, kind: ItemKind, prefix: string = kind) {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, kind, stage: i % 6, due: i % 4 === 1 }));
}

function input(width: number, halls: Partial<Record<HallInput["id"], HallInput["items"] | null>>, extra: Partial<MapInput> = {}): MapInput {
  const ids: HallInput["id"][] = ["satzbau", "woerter", "verben", "faelle", "redemittel"];
  return {
    width,
    level: 5,
    streak: 3,
    today: 4,
    total: 40,
    upgrades: {},
    seed: 1,
    halls: ids.map((id) => ({
      id,
      unlocked: halls[id] !== null,
      unlockLevel: 1,
      level: 0,
      items: halls[id] ?? [],
    })),
    ...extra,
  };
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Rect, b: Rect) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;

describe("factory map layout", () => {
  const full = {
    satzbau: items(24, "gram", "s"),
    woerter: items(255, "noun", "w"),
    verben: [...items(20, "gram", "vg"), ...items(114, "verb", "v")],
    faelle: items(16, "gram", "f"),
    redemittel: items(74, "expr", "r"),
  };

  for (const width of [170, 214, 286, 344]) {
    it(`places every item exactly once, without overlaps, at ${width} px`, () => {
      const scene = layout(input(width, full));
      expect(scene.w).toBe(width);
      const seen = new Map<string, number>();
      for (const st of scene.stations) for (const it of st.items) seen.set(it.id, (seen.get(it.id) ?? 0) + 1);
      const all = Object.values(full).flat();
      expect(seen.size).toBe(all.length);
      expect([...seen.values()].every((n) => n === 1)).toBe(true);
      for (let i = 0; i < scene.stations.length; i++) {
        const a = scene.stations[i];
        const hall = scene.halls.find((h) => h.id === a.hall)!;
        expect(inside(a, hall.inner), `${a.kind} ${a.n} in ${a.hall}`).toBe(true);
        for (let j = i + 1; j < scene.stations.length; j++) expect(overlaps(a, scene.stations[j])).toBe(false);
      }
      for (let i = 1; i < scene.halls.length; i++) expect(scene.halls[i].y).toBeGreaterThanOrEqual(scene.halls[i - 1].y + scene.halls[i - 1].h);
      expect(scene.h).toBeGreaterThan(scene.halls[scene.halls.length - 1].y);
    });
  }

  it("turns locked halls into construction sites", () => {
    const scene = layout(input(214, { satzbau: items(3, "gram"), faelle: null, redemittel: null }));
    expect(scene.sites.map((s) => s.id)).toEqual(["faelle", "redemittel"]);
    expect(scene.stations.some((s) => s.hall === "faelle")).toBe(false);
    const empty = scene.halls.find((h) => h.id === "verben")!;
    expect(empty.note).toBeTruthy();
    expect(empty.free.length).toBeGreaterThan(0);
  });

  it("grows as machines are added", () => {
    const small = layout(input(214, { woerter: items(10, "noun") }));
    const big = layout(input(214, { woerter: items(200, "noun") }));
    expect(big.h).toBeGreaterThan(small.h);
  });

  it("packs a huge word import into a bounded warehouse", () => {
    const scene = layout(input(214, { woerter: items(3200, "word") }));
    const racks = scene.stations.filter((s) => s.kind === "rack");
    expect(racks.reduce((n, r) => n + r.items.length, 0)).toBe(3200);
    const rows = new Set(racks.map((r) => r.y)).size;
    expect(rows).toBeLessThanOrEqual(8);
    expect(racks.every((r) => r.items.length % RACK_SLOTS === 0 || r === racks[racks.length - 1])).toBe(true);
  });

  it("parks one car per sentence written today, up to the lot size", () => {
    expect(layout(input(214, {}, { today: 3 })).lot.cars).toBe(3);
    const busy = layout(input(214, {}, { today: 500 }));
    expect(busy.lot.cars).toBe(busy.lot.spots.length);
  });

  it("shows blueprints, rust and gold", () => {
    expect(lookOf(0, false)).toBe("plan");
    expect(lookOf(2, true)).toBe("rust");
    expect(lookOf(5, false)).toBe("gold");
    expect(lookOf(3, false)).toBe("work");
  });
});

describe("map input from a save", () => {
  it("lists owned items per hall in unlock order", () => {
    const catalog = makeCatalog([]);
    const s = newGame(T0);
    s.taler = 1e9;
    const nouns = catalog.inHall("woerter").slice(0, 3);
    unlock(s, nouns[2], T0);
    unlock(s, nouns[0], T0 + 1000);
    const inp = mapInput(s, catalog, T0 + 2000, 214);
    const woerter = inp.halls.find((h) => h.id === "woerter")!;
    expect(woerter.items.map((i) => i.id)).toEqual([nouns[2].id, nouns[0].id]);
    expect(woerter.items.every((i) => i.stage === 0 && !i.due)).toBe(true);
    expect(inp.halls.find((h) => h.id === "redemittel")!.unlocked).toBe(false);
    const scene = layout(inp);
    expect(scene.stations.filter((st) => st.hall === "woerter").length).toBe(1);
  });
});

describe("a very big factory", () => {
  it("packs several verbs per press so the hall stays bounded", () => {
    const verbs = items(650, "verb", "vv");
    const scene = layout(input(214, { verben: verbs }));
    const presses = scene.stations.filter((s) => s.kind === "press");
    expect(presses.reduce((n, p) => n + p.items.length, 0)).toBe(650);
    expect(new Set(presses.map((p) => p.y)).size).toBeLessThanOrEqual(8);
    expect(presses.some((p) => p.items.length > 1)).toBe(true);
  });
});
