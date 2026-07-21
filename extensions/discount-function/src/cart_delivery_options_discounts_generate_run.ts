// Entry point for cart.delivery-options.discounts.generate.run — the
// SHIPPING discount class (free-shipping campaigns).

import { parseConfig } from "./engine/config";
import { buildDeliveryOperations, type DeliveryOption } from "./engine/delivery";
import { decimalToMinorUnits } from "./engine/money";

interface FunctionInput {
  cart: {
    cost: { subtotalAmount: { amount: string; currencyCode: string } };
    deliveryGroups: Array<{ deliveryOptions: Array<{ handle: string }> }>;
  };
  discount: { metafield?: { value: string } | null };
}

interface FunctionRunResult {
  operations: Array<{
    deliveryDiscountsAdd?: { candidates: Array<{ value: { percentage: { value: number } }; targets: Array<{ deliveryOption: { handle: string } }>; message?: string }> };
  }>;
}

export function run(input: FunctionInput): FunctionRunResult {
  const config = parseConfig(input.discount.metafield?.value);
  if (!config) return { operations: [] };

  const currency = input.cart.cost.subtotalAmount.currencyCode;
  const subtotalMinor = decimalToMinorUnits(input.cart.cost.subtotalAmount.amount, currency);

  const options: DeliveryOption[] = input.cart.deliveryGroups.flatMap((g) =>
    g.deliveryOptions.map((opt) => ({ handle: opt.handle, totalPriceMinor: 0n })),
  );

  const ops = buildDeliveryOperations(config, options, subtotalMinor, currency);
  if (ops.length === 0) return { operations: [] };

  return {
    operations: [
      {
        deliveryDiscountsAdd: {
          candidates: ops.map((op) => ({
            value: { percentage: { value: op.percentageOff } },
            targets: [{ deliveryOption: { handle: op.handle } }],
            message: "Free shipping",
          })),
        },
      },
    ],
  };
}
