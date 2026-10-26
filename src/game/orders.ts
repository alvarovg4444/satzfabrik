import { HALLS, TOPICS, type HallId, type TopicId } from "../content/types";
import { hash, pick, rng, shuffle } from "../engine/text";

/** Daily customer orders ("Aufträge"): three small goals, a chest when all are done. */
export type OrderKind =
  | "good_sentences"
  | "perfect_sentences"
  | "hall_targets"
  | "topic_targets"
  | "repair"
  | "build"
  | "drill"
  | "shifts"
  | "long_sentence";

export interface Order {
  id: string;
  kind: OrderKind;
  goal: number;
  progress: number;
  hall?: HallId;
  topic?: TopicId;
  reward: number;
  done: boolean;
  /** The customer, for flavour. */
  from: string;
}

const CUSTOMERS = [
  "Frau Yılmaz vom Bürgeramt",
  "Herr Becker, dein Vermieter",
  "Bäckerei Schmidt",
  "Praxis Dr. Wagner",
  "Familie Novak",
  "Sprachschule Wortwerk",
  "Café Morgenrot",
  "Spedition Krüger",
  "Stadtbibliothek",
  "Fahrradladen Pedal",
];

export function orderText(o: Order): { de: string; en: string } {
  switch (o.kind) {
    case "good_sentences":
      return { de: `Schreib ${o.goal} Sätze, in denen alle Bausteine stimmen`, en: `Write ${o.goal} sentences with every building block right` };
    case "perfect_sentences":
      return { de: `Schreib ${o.goal} fehlerfreie Sätze`, en: `Write ${o.goal} error-free sentences` };
    case "hall_targets":
      return { de: `Benutze ${o.goal}× Bausteine aus: ${HALLS[o.hall!].de}`, en: `Use ${o.goal} blocks from the ${HALLS[o.hall!].en}` };
    case "topic_targets":
      return { de: `Benutze ${o.goal} Wörter zum Thema ${TOPICS[o.topic!].de}`, en: `Use ${o.goal} words about ${TOPICS[o.topic!].en}` };
    case "repair":
      return { de: `Repariere ${o.goal} rostige Maschinen`, en: `Repair ${o.goal} rusty machines` };
    case "build":
      return { de: `Baue ${o.goal} neue Maschine${o.goal > 1 ? "n" : ""}`, en: `Build ${o.goal} new machine${o.goal > 1 ? "s" : ""}` };
    case "drill":
      return { de: `Akkord-Runde mit mindestens ${o.goal} Treffern`, en: `Speed round with at least ${o.goal} hits` };
    case "shifts":
      return { de: `Schließe ${o.goal} Schichten ab`, en: `Finish ${o.goal} shifts` };
    case "long_sentence":
      return { de: "Ein fehlerfreier Satz mit mindestens 12 Wörtern", en: "One error-free sentence with 12+ words" };
  }
}

export interface OrderContext {
  day: string;
  /** Taler per hour, and Taler per sentence: rewards grow with the factory. */
  rate: number;
  perSentence: number;
  ownedHalls: HallId[];
  ownedTopics: TopicId[];
  hasRepairs: boolean;
}

export function dailyOrders(ctx: OrderContext): Order[] {
  const r = rng(hash(`orders:${ctx.day}`));
  // About ten sentences' worth plus an hour of production.
  const reward = (mult: number) => Math.max(10, Math.round((ctx.perSentence * 10 + ctx.rate) * mult));
  const pool: Omit<Order, "id" | "progress" | "done" | "from">[] = [
    { kind: "good_sentences", goal: pick([5, 8, 12], r), reward: reward(1) },
    { kind: "perfect_sentences", goal: pick([2, 3, 5], r), reward: reward(1.2) },
    { kind: "build", goal: pick([1, 2, 3], r), reward: reward(1) },
    { kind: "drill", goal: pick([8, 10], r), reward: reward(0.8) },
    { kind: "shifts", goal: pick([2, 3], r), reward: reward(1.3) },
    { kind: "long_sentence", goal: 1, reward: reward(0.9) },
  ];
  if (ctx.hasRepairs) pool.push({ kind: "repair", goal: pick([3, 5], r), reward: reward(1.1) });
  if (ctx.ownedHalls.length) pool.push({ kind: "hall_targets", hall: pick(ctx.ownedHalls, r), goal: pick([3, 5], r), reward: reward(1) });
  if (ctx.ownedTopics.length) pool.push({ kind: "topic_targets", topic: pick(ctx.ownedTopics, r), goal: pick([2, 3], r), reward: reward(1) });
  const chosen = shuffle(pool, r).slice(0, 3);
  return chosen.map((o, i) => ({ ...o, id: `${ctx.day}:${i}`, progress: 0, done: false, from: pick(CUSTOMERS, r) }));
}

/** Rewards for the daily chest: variable on purpose. */
export type ChestPrize = { kind: "taler"; amount: number } | { kind: "freeze" } | { kind: "worker" };

/** `value` is what a good day earns, so the chest stays worth opening as the factory grows. */
export function openChest(seed: number, value: number): ChestPrize {
  const r = rng(seed);
  const roll = r();
  if (roll < 0.15) return { kind: "freeze" };
  if (roll < 0.35) return { kind: "worker" };
  const mult = roll > 0.95 ? 6 : roll > 0.8 ? 3 : roll > 0.55 ? 2 : 1.2;
  return { kind: "taler", amount: Math.max(20, Math.round(value * mult)) };
}
