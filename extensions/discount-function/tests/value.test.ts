import { describe, it, expect } from "vitest";
import { applyLineDiscount, resolveForCurrency } from "../src/engine/value";
import type { CampaignConfig } from "../src/engine/config";

describe("value.ts — multi-currency fail-closed behavior", () => {
  it("PERCENTAGE always resolves regardless of currency config", () => {
    const config: CampaignConfig = { type: "PERCENTAGE", percentage: 20, targeting: { scope: "STORE" } };
    expect(resolveForCurrency(config, "EUR")).not.toBeNull();
    expect(applyLineDiscount(config, 1000n, "EUR")).toBe(800n);
  });

  it("FIXED_AMOUNT with no currencyOverrides for EUR gives NO discount, not a misconversion", () => {
    const config: CampaignConfig = {
      type: "FIXED_AMOUNT",
      amount: 5,
      currencyOverrides: { USD: 5 },
      targeting: { scope: "STORE" },
    };
    expect(applyLineDiscount(config, 1000n, "EUR")).toBeNull();
    expect(applyLineDiscount(config, 1000n, "USD")).toBe(500n);
  });

  it("NEW_PRICE with no currencyOverrides for JPY gives NO discount", () => {
    const config: CampaignConfig = {
      type: "NEW_PRICE",
      newPrice: 10,
      currencyOverrides: { USD: 10 },
      targeting: { scope: "STORE" },
    };
    expect(applyLineDiscount(config, 2000n, "JPY")).toBeNull();
  });

  it("FIXED_AMOUNT never discounts below zero", () => {
    const config: CampaignConfig = {
      type: "FIXED_AMOUNT",
      amount: 50,
      currencyOverrides: { USD: 50 },
      targeting: { scope: "STORE" },
    };
    expect(applyLineDiscount(config, 100n, "USD")).toBe(0n);
  });
});
