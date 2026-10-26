import type { HallId } from "../content/types";

export type UpgradeId =
  | "fliessband"
  | "meisterbrief"
  | "lagerhalle"
  | "schmieroel"
  | "kombipresse"
  | "schichtleiter"
  | "akkorduhr"
  | `halle_${HallId}`;

export interface UpgradeDef {
  id: UpgradeId;
  de: string;
  en: string;
  /** What one level does, shown in the shop. */
  effect: string;
  base: number;
  growth: number;
  max: number;
  icon: string;
}

export const UPGRADES: UpgradeDef[] = [
  { id: "fliessband", de: "Fließband", en: "Conveyor belt", effect: "+15 % idle production", base: 500, growth: 3, max: 6, icon: "belt" },
  { id: "meisterbrief", de: "Meisterbrief", en: "Master's certificate", effect: "+15 % Taler per sentence", base: 400, growth: 3, max: 8, icon: "medal" },
  { id: "lagerhalle", de: "Lagerhalle", en: "Warehouse", effect: "+4 h offline storage", base: 800, growth: 4, max: 4, icon: "box" },
  { id: "schmieroel", de: "Schmieröl", en: "Machine oil", effect: "Rusty machines keep 10 % more output", base: 1000, growth: 3, max: 4, icon: "oil" },
  { id: "kombipresse", de: "Kombi-Presse", en: "Combo press", effect: "Combo multiplier cap +0.5", base: 600, growth: 3, max: 4, icon: "press" },
  { id: "schichtleiter", de: "Schichtleiter", en: "Shift supervisor", effect: "+50 % shift bonus", base: 700, growth: 3, max: 5, icon: "helmet" },
  { id: "akkorduhr", de: "Akkord-Uhr", en: "Piecework clock", effect: "+15 s per speed round", base: 500, growth: 3, max: 3, icon: "clock" },
  { id: "halle_woerter", de: "Wortlager ausbauen", en: "Expand word warehouse", effect: "+25 % output in this hall", base: 1500, growth: 3, max: 4, icon: "hall" },
  { id: "halle_satzbau", de: "Satzbau-Halle ausbauen", en: "Expand sentence assembly", effect: "+25 % output in this hall", base: 1500, growth: 3, max: 4, icon: "hall" },
  { id: "halle_verben", de: "Verbschmiede ausbauen", en: "Expand verb forge", effect: "+25 % output in this hall", base: 1500, growth: 3, max: 4, icon: "hall" },
  { id: "halle_faelle", de: "Kasuswerk ausbauen", en: "Expand case works", effect: "+25 % output in this hall", base: 1500, growth: 3, max: 4, icon: "hall" },
  { id: "halle_redemittel", de: "Manufaktur ausbauen", en: "Expand phrase workshop", effect: "+25 % output in this hall", base: 1500, growth: 3, max: 4, icon: "hall" },
];

export const UPGRADE_BY_ID = new Map(UPGRADES.map((u) => [u.id, u] as const));

export function upgradeCost(def: UpgradeDef, level: number): number {
  return Math.round(def.base * Math.pow(def.growth, level));
}

export function level(upgrades: Partial<Record<UpgradeId, number>>, id: UpgradeId): number {
  return upgrades[id] ?? 0;
}
