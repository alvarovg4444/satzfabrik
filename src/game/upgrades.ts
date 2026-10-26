import type { HallId } from "../content/types";

/*
 * Everything Taler can buy. Words and grammar are never bought: they come with the
 * daily delivery. Taler build the factory: more Taler per sentence, staff and
 * vehicles that produce while you are away, multipliers, and buildings that appear
 * on the map.
 */

export type UpgradeGroup = "werkstatt" | "personal" | "anlagen" | "gebaeude";

export type BuildingId = "kantine" | "wasserturm" | "parkhaus" | "ausbildung" | "solarpark" | "bahn" | "teststrecke" | "heliport";

export type UpgradeId =
  | "werkzeug"
  | "meisterbrief"
  | "kombipresse"
  | "schichtleiter"
  | "akkorduhr"
  | "arbeiter"
  | "gabelstapler"
  | "lkw"
  | "fliessband"
  | "schmieroel"
  | "lagerhalle"
  | "verwaltung"
  | `halle_${HallId}`
  | BuildingId;

export interface UpgradeDef {
  id: UpgradeId;
  group: UpgradeGroup;
  de: string;
  en: string;
  /** What one level does, shown in the shop. */
  effect: string;
  /** What changes on the map. */
  visual: string;
  base: number;
  growth: number;
  max: number;
  icon: string;
}

export const GROUPS: Record<UpgradeGroup, { de: string; en: string; blurb: string }> = {
  werkstatt: { de: "Werkstatt", en: "Workshop", blurb: "Mehr Taler für jeden Satz, den du schreibst." },
  personal: { de: "Personal & Fahrzeuge", en: "Staff & vehicles", blurb: "Produzieren auch, wenn die App zu ist." },
  anlagen: { de: "Anlagen", en: "Facilities", blurb: "Multiplikatoren für die ganze Fabrik." },
  gebaeude: { de: "Gebäude", en: "Buildings", blurb: "Große Bauprojekte auf dem Werksgelände." },
};

export const BUILDINGS: BuildingId[] = ["kantine", "wasserturm", "parkhaus", "ausbildung", "solarpark", "bahn", "teststrecke", "heliport"];

export const UPGRADES: UpgradeDef[] = [
  // werkstatt: Taler per sentence
  { id: "werkzeug", group: "werkstatt", de: "Werkzeugkasten", en: "Toolbox", effect: "+1 Taler pro Satz", visual: "Werkzeugschuppen am Hof", base: 10, growth: 1.62, max: 30, icon: "tool" },
  { id: "meisterbrief", group: "werkstatt", de: "Meisterbrief", en: "Master's certificate", effect: "×1,25 Taler pro Satz", visual: "Sterne am Firmenschild", base: 250, growth: 3.4, max: 8, icon: "medal" },
  { id: "kombipresse", group: "werkstatt", de: "Kombi-Presse", en: "Combo press", effect: "Kombo-Grenze +0,5", visual: "Kombi-Presse am Hof", base: 150, growth: 3, max: 4, icon: "press" },
  { id: "schichtleiter", group: "werkstatt", de: "Schichtleiter", en: "Shift supervisor", effect: "+50 % Schicht-Bonus", visual: "Schichtleiter mit weißem Helm", base: 200, growth: 3, max: 5, icon: "helmet" },
  { id: "akkorduhr", group: "werkstatt", de: "Akkord-Uhr", en: "Piecework clock", effect: "+15 s pro Akkord-Runde", visual: "Uhr vor der Zentrale", base: 120, growth: 3, max: 3, icon: "clock" },
  // personal: produce per hour
  { id: "arbeiter", group: "personal", de: "Arbeiter einstellen", en: "Hire a worker", effect: "+1 Taler pro Stunde", visual: "ein Arbeiter mehr auf dem Gelände", base: 15, growth: 1.15, max: 50, icon: "helmet" },
  { id: "gabelstapler", group: "personal", de: "Gabelstapler", en: "Forklift", effect: "+5 Taler pro Stunde", visual: "Gabelstapler im Wortlager", base: 150, growth: 1.3, max: 10, icon: "box" },
  { id: "lkw", group: "personal", de: "LKW-Flotte", en: "Truck fleet", effect: "+15 Taler pro Stunde, +1 h Lager", visual: "mehr Lastwagen auf der Straße", base: 800, growth: 1.4, max: 8, icon: "truck" },
  // anlagen: multipliers
  { id: "fliessband", group: "anlagen", de: "Fließband", en: "Conveyor belt", effect: "×1,15 Produktion", visual: "schnellere Bänder", base: 400, growth: 2.8, max: 8, icon: "belt" },
  { id: "verwaltung", group: "anlagen", de: "Verwaltung aufstocken", en: "Add an HQ floor", effect: "+5 % auf alles", visual: "ein Stockwerk mehr an der Zentrale", base: 600, growth: 2.6, max: 6, icon: "hall" },
  { id: "lagerhalle", group: "anlagen", de: "Lagerhalle", en: "Warehouse", effect: "+4 h Offline-Lager", visual: "Container am Hof", base: 300, growth: 2.6, max: 4, icon: "box" },
  { id: "schmieroel", group: "anlagen", de: "Schmieröl", en: "Machine oil", effect: "Rostige Maschinen behalten 10 % mehr", visual: "Ölfässer am Hof", base: 500, growth: 3, max: 4, icon: "oil" },
  { id: "halle_satzbau", group: "anlagen", de: "Satzbau-Halle ausbauen", en: "Expand sentence assembly", effect: "×1,25 in dieser Halle", visual: "Stern am Hallenschild", base: 700, growth: 2.8, max: 5, icon: "hall" },
  { id: "halle_woerter", group: "anlagen", de: "Wortlager ausbauen", en: "Expand word warehouse", effect: "×1,25 in dieser Halle", visual: "Stern am Hallenschild", base: 700, growth: 2.8, max: 5, icon: "hall" },
  { id: "halle_verben", group: "anlagen", de: "Verbschmiede ausbauen", en: "Expand verb forge", effect: "×1,25 in dieser Halle", visual: "Stern am Hallenschild", base: 700, growth: 2.8, max: 5, icon: "hall" },
  { id: "halle_faelle", group: "anlagen", de: "Kasuswerk ausbauen", en: "Expand case works", effect: "×1,25 in dieser Halle", visual: "Stern am Hallenschild", base: 700, growth: 2.8, max: 5, icon: "hall" },
  { id: "halle_redemittel", group: "anlagen", de: "Manufaktur ausbauen", en: "Expand phrase workshop", effect: "×1,25 in dieser Halle", visual: "Stern am Hallenschild", base: 700, growth: 2.8, max: 5, icon: "hall" },
  // gebaeude: one-off projects on the map
  { id: "kantine", group: "gebaeude", de: "Kantine", en: "Canteen", effect: "×1,25 Taler pro Satz", visual: "Kantine mit Terrasse", base: 3_000, growth: 1, max: 1, icon: "home" },
  { id: "wasserturm", group: "gebaeude", de: "Wasserturm", en: "Water tower", effect: "+4 h Offline-Lager", visual: "Wasserturm mit Firmenlogo", base: 12_000, growth: 1, max: 1, icon: "home" },
  { id: "parkhaus", group: "gebaeude", de: "Parkhaus", en: "Car park", effect: "×1,2 Produktion", visual: "Parkhaus voller Autos", base: 50_000, growth: 1, max: 1, icon: "home" },
  { id: "ausbildung", group: "gebaeude", de: "Ausbildungszentrum", en: "Training centre", effect: "×1,2 Taler pro Satz, +20 % Erfahrung", visual: "Ausbildungszentrum", base: 200_000, growth: 1, max: 1, icon: "home" },
  { id: "solarpark", group: "gebaeude", de: "Solarpark", en: "Solar park", effect: "×1,3 Produktion", visual: "Solarfeld", base: 800_000, growth: 1, max: 1, icon: "home" },
  { id: "bahn", group: "gebaeude", de: "Gleisanschluss", en: "Rail siding", effect: "×1,3 Produktion", visual: "Güterzug mit Neuwagen", base: 3_000_000, growth: 1, max: 1, icon: "home" },
  { id: "teststrecke", group: "gebaeude", de: "Teststrecke", en: "Test track", effect: "×1,5 Taler pro Satz", visual: "Teststrecke mit Rennwagen", base: 12_000_000, growth: 1, max: 1, icon: "home" },
  { id: "heliport", group: "gebaeude", de: "Hubschrauberlandeplatz", en: "Helipad", effect: "×1,5 auf alles", visual: "Landeplatz mit Hubschrauber", base: 50_000_000, growth: 1, max: 1, icon: "home" },
];

export const UPGRADE_BY_ID = new Map(UPGRADES.map((u) => [u.id, u] as const));

export function upgradeCost(def: UpgradeDef, level: number): number {
  return Math.round(def.base * Math.pow(def.growth, level));
}

export function level(upgrades: Partial<Record<UpgradeId, number>>, id: UpgradeId): number {
  return upgrades[id] ?? 0;
}

export function has(upgrades: Partial<Record<UpgradeId, number>>, id: BuildingId): boolean {
  return (upgrades[id] ?? 0) > 0;
}
