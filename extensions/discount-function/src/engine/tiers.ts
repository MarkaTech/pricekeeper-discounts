import type { VolumeTier } from "./config";

/** Finds the highest tier a given quantity qualifies for, or null. */
export function resolveTier(tiers: VolumeTier[], quantity: number): VolumeTier | null {
  const sorted = [...tiers].sort((a, b) => b.minQuantity - a.minQuantity);
  return sorted.find((t) => quantity >= t.minQuantity) ?? null;
}

/**
 * CAMPAIGN aggregation: sum quantities of all targeted lines first, resolve
 * one tier from the total, then apply it per line. LINE aggregation resolves
 * a tier independently per line. Both modes share this same tier lookup.
 */
export function aggregateQuantity(lineQuantities: number[], aggregation: "LINE" | "CAMPAIGN" | undefined): number[] {
  if (aggregation !== "CAMPAIGN") return lineQuantities;
  const total = lineQuantities.reduce((sum, q) => sum + q, 0);
  return lineQuantities.map(() => total);
}
