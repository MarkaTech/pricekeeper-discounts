import { describe, it, expect } from "vitest";
import { resolveTier, aggregateQuantity } from "../src/engine/tiers";

describe("tiers.ts", () => {
  const tiers = [
    { minQuantity: 3, percentage: 10 },
    { minQuantity: 6, percentage: 15 },
    { minQuantity: 12, percentage: 20 },
  ];

  it("resolves the highest qualifying tier", () => {
    expect(resolveTier(tiers, 2)).toBeNull();
    expect(resolveTier(tiers, 3)?.percentage).toBe(10);
    expect(resolveTier(tiers, 7)?.percentage).toBe(15);
    expect(resolveTier(tiers, 20)?.percentage).toBe(20);
  });

  it("LINE aggregation leaves quantities untouched", () => {
    expect(aggregateQuantity([3, 5], "LINE")).toEqual([3, 5]);
  });

  it("CAMPAIGN aggregation sums across all lines", () => {
    expect(aggregateQuantity([3, 5], "CAMPAIGN")).toEqual([8, 8]);
  });
});
