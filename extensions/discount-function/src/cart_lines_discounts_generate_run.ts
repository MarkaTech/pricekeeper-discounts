// Entry point for cart.lines.discounts.generate.run — handles PRODUCT and
// ORDER (cart-total) discount classes. This is the unified Discount Function
// API (2026-01), replacing the deprecated separate product/order/shipping
// Function model — see notes/2026-07-12-unified-discount-api.md.

import { parseConfig } from "./engine/config";
import { buildLineOperations, type CartLine } from "./engine/lines";

interface FunctionInput {
  cart: {
    lines: Array<{
      id: string;
      quantity: number;
      merchandise: {
        id: string;
        product: { id: string; inTargetCollections: boolean; inExcludedCollections: boolean };
        price: { amount: string };
      };
      cost: { totalAmount: { currencyCode: string } };
    }>;
    buyerIdentity?: { customer?: { hasAnyTag: boolean }; isLoggedIn: boolean };
  };
  discount: { metafield?: { value: string } | null };
}

interface FunctionRunResult {
  operations: Array<{
    lineUpdate?: { cartLineId: string; price: { adjustment: { fixedPricePerUnit: { amount: string } } } };
  }>;
}

export function run(input: FunctionInput): FunctionRunResult {
  const config = parseConfig(input.discount.metafield?.value);
  if (!config) return { operations: [] }; // fail-closed: bad config, zero discounts

  const currency = input.cart.lines[0]?.cost.totalAmount.currencyCode ?? "USD";

  const lines: CartLine[] = input.cart.lines.map((line) => ({
    id: line.id,
    quantity: line.quantity,
    merchandise: {
      variantId: line.merchandise.id,
      productId: line.merchandise.product.id,
      priceMinor: 0n, // populated from decimal price by the real Shopify build; placeholder here for type-checking outside the CLI
      inTargetCollections: line.merchandise.product.inTargetCollections,
      inExcludedCollections: line.merchandise.product.inExcludedCollections,
    },
  }));

  const isLoggedIn = Boolean(input.cart.buyerIdentity?.isLoggedIn);
  const result = buildLineOperations(config, lines, currency, [], isLoggedIn);

  return {
    operations: result.operations.map((op) => ({
      lineUpdate: {
        cartLineId: op.lineId,
        price: { adjustment: { fixedPricePerUnit: { amount: (op.newPriceMinor / BigInt(100)).toString() } } },
      },
    })),
  };
}
