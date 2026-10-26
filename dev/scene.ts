import { layout, type MapInput, type HallInput } from "../src/pixel/layout";
import { FactoryRenderer } from "../src/pixel/scene";
import type { ItemKind } from "../src/content/types";

const params = new URLSearchParams(location.search);
const mode = params.get("mode") ?? "mid";
const night = params.has("night");
const widths = (params.get("w") ?? "214,286").split(",").map(Number);
const Z = Number(params.get("z") ?? 3);

function items(n: number, kind: ItemKind, opts: { plan?: number; due?: number; gold?: number } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    id: `${kind}${i}`,
    kind,
    stage: i < (opts.plan ?? 0) ? 0 : i % 7 === 3 && (opts.gold ?? 0) > 0 ? 5 : 1 + (i % 4),
    due: i >= (opts.plan ?? 0) && i % 5 === 2 && (opts.due ?? 0) > 0,
  }));
}

function demo(width: number): MapInput {
  const hall = (id: HallInput["id"], unlocked: boolean, its: HallInput["items"], level = 0): HallInput => ({
    id,
    unlocked,
    unlockLevel: id === "faelle" ? 2 : id === "redemittel" ? 3 : 1,
    level,
    items: its,
  });
  if (mode === "fresh")
    return {
      width,
      level: 1,
      streak: 0,
      today: 0,
      total: 0,
      upgrades: {},
      seed: 42,
      halls: [
        hall("satzbau", true, items(2, "gram", { plan: 2 })),
        hall("woerter", true, items(6, "noun", { plan: 6 })),
        hall("verben", true, items(3, "verb", { plan: 3 })),
        hall("faelle", false, []),
        hall("redemittel", false, []),
      ],
    };
  if (mode === "big")
    return {
      width,
      level: 14,
      streak: 41,
      today: 38,
      total: 2300,
      upgrades: { lagerhalle: 4, schmieroel: 3, schichtleiter: 2, fliessband: 4, halle_satzbau: 3, halle_woerter: 2 },
      seed: 42,
      halls: [
        hall("satzbau", true, items(24, "gram", { due: 1, gold: 1 }), 3),
        hall("woerter", true, items(255, "noun", { due: 1, gold: 1 }), 2),
        hall("verben", true, [...items(20, "gram", { gold: 1 }), ...items(114, "verb", { due: 1, gold: 1 })]),
        hall("faelle", true, items(16, "gram", { due: 1, gold: 1 })),
        hall("redemittel", true, items(74, "expr", { due: 1, gold: 1 })),
      ],
    };
  return {
    width,
    level: 4,
    streak: 6,
    today: 9,
    total: 180,
    upgrades: { lagerhalle: 1, schmieroel: 1, schichtleiter: 1, halle_satzbau: 1 },
    seed: 42,
    halls: [
      hall("satzbau", true, items(7, "gram", { plan: 1, due: 1, gold: 1 }), 1),
      hall("woerter", true, items(40, "noun", { plan: 3, due: 1 })),
      hall("verben", true, [...items(2, "gram"), ...items(14, "verb", { plan: 2, due: 1, gold: 1 })]),
      hall("faelle", true, items(3, "gram", { plan: 1 })),
      hall("redemittel", false, []),
    ],
  };
}

const root = document.getElementById("root")!;
const renderers: FactoryRenderer[] = [];
for (const w of widths) {
  const scene = layout(demo(w));
  const cv = document.createElement("canvas");
  cv.style.width = `${scene.w * Z}px`;
  cv.style.height = `${scene.h * Z}px`;
  root.append(cv);
  const r = new FactoryRenderer(cv);
  r.set(scene, { night, reduced: false });
  renderers.push(r);
}
const t0 = performance.now();
const t = Number(params.get("t") ?? NaN);
function loop() {
  for (const r of renderers) r.frame(Number.isFinite(t) ? t : (performance.now() - t0) / 1000);
  if (!Number.isFinite(t)) requestAnimationFrame(loop);
}
loop();
