import { describe, it, expect } from "vitest";
import { buildLineOperations, type CartLine } from "../src/engine/lines";
import type { CampaignConfig } from "../src/engine/config";

function line(id: string, quantity: number, priceMinor: bigint, overrides: Partial<CartLine["merchandise"]> = {}): CartLine {
  return {
    id,
    quantity,
    merchandise: { variantId: `${id}-variant`, productId: `${id}-product`, priceMinor, ...overrides },
  };
}

describe("lines.ts — end-to-end engine wiring", () => {
  it("PERCENTAGE campaign discounts only targeted lines", () => {
    const config: CampaignConfig = { type: "PERCENTAGE", percentage: 20, targeting: { scope: "COLLECTIONS" } };
    const lines = [
      line("a", 1, 1000n, { inTargetCollections: true }),
      line("b", 1, 1000n, { inTargetCollections: false }),
    ];
    const result = buildLineOperations(config, lines, "USD");
    expect(result.operations).toEqual([{ lineId: "a", newPriceMinor: 800n }]);
  });

  it("VOLUME campaign applies the resolved tier per line", () => {
    const config: CampaignConfig = {
      type: "VOLUME",
      tiers: [{ minQuantity: 3, percentage: 10 }],
      targeting: { scope: "STORE" },
    };
    const lines = [line("a", 3, 1000n)];
    const result = buildLineOperations(config, lines, "USD");
    expect(result.operations).toEqual([{ lineId: "a", newPriceMinor: 2700n }]); // 3000 - 10%
  });

  it("empty cart / no targeted lines returns no operations", () => {
    const config: CampaignConfig = { type: "PERCENTAGE", percentage: 20, targeting: { scope: "PRODUCTS", productIds: ["nonexistent"] } };
    const result = buildLineOperations(config, [line("a", 1, 1000n)], "USD");
    expect(result.operations).toEqual([]);
  });

  it("FIXED_AMOUNT in an unconfigured currency yields zero operations (fail-closed)", () => {
    const config: CampaignConfig = {
      type: "FIXED_AMOUNT",
      amount: 5,
      currencyOverrides: { USD: 5 },
      targeting: { scope: "STORE" },
    };
    const result = buildLineOperations(config, [line("a", 1, 1000n)], "EUR");
    expect(result.operations).toEqual([]);
  });

  it("FREE_SHIPPING config produces no line operations (handled by delivery.ts instead)", () => {
    const config: CampaignConfig = { type: "FREE_SHIPPING", targeting: { scope: "STORE" } };
    const result = buildLineOperations(config, [line("a", 1, 1000n)], "USD");
    expect(result.operations).toEqual([]);
  });
});
