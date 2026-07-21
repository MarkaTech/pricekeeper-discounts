import type { CampaignConfig } from "./config";
import { subtractDiscount, decimalToMinorUnits } from "./money";

/**
 * Resolves a fixed-amount or new-price discount for a given presentment
 * currency. Multi-currency fail-closed behavior: if the campaign hasn't
 * been explicitly configured for this currency, returns null — meaning NO
 * discount is applied, rather than silently misconverting between
 * currencies. Percentage-based campaigns don't need this: a percentage
 * applies correctly in every currency without configuration.
 */
export function resolveForCurrency(config: CampaignConfig, currency: string): { minorAmount: bigint } | null {
  if (config.type === "PERCENTAGE" || config.type === "CART_TOTAL") {
    // Percentage math doesn't need per-currency config; always resolvable.
    return { minorAmount: 0n };
  }

  if (config.type === "FIXED_AMOUNT") {
    const override = config.currencyOverrides?.[currency];
    if (override === undefined) return null;
    return { minorAmount: decimalToMinorUnits(String(override), currency) };
  }

  if (config.type === "NEW_PRICE") {
    const override = config.currencyOverrides?.[currency];
    if (override === undefined) return null;
    return { minorAmount: decimalToMinorUnits(String(override), currency) };
  }

  return null;
}

export function applyLineDiscount(config: CampaignConfig, lineTotalMinor: bigint, currency: string): bigint | null {
  switch (config.type) {
    case "PERCENTAGE":
      return subtractDiscount(lineTotalMinor, config.percentage!);
    case "FIXED_AMOUNT": {
      const resolved = resolveForCurrency(config, currency);
      if (!resolved) return null; // fail-closed: unconfigured currency, no discount
      const result = lineTotalMinor - resolved.minorAmount;
      return result < 0n ? 0n : result;
    }
    case "NEW_PRICE": {
      const resolved = resolveForCurrency(config, currency);
      if (!resolved) return null;
      return resolved.minorAmount;
    }
    default:
      return null;
  }
}
