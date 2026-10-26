import { SPR } from "../src/pixel/sprites";
import { bench, bigPress, booth, press, rack, robot } from "../src/pixel/machines";
import type { Look } from "../src/pixel/layout";
import { painted } from "../src/pixel/paint";
import { text } from "../src/pixel/font";

const root = document.getElementById("root")!;
const Z = 5;

function show(label: string, c: HTMLCanvasElement, bg = "floor") {
  const fig = document.createElement("figure");
  const big = document.createElement("canvas");
  big.width = c.width * Z;
  big.height = c.height * Z;
  if (bg) big.className = bg;
  const x = big.getContext("2d")!;
  x.imageSmoothingEnabled = false;
  x.drawImage(c, 0, 0, big.width, big.height);
  const cap = document.createElement("figcaption");
  cap.textContent = label;
  fig.append(big, cap);
  root.append(fig);
}

const looks: Look[] = ["work", "rust", "gold", "plan"];
show("w down", SPR.worker("down", 0));
show("w down1", SPR.worker("down", 1));
show("w down2", SPR.worker("down", 2));
show("w up", SPR.worker("up", 0));
show("w up1", SPR.worker("up", 1));
show("w right", SPR.worker("right", 0));
show("w right1", SPR.worker("right", 1));
show("boss", SPR.boss("down", 0));
for (const l of looks) show(`robot ${l}`, robot(0, l));
show("robot B", robot(1, "work"));
for (const l of looks) show(`press ${l}`, press(0, l));
show("press B", press(1, "work"));
for (const l of looks) show(`big ${l}`, bigPress(0, l));
show("big B", bigPress(1, "work"));
for (const l of looks) show(`booth ${l}`, booth(0, l, 1));
show("booth B", booth(1, "work", 0));
for (const l of looks) show(`bench ${l}`, bench(0, l, 1));
show("bench B", bench(1, "work", 0));
const items = (stages: number[], due: number[] = []) => stages.map((s, i) => ({ id: `x${i}`, stage: s, due: due.includes(i) }));
show("rack", rack(items([1, 2, 3, 4, 5, 0, 1, 2, 3])));
show("rack due", rack(items([1, 2, 3, 2], [1])));
show("rack 2", rack(items([0, 0, 1])));
for (let i = 0; i < 10; i++) show(`car ${i}`, SPR.car(i));
show("car R", SPR.car(1, "right"));
show("car L", SPR.car(2, "left"));
show("car D", SPR.car(3, "down"));
show("primer", SPR.car(0, "up", true));
show("truck", SPR.truck(7, false, [0, 1]));
show("forklift", SPR.forklift(false, false));
show("forklift x", SPR.forklift(false, true));
show("tree", SPR.tree(), "");
show("small tree", SPR.smallTree(), "");
show("bush", SPR.bush(), "");
show("lamp", SPR.lamp(false), "");
show("barrel", SPR.barrel(), "");
show("cone", SPR.cone(), "");
show("flower", SPR.flower(0, "#f85868"), "");
show("bubble", SPR.bubble());
show("sparkle", SPR.sparkle(0));
show("puff", SPR.puff(1));
show("font", painted(120, 14, (c) => {
  text(c, "SATZBAU-HALLE 12", 1, 1, "#283040");
  text(c, "WORTLAGER ÄÖÜ 0123456789", 1, 8, "#283040");
}));
