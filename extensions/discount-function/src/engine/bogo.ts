import type { BogoConfig } from "./config";

export interface BogoLine {
  id: string;
  quantity: number;
  pool: "BUY" | "GET";
}

export interface BogoAllocation {
  lineId: string;
  discountedUnits: number;
}

/**
 * Buy X Get Y allocation, including 100%-off free gifts. samePool=false means
 * buy and get products are distinct (the common case: "buy a grinder, get
 * free filters"); samePool=true allows buy/get within the same product set
 * (e.g. "buy 2 mugs, get 1 free"). maxRepeats caps how many times the
 * buy/get ratio can apply in one cart (undefined = unlimited).
 */
export function allocateBogo(config: BogoConfig, buyLines: BogoLine[], getLines: BogoLine[]): BogoAllocation[] {
  const totalBuyQty = buyLines.reduce((sum, l) => sum + l.quantity, 0);
  let repeats = Math.floor(totalBuyQty / config.buyQuantity);
  if (config.maxRepeats !== undefined) repeats = Math.min(repeats, config.maxRepeats);
  if (repeats <= 0) return [];

  let unitsToDiscount = repeats * config.getQuantity;
  const allocations: BogoAllocation[] = [];

  for (const line of getLines) {
    if (unitsToDiscount <= 0) break;
    const take = Math.min(line.quantity, unitsToDiscount);
    if (take > 0) {
      allocations.push({ lineId: line.id, discountedUnits: take });
      unitsToDiscount -= take;
    }
  }

  return allocations;
}
