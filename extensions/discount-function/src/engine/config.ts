// CampaignConfig type + parseConfig. Fail-closed: any malformed config
// produces zero discounts, never a throw — a bad JSON blob must never crash
// checkout. This is the single source of truth a campaign's admin row and
// the live preview both feed through.

export type CampaignType =
  | "PERCENTAGE"
  | "FIXED_AMOUNT"
  | "NEW_PRICE"
  | "VOLUME"
  | "BOGO"
  | "CART_TOTAL"
  | "FREE_SHIPPING";

export interface Targeting {
  scope: "STORE" | "COLLECTIONS" | "PRODUCTS" | "VARIANTS";
  collectionIds?: string[];
  excludedCollectionIds?: string[];
  productIds?: string[];
  excludedProductIds?: string[];
  variantIds?: string[];
  customerTags?: string[];
  requiresLogin?: boolean;
}

export interface VolumeTier {
  minQuantity: number;
  percentage: number;
}

export interface BogoConfig {
  buyQuantity: number;
  getQuantity: number;
  getDiscountPercentage: number; // 100 = free gift
  samePool?: boolean;
  maxRepeats?: number;
}

export interface CampaignConfig {
  type: CampaignType;
  targeting: Targeting;
  percentage?: number;
  amount?: number;
  currencyOverrides?: Record<string, number>; // per-currency fixed amount/new price
  newPrice?: number;
  tiers?: VolumeTier[];
  tierAggregation?: "LINE" | "CAMPAIGN";
  bogo?: BogoConfig;
  minSubtotal?: string; // decimal string, money-minor-unit safe
  minSubtotalOverrides?: Record<string, string>;
  fullShipping?: boolean;
  shippingPercentage?: number;
  combinesWith?: { order?: boolean; product?: boolean; shipping?: boolean };
}

/**
 * Fail-closed config parser: malformed input returns null (zero discounts),
 * it never throws. Called both by the Function entry points and by the
 * admin's preview.server.ts, so preview and checkout always agree.
 */
export function parseConfig(raw: string | null | undefined): CampaignConfig | null {
  if (!raw) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  if (!isValidType(parsed.type)) return null;
  if (!parsed.targeting || !isValidScope(parsed.targeting.scope)) return null;

  switch (parsed.type as CampaignType) {
    case "PERCENTAGE":
    case "CART_TOTAL":
      if (typeof parsed.percentage !== "number" || parsed.percentage <= 0 || parsed.percentage > 100) return null;
      break;
    case "FIXED_AMOUNT":
      if (typeof parsed.amount !== "number" || parsed.amount <= 0) return null;
      break;
    case "NEW_PRICE":
      if (typeof parsed.newPrice !== "number" || parsed.newPrice < 0) return null;
      break;
    case "VOLUME":
      if (!Array.isArray(parsed.tiers) || parsed.tiers.length === 0) return null;
      if (parsed.tiers.some((t: any) => !(t.minQuantity > 0) || !(t.percentage > 0 && t.percentage <= 100))) return null;
      break;
    case "BOGO":
      if (!parsed.bogo || !(parsed.bogo.buyQuantity >= 1) || !(parsed.bogo.getQuantity >= 1)) return null;
      break;
    case "FREE_SHIPPING":
      break;
    default:
      return null;
  }

  return parsed as CampaignConfig;
}

function isValidType(t: unknown): t is CampaignType {
  return ["PERCENTAGE", "FIXED_AMOUNT", "NEW_PRICE", "VOLUME", "BOGO", "CART_TOTAL", "FREE_SHIPPING"].includes(t as string);
}

function isValidScope(s: unknown): s is Targeting["scope"] {
  return ["STORE", "COLLECTIONS", "PRODUCTS", "VARIANTS"].includes(s as string);
}
