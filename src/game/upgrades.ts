import type { HallId } from "../content/types";

/*
 * Everything Taler can buy. Words and grammar are never bought: they come with the
 * daily delivery. Taler build the factory: more Taler per sentence, staff and
 * vehicles that produce while you are away, multipliers, and buildings that appear
 * on the map. Prices are tuned with a two-year simulation (tests/longsim.test.ts) so
 * that a learner who practises most days still has something new to build after two
 * years.
 */

export type UpgradeGroup = "werkstatt" | "personal" | "anlagen" | "gebaeude";

export type BuildingId =
  | "tankstelle"
  | "kantine"
  | "wasserturm"
  | "kita"
  | "parkhaus"
  | "sportplatz"
  | "ausbildung"
  | "solarpark"
  | "feuerwache"
  | "autohaus"
  | "windpark"
  | "bahn"
  | "forschung"
  | "hochregal"
  | "rechenzentrum"
  | "hafen"
  | "teststrecke"
  | "heliport"
  | "flugplatz"
  | "rakete";

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
  | "export"
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
  /** Levels at which the map changes visibly (beyond the first one). */
  tiers?: number[];
  /** The last level costs this much more again (the gold version of a building). */
  lastMult?: number;
}

/** What a building does per level; the shares of all buildings add up. */
export interface BuildingEffect {
  /** Taler per sentence, +share per level (0.1 = +10 %). */
  satz?: number;
  /** Production while away, +share per level. */
  prod?: number;
  /** Everything, +share per level. */
  all?: number;
  /** Offline storage, +hours per level. */
  lager?: number;
  /** Experience, +share per level. */
  xp?: number;
  /** Rusty machines keep this much more of their output, per level. */
  rust?: number;
}

export const GROUPS: Record<UpgradeGroup, { de: string; en: string; blurb: string }> = {
  werkstatt: { de: "Werkstatt", en: "Workshop", blurb: "Mehr Taler für jeden Satz, den du schreibst." },
  personal: { de: "Personal & Fahrzeuge", en: "Staff & vehicles", blurb: "Produzieren auch, wenn die App zu ist." },
  anlagen: { de: "Anlagen", en: "Facilities", blurb: "Multiplikatoren für die ganze Fabrik." },
  gebaeude: { de: "Gebäude", en: "Buildings", blurb: "Große Bauprojekte auf dem Werksgelände: jedes wächst mit seinen Ausbaustufen, Stufe 4 ist die Gold-Version." },
};

/** In the order they become affordable. */
export const BUILDINGS: BuildingId[] = [
  "tankstelle",
  "kantine",
  "wasserturm",
  "kita",
  "parkhaus",
  "sportplatz",
  "ausbildung",
  "solarpark",
  "feuerwache",
  "autohaus",
  "windpark",
  "bahn",
  "forschung",
  "hochregal",
  "rechenzentrum",
  "hafen",
  "teststrecke",
  "heliport",
  "flugplatz",
  "rakete",
];

export const BUILDING_EFFECT: Record<BuildingId, BuildingEffect> = {
  tankstelle: { prod: 0.08 },
  kantine: { satz: 0.1 },
  wasserturm: { lager: 3 },
  kita: { satz: 0.08 },
  parkhaus: { prod: 0.1 },
  sportplatz: { satz: 0.08, xp: 0.05 },
  ausbildung: { satz: 0.1, xp: 0.1 },
  solarpark: { prod: 0.15 },
  feuerwache: { rust: 0.05, prod: 0.06 },
  autohaus: { satz: 0.12 },
  windpark: { prod: 0.15 },
  bahn: { prod: 0.2 },
  forschung: { satz: 0.15 },
  hochregal: { lager: 3, prod: 0.1 },
  rechenzentrum: { all: 0.12 },
  hafen: { prod: 0.25 },
  teststrecke: { satz: 0.2 },
  heliport: { all: 0.15 },
  flugplatz: { all: 0.2 },
  rakete: { all: 0.3 },
};

const pct = (x: number) => `${Math.round(x * 100)} %`;

/** "+10 % Taler pro Satz je Stufe" */
export function effectText(e: BuildingEffect): string {
  const parts: string[] = [];
  if (e.satz) parts.push(`+${pct(e.satz)} Taler pro Satz`);
  if (e.prod) parts.push(`+${pct(e.prod)} Produktion`);
  if (e.all) parts.push(`+${pct(e.all)} auf alles`);
  if (e.lager) parts.push(`+${e.lager} h Lager`);
  if (e.xp) parts.push(`+${pct(e.xp)} Erfahrung`);
  if (e.rust) parts.push(`rostige Maschinen +${pct(e.rust)}`);
  return `${parts.join(", ")} je Stufe`;
}

interface BuildingInfo {
  de: string;
  en: string;
  visual: string;
  /** Price of the first level; each further level costs BUILDING_GROWTH times more. */
  base: number;
}

const BUILDING_INFO: Record<BuildingId, BuildingInfo> = {
  tankstelle: { de: "Tankstelle", en: "Filling station", visual: "Tankstelle, später mit Ladesäulen und Shop", base: 560 },
  kantine: { de: "Kantine", en: "Canteen", visual: "Kantine mit Terrasse, später Dachgarten", base: 1_500 },
  wasserturm: { de: "Wasserturm", en: "Water tower", visual: "Wasserturm mit Firmenlogo", base: 3_400 },
  kita: { de: "Betriebskita", en: "Company daycare", visual: "Kita mit Spielplatz und Schaukel", base: 7_600 },
  parkhaus: { de: "Parkhaus", en: "Car park", visual: "Parkhaus, jede Stufe ein Deck mehr", base: 12_000 },
  sportplatz: { de: "Sportplatz", en: "Sports ground", visual: "Fußballplatz der Werksmannschaft", base: 20_000 },
  ausbildung: { de: "Ausbildungszentrum", en: "Training centre", visual: "Ausbildungszentrum mit Azubis", base: 35_000 },
  solarpark: { de: "Solarpark", en: "Solar park", visual: "Solarfeld, jede Stufe eine Reihe mehr", base: 52_000 },
  feuerwache: { de: "Werksfeuerwehr", en: "Fire station", visual: "Feuerwache mit Löschfahrzeug", base: 83_000 },
  autohaus: { de: "Autohaus", en: "Showroom", visual: "Autohaus mit Drehbühne", base: 110_000 },
  windpark: { de: "Windpark", en: "Wind farm", visual: "Windräder, eins mehr pro Stufe", base: 160_000 },
  bahn: { de: "Gleisanschluss", en: "Rail siding", visual: "Güterzug mit Neuwagen, länger pro Stufe", base: 200_000 },
  forschung: { de: "Forschungszentrum", en: "Research centre", visual: "Labor mit Radarschüssel", base: 290_000 },
  hochregal: { de: "Hochregallager", en: "High-bay warehouse", visual: "Hochregallager mit Kran", base: 380_000 },
  rechenzentrum: { de: "Rechenzentrum", en: "Data centre", visual: "Rechenzentrum mit blinkenden Servern", base: 500_000 },
  hafen: { de: "Werkshafen", en: "Harbour", visual: "Hafen mit Autofrachter", base: 820_000 },
  teststrecke: { de: "Teststrecke", en: "Test track", visual: "Teststrecke mit Rennwagen", base: 950_000 },
  heliport: { de: "Hubschrauberlandeplatz", en: "Helipad", visual: "Landeplatz mit Hubschrauber", base: 1_300_000 },
  flugplatz: { de: "Werksflugplatz", en: "Airfield", visual: "Startbahn mit Frachtflugzeug", base: 2_100_000 },
  rakete: { de: "Raketenstartplatz", en: "Rocket launch pad", visual: "Rakete, die ab und zu startet", base: 3_600_000 },
};

/** Each building level costs this many times the one before. */
export const BUILDING_GROWTH = 2.5;
/** Levels 2 and 3 change the building, level 4 is the gold version. */
export const BUILDING_LEVELS = 4;

export const UPGRADES: UpgradeDef[] = [
  // werkstatt: Taler per sentence
  { id: "werkzeug", group: "werkstatt", de: "Werkzeugkasten", en: "Toolbox", effect: "+1 Taler pro Satz", visual: "Werkzeugschuppen am Hof, wird größer", base: 10, growth: 1.35, max: 60, icon: "tool", tiers: [10, 20, 35, 50] },
  { id: "meisterbrief", group: "werkstatt", de: "Meisterbrief", en: "Master's certificate", effect: "×1,25 Taler pro Satz", visual: "Sterne auf dem Dach der Zentrale", base: 250, growth: 3.2, max: 10, icon: "medal" },
  { id: "kombipresse", group: "werkstatt", de: "Kombi-Presse", en: "Combo press", effect: "Kombo-Grenze +0,5", visual: "Kombi-Presse am Hof", base: 150, growth: 3, max: 6, icon: "press", tiers: [3, 6] },
  { id: "schichtleiter", group: "werkstatt", de: "Schichtleiter", en: "Shift supervisor", effect: "+50 % Schicht-Bonus", visual: "Schichtleiter mit weißem Helm", base: 200, growth: 2.6, max: 12, icon: "helmet" },
  { id: "akkorduhr", group: "werkstatt", de: "Akkord-Uhr", en: "Piecework clock", effect: "+15 s pro Akkord-Runde", visual: "Uhr vor der Zentrale", base: 120, growth: 3, max: 4, icon: "clock" },
  // personal: produce per hour
  { id: "arbeiter", group: "personal", de: "Arbeiter einstellen", en: "Hire a worker", effect: "ein Arbeiter mehr in der Produktion", visual: "ein Arbeiter mehr auf dem Gelände", base: 15, growth: 1.08, max: 200, icon: "helmet" },
  { id: "gabelstapler", group: "personal", de: "Gabelstapler", en: "Forklift", effect: "so viel wie 4 Arbeiter", visual: "Gabelstapler in den Gängen", base: 150, growth: 1.25, max: 50, icon: "box" },
  { id: "lkw", group: "personal", de: "LKW-Flotte", en: "Truck fleet", effect: "so viel wie 10 Arbeiter, +1 h Lager", visual: "mehr Lastwagen auf der Straße", base: 800, growth: 1.25, max: 50, icon: "truck" },
  // anlagen: multipliers
  { id: "fliessband", group: "anlagen", de: "Fließband", en: "Conveyor belt", effect: "+15 % Produktion", visual: "schnellere Bänder", base: 400, growth: 2.2, max: 15, icon: "belt" },
  { id: "verwaltung", group: "anlagen", de: "Verwaltung aufstocken", en: "Add an HQ floor", effect: "+5 % auf alles", visual: "ein Stockwerk mehr an der Zentrale", base: 600, growth: 2.3, max: 9, icon: "hall" },
  { id: "export", group: "anlagen", de: "Exportmarkt erschließen", en: "Open an export market", effect: "+5 % auf alles", visual: "die Flagge des neuen Landes vor der Zentrale", base: 120_000, growth: 1.22, max: 30, icon: "truck" },
  { id: "lagerhalle", group: "anlagen", de: "Lagerhalle", en: "Warehouse", effect: "+4 h Offline-Lager", visual: "Container am Hof", base: 300, growth: 2.6, max: 8, icon: "box" },
  { id: "schmieroel", group: "anlagen", de: "Schmieröl", en: "Machine oil", effect: "Rostige Maschinen behalten 10 % mehr", visual: "Ölfässer am Hof", base: 500, growth: 3, max: 4, icon: "oil" },
  { id: "halle_satzbau", group: "anlagen", de: "Satzbau-Halle ausbauen", en: "Expand sentence assembly", effect: "+25 % in dieser Halle", visual: "Stern am Hallenschild", base: 700, growth: 2.2, max: 12, icon: "hall" },
  { id: "halle_woerter", group: "anlagen", de: "Wortlager ausbauen", en: "Expand word warehouse", effect: "+25 % in dieser Halle", visual: "Stern am Hallenschild", base: 700, growth: 2.2, max: 12, icon: "hall" },
  { id: "halle_verben", group: "anlagen", de: "Verbschmiede ausbauen", en: "Expand verb forge", effect: "+25 % in dieser Halle", visual: "Stern am Hallenschild", base: 700, growth: 2.2, max: 12, icon: "hall" },
  { id: "halle_faelle", group: "anlagen", de: "Kasuswerk ausbauen", en: "Expand case works", effect: "+25 % in dieser Halle", visual: "Stern am Hallenschild", base: 700, growth: 2.2, max: 12, icon: "hall" },
  { id: "halle_redemittel", group: "anlagen", de: "Manufaktur ausbauen", en: "Expand phrase workshop", effect: "+25 % in dieser Halle", visual: "Stern am Hallenschild", base: 700, growth: 2.2, max: 12, icon: "hall" },
  // gebaeude: projects on the map, three levels each
  ...BUILDINGS.map(
    (id): UpgradeDef => ({
      id,
      group: "gebaeude",
      de: BUILDING_INFO[id].de,
      en: BUILDING_INFO[id].en,
      effect: effectText(BUILDING_EFFECT[id]),
      visual: BUILDING_INFO[id].visual,
      base: BUILDING_INFO[id].base,
      growth: BUILDING_GROWTH,
      max: BUILDING_LEVELS,
      icon: "home",
      tiers: [2, 3, 4],
      lastMult: 1.8,
    }),
  ),
];

export const UPGRADE_BY_ID = new Map(UPGRADES.map((u) => [u.id, u] as const));

export function upgradeCost(def: UpgradeDef, level: number): number {
  const raw = def.base * Math.pow(def.growth, level) * (level === def.max - 1 ? (def.lastMult ?? 1) : 1);
  // Two significant digits read well in the shop: 1.234.567 → 1.200.000.
  if (raw < 100) return Math.round(raw);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / mag) * mag;
}

export function level(upgrades: Partial<Record<UpgradeId, number>>, id: UpgradeId): number {
  return upgrades[id] ?? 0;
}

export function has(upgrades: Partial<Record<UpgradeId, number>>, id: BuildingId): boolean {
  return (upgrades[id] ?? 0) > 0;
}

/** Sum of one effect over all buildings, by level. */
export function buildingBonus(upgrades: Partial<Record<UpgradeId, number>>, key: keyof BuildingEffect): number {
  let sum = 0;
  for (const id of BUILDINGS) sum += (BUILDING_EFFECT[id][key] ?? 0) * Math.min(BUILDING_LEVELS, upgrades[id] ?? 0);
  return sum;
}

/** Export markets in the order they open; each adds its flag in front of the HQ. */
export const COUNTRIES: { de: string; code: string }[] = [
  { de: "Österreich", code: "at" },
  { de: "Schweiz", code: "ch" },
  { de: "Frankreich", code: "fr" },
  { de: "Italien", code: "it" },
  { de: "Niederlande", code: "nl" },
  { de: "Belgien", code: "be" },
  { de: "Polen", code: "pl" },
  { de: "Tschechien", code: "cz" },
  { de: "Dänemark", code: "dk" },
  { de: "Spanien", code: "es" },
  { de: "Schweden", code: "se" },
  { de: "Norwegen", code: "no" },
  { de: "Finnland", code: "fi" },
  { de: "Irland", code: "ie" },
  { de: "Portugal", code: "pt" },
  { de: "Griechenland", code: "gr" },
  { de: "Ungarn", code: "hu" },
  { de: "Rumänien", code: "ro" },
  { de: "Bulgarien", code: "bg" },
  { de: "Kroatien", code: "hr" },
  { de: "Slowenien", code: "si" },
  { de: "Slowakei", code: "sk" },
  { de: "Litauen", code: "lt" },
  { de: "Lettland", code: "lv" },
  { de: "Estland", code: "ee" },
  { de: "Luxemburg", code: "lu" },
  { de: "Island", code: "is" },
  { de: "Ukraine", code: "ua" },
  { de: "Japan", code: "jp" },
  { de: "Kanada", code: "ca" },
];
