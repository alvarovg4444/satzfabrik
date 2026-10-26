import type { Catalog } from "../content/catalog";
import { isDue, stageOf } from "../engine/srs";
import type { GameState } from "./state";

export interface Achievement {
  id: string;
  de: string;
  en: string;
  reward: number;
  test: (s: GameState, catalog: Catalog, now: number) => boolean;
}

const count = (s: GameState, pred: (stage: number) => boolean) =>
  Object.values(s.cards).filter((c) => pred(stageOf(c))).length;

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first", de: "Erster Satz", en: "First sentence", reward: 50, test: (s) => s.stats.sentences >= 1 },
  { id: "s10", de: "Zehn Sätze", en: "Ten sentences", reward: 100, test: (s) => s.stats.sentences >= 10 },
  { id: "s100", de: "Hundert Sätze", en: "A hundred sentences", reward: 500, test: (s) => s.stats.sentences >= 100 },
  { id: "s500", de: "Satzmaschine", en: "Sentence machine", reward: 2500, test: (s) => s.stats.sentences >= 500 },
  { id: "s1000", de: "Tausend Sätze", en: "A thousand sentences", reward: 8000, test: (s) => s.stats.sentences >= 1000 },
  { id: "p10", de: "Sauber gearbeitet", en: "Clean work", reward: 200, test: (s) => s.stats.perfect >= 10 },
  { id: "p100", de: "Qualitätssiegel", en: "Seal of quality", reward: 2000, test: (s) => s.stats.perfect >= 100 },
  { id: "m10", de: "Kleine Werkstatt", en: "Small workshop", reward: 150, test: (s) => count(s, (st) => st > 0) >= 10 },
  { id: "m50", de: "Mittelstand", en: "Medium-sized business", reward: 1000, test: (s) => count(s, (st) => st > 0) >= 50 },
  { id: "m150", de: "Großindustrie", en: "Heavy industry", reward: 5000, test: (s) => count(s, (st) => st > 0) >= 150 },
  { id: "g1", de: "Erste Goldmaschine", en: "First gold machine", reward: 1500, test: (s) => count(s, (st) => st === 5) >= 1 },
  { id: "g10", de: "Goldrausch", en: "Gold rush", reward: 10000, test: (s) => count(s, (st) => st === 5) >= 10 },
  { id: "st3", de: "Drei Tage am Stück", en: "Three days in a row", reward: 200, test: (s) => s.streak.current >= 3 },
  { id: "st7", de: "Eine ganze Woche", en: "A whole week", reward: 700, test: (s) => s.streak.current >= 7 },
  { id: "st30", de: "Ein Monat Fabrik", en: "A month of factory", reward: 5000, test: (s) => s.streak.current >= 30 },
  { id: "st100", de: "Hundert Tage", en: "A hundred days", reward: 25000, test: (s) => s.streak.current >= 100 },
  { id: "c10", de: "Zehner-Kombo", en: "Ten-combo", reward: 400, test: (s) => s.bestCombo >= 2 },
  { id: "d100", de: "Akkordarbeiter", en: "Piece worker", reward: 600, test: (s) => s.stats.drillOk >= 100 },
  {
    id: "norust",
    de: "Kein Rost weit und breit",
    en: "Not a speck of rust",
    reward: 1500,
    test: (s, _c, now) => {
      const built = Object.values(s.cards).filter((c) => stageOf(c) > 0);
      return built.length >= 25 && built.every((c) => !isDue(c, now));
    },
  },
  {
    id: "connectors",
    de: "Alle Konnektoren",
    en: "Every connector",
    reward: 3000,
    test: (s, catalog) => catalog.inHall("satzbau").every((it) => s.cards[it.id] && stageOf(s.cards[it.id]) > 0),
  },
];
