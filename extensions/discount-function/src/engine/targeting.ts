import type { Targeting } from "./config";

export interface TargetableMerchandise {
  variantId: string;
  productId: string;
  inTargetCollections?: boolean;
  inExcludedCollections?: boolean;
  customerTags?: string[];
  isLoggedIn?: boolean;
}

/**
 * Membership is resolved by Shopify's own inAnyCollection at the checkout
 * input-query level (see docs/scale-targeting.md) — this function only
 * combines those pre-resolved booleans with product/variant ID matching and
 * customer gating. It never enumerates a collection's products itself, which
 * is what keeps this O(1) regardless of collection size.
 */
export function isTargeted(
  targeting: Targeting,
  merch: TargetableMerchandise,
  cartCustomerTags: string[] = [],
  isLoggedIn = false,
): boolean {
  if (merch.inExcludedCollections) return false;
  if (targeting.excludedProductIds?.includes(merch.productId)) return false;

  if (targeting.requiresLogin && !isLoggedIn) return false;

  if (targeting.customerTags && targeting.customerTags.length > 0) {
    const hasTag = targeting.customerTags.some((tag) => cartCustomerTags.includes(tag));
    if (!hasTag) return false;
  }

  switch (targeting.scope) {
    case "STORE":
      return true;
    case "COLLECTIONS":
      return Boolean(merch.inTargetCollections);
    case "PRODUCTS":
      return Boolean(targeting.productIds?.includes(merch.productId));
    case "VARIANTS":
      return Boolean(targeting.variantIds?.includes(merch.variantId));
    default:
      return false;
  }
}
