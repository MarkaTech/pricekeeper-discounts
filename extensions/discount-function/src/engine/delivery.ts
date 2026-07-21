import type { CampaignConfig } from "./config";
import { decimalToMinorUnits } from "./money";

export interface DeliveryOption {
  handle: string;
  totalPriceMinor: bigint;
}

export interface DeliveryDiscountOperation {
  handle: string;
  percentageOff: number;
}

/** Cart-total gated free shipping: only applies once the subtotal threshold is met. */
export function buildDeliveryOperations(
  config: CampaignConfig,
  deliveryOptions: DeliveryOption[],
  cartSubtotalMinor: bigint,
  currency: string,
): DeliveryDiscountOperation[] {
  if (config.type !== "FREE_SHIPPING") return [];

  const minSubtotal = config.minSubtotalOverrides?.[currency] ?? config.minSubtotal;
  if (minSubtotal !== undefined) {
    const thresholdMinor = decimalToMinorUnits(minSubtotal, currency);
    if (cartSubtotalMinor < thresholdMinor) return [];
  }

  const percentageOff = config.fullShipping === false ? (config.shippingPercentage ?? 0) : 100;
  if (percentageOff <= 0) return [];

  return deliveryOptions.map((opt) => ({ handle: opt.handle, percentageOff }));
}
