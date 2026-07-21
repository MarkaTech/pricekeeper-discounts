// Entry point for cart.lines.discounts.generate.run on the current (2026-04)
// unified Discount Function API. Rewritten to match Shopify's real
// "productDiscountsAdd" / "orderDiscountsAdd" candidate-based operations
// (verified against `shopify app generate extension` output) rather than the
// older direct-price-override shape this file originally assumed.
//
// The lower-level engine pieces (parseConfig, isTargeted, resolveTier,
// allocateBogo, money math) are unchanged and still do the actual pricing
// decisions — only how their results get expressed as Function operations
// has changed here.

import { parseConfig } from "./engine/config";
import { isTargeted } from "./engine/targeting";
import { resolveTier, aggregateQuantity } from "./engine/tiers";
import { allocateBogo } from "./engine/bogo";
import { decimalToMinorUnits, minorUnitsToDecimal, subtractDiscount } from "./engine/money";

// Minimal hand-written types matching cart_lines_discounts_generate_run.graphql.
// Run `npm run typegen` on a machine with Shopify CLI + network access to
// generate the real `../generated/api.ts` types and swap these for stricter
// checking; the JS logic below doesn't depend on which types back it.
interface CartLine {
  id: string;
  quantity: number;
  cost: { totalAmount: { amount: string; currencyCode: string } };
  merchandise: {
    id: string;
    price: { amount: string };
    product: { id: string; collections: { nodes: Array<{ id: string }> } };
  };
}

interface CartInput {
  cart: {
    lines: CartLine[];
    buyerIdentity?: { isLoggedIn: boolean };
  };
  discount: {
    discountClasses: string[]; // "ORDER" | "PRODUCT" | "SHIPPING"
    metafield?: { value: string } | null;
  };
}

export function cartLinesDiscountsGenerateRun(input: CartInput) {
  const config = parseConfig(input.discount.metafield?.value);
  if (!config || input.cart.lines.length === 0) return { operations: [] };

  const currency = input.cart.lines[0]?.cost.totalAmount.currencyCode ?? "USD";
  const isLoggedIn = Boolean(input.cart.buyerIdentity?.isLoggedIn);

  const hasProductClass = input.discount.discountClasses.includes("PRODUCT");
  const hasOrderClass = input.discount.discountClasses.includes("ORDER");

  // Adapt raw collection-membership data to the boolean shape isTargeted
  // expects. Only the product's first 250 collections are fetched — see
  // docs/scale-targeting.md for why that limit is effectively never hit.
  const targetedLines = input.cart.lines.filter((line) => {
    const collectionIds = line.merchandise.product.collections.nodes.map((c) => c.id);
    const inTarget = collectionIds.some((id) => config.targeting.collectionIds?.includes(id));
    const inExcluded = collectionIds.some((id) => config.targeting.excludedCollectionIds?.includes(id));
    return isTargeted(
      config.targeting,
      {
        variantId: line.merchandise.id,
        productId: line.merchandise.product.id,
        inTargetCollections: inTarget,
        inExcludedCollections: inExcluded,
      },
      [],
      isLoggedIn,
    );
  });

  if (targetedLines.length === 0) return { operations: [] };

  switch (config.type) {
    case "PERCENTAGE":
      return hasProductClass ? percentageOperations(targetedLines, config.percentage!) : { operations: [] };

    case "FIXED_AMOUNT": {
      if (!hasProductClass) return { operations: [] };
      const override = config.currencyOverrides?.[currency];
      if (override === undefined) return { operations: [] }; // fail-closed: unconfigured currency
      return fixedAmountOperations(targetedLines, decimalToMinorUnits(String(override), currency), currency);
    }

    case "NEW_PRICE": {
      if (!hasProductClass) return { operations: [] };
      const override = config.currencyOverrides?.[currency];
      if (override === undefined) return { operations: [] };
      const newPriceMinor = decimalToMinorUnits(String(override), currency);
      return newPriceOperations(targetedLines, newPriceMinor, currency);
    }

    case "VOLUME":
      return hasProductClass ? volumeOperations(targetedLines, config) : { operations: [] };

    case "BOGO":
      return hasProductClass ? bogoOperations(targetedLines, config) : { operations: [] };

    case "CART_TOTAL":
      return hasOrderClass ? cartTotalOperations(input.cart.lines, config) : { operations: [] };

    case "FREE_SHIPPING":
      // Shipping is handled entirely by cart_delivery_options_discounts_generate_run.
      return { operations: [] };

    default:
      return { operations: [] };
  }
}

function percentageOperations(lines: CartLine[], percentage: number) {
  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: lines.map((line) => ({
            message: `${percentage}% OFF`,
            targets: [{ cartLine: { id: line.id } }],
            value: { percentage: { value: percentage } },
          })),
          selectionStrategy: "ALL",
        },
      },
    ],
  };
}

function fixedAmountOperations(lines: CartLine[], amountOffPerUnitMinor: bigint, currency: string) {
  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: lines.map((line) => ({
            message: "AMOUNT OFF",
            targets: [{ cartLine: { id: line.id } }],
            value: { fixedAmount: { amount: minorUnitsToDecimal(amountOffPerUnitMinor, currency) } },
          })),
          selectionStrategy: "ALL",
        },
      },
    ],
  };
}

function newPriceOperations(lines: CartLine[], newPriceMinor: bigint, currency: string) {
  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: lines.flatMap((line) => {
            const currentPriceMinor = decimalToMinorUnits(line.merchandise.price.amount, currency);
            const offMinor = currentPriceMinor - newPriceMinor;
            if (offMinor <= 0n) return []; // never a negative/zero discount
            return [
              {
                message: "SPECIAL PRICE",
                targets: [{ cartLine: { id: line.id } }],
                value: { fixedAmount: { amount: minorUnitsToDecimal(offMinor, currency) } },
              },
            ];
          }),
          selectionStrategy: "ALL",
        },
      },
    ],
  };
}

function volumeOperations(lines: CartLine[], config: ReturnType<typeof parseConfig> & object) {
  if (!config.tiers) return { operations: [] };
  const quantities = aggregateQuantity(lines.map((l) => l.quantity), config.tierAggregation);

  const candidates = lines.flatMap((line, i) => {
    const tier = resolveTier(config.tiers!, quantities[i]);
    if (!tier) return [];
    return [
      {
        message: `VOLUME DISCOUNT ${tier.percentage}%`,
        targets: [{ cartLine: { id: line.id } }],
        value: { percentage: { value: tier.percentage } },
      },
    ];
  });

  if (candidates.length === 0) return { operations: [] };
  return { operations: [{ productDiscountsAdd: { candidates, selectionStrategy: "ALL" } }] };
}

function bogoOperations(lines: CartLine[], config: ReturnType<typeof parseConfig> & object) {
  if (!config.bogo) return { operations: [] };

  const buyLines = lines.map((l) => ({ id: l.id, quantity: l.quantity, pool: "BUY" as const }));
  const getLines = lines.map((l) => ({ id: l.id, quantity: l.quantity, pool: "GET" as const }));
  const allocations = allocateBogo(config.bogo, buyLines, getLines);
  if (allocations.length === 0) return { operations: [] };

  // Express each allocation as a percentage-off candidate scoped to the
  // discounted unit count via a cartLine target with quantity — the exact
  // per-unit targeting field name should be checked against the real
  // generated types (`npm run typegen`) and adjusted if it differs.
  const candidates = allocations.map((alloc) => ({
    message: "FREE GIFT",
    targets: [{ cartLine: { id: alloc.lineId, quantity: alloc.discountedUnits } }],
    value: { percentage: { value: config.bogo!.getDiscountPercentage } },
  }));

  return { operations: [{ productDiscountsAdd: { candidates, selectionStrategy: "ALL" } }] };
}

function cartTotalOperations(allLines: CartLine[], config: ReturnType<typeof parseConfig> & object) {
  if (config.percentage === undefined) return { operations: [] };
  return {
    operations: [
      {
        orderDiscountsAdd: {
          candidates: [
            {
              message: `${config.percentage}% OFF ORDER`,
              targets: [{ orderSubtotal: { excludedCartLineIds: [] } }],
              value: { percentage: { value: config.percentage } },
            },
          ],
          selectionStrategy: "FIRST",
        },
      },
    ],
  };
}
