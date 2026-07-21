// Entry point for cart.delivery-options.discounts.generate.run — the
// SHIPPING discount class (free-shipping campaigns), rewritten to match the
// real "deliveryDiscountsAdd" candidate shape confirmed by
// `shopify app generate extension` output.

import { parseConfig } from "./engine/config";
import { decimalToMinorUnits } from "./engine/money";

interface DeliveryInput {
  cart: {
    cost: { subtotalAmount: { amount: string; currencyCode: string } };
    deliveryGroups: Array<{ id: string; deliveryOptions: Array<{ handle: string }> }>;
  };
  discount: {
    discountClasses: string[];
    metafield?: { value: string } | null;
  };
}

export function cartDeliveryOptionsDiscountsGenerateRun(input: DeliveryInput) {
  const config = parseConfig(input.discount.metafield?.value);
  if (!config || config.type !== "FREE_SHIPPING") return { operations: [] };
  if (!input.discount.discountClasses.includes("SHIPPING")) return { operations: [] };

  const firstGroup = input.cart.deliveryGroups[0];
  if (!firstGroup) return { operations: [] };

  const currency = input.cart.cost.subtotalAmount.currencyCode;
  const subtotalMinor = decimalToMinorUnits(input.cart.cost.subtotalAmount.amount, currency);

  const minSubtotal = config.minSubtotalOverrides?.[currency] ?? config.minSubtotal;
  if (minSubtotal !== undefined) {
    const thresholdMinor = decimalToMinorUnits(minSubtotal, currency);
    if (subtotalMinor < thresholdMinor) return { operations: [] };
  }

  const percentageOff = config.fullShipping === false ? (config.shippingPercentage ?? 0) : 100;
  if (percentageOff <= 0) return { operations: [] };

  return {
    operations: [
      {
        deliveryDiscountsAdd: {
          candidates: [
            {
              message: "FREE SHIPPING",
              targets: [{ deliveryGroup: { id: firstGroup.id } }],
              value: { percentage: { value: percentageOff } },
            },
          ],
          selectionStrategy: "ALL",
        },
      },
    ],
  };
}
