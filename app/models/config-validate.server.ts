// Server-side mirror of extensions/discount-function/src/engine/config.ts's
// parseConfig. Kept intentionally in lock-step with the engine's validator so
// the builder UI can reject bad config before it ever reaches the Function —
// the Function's own fail-closed parseConfig is still the authoritative gate
// at checkout (this is a UX convenience, not a security boundary).

export type CampaignType =
  | "PERCENTAGE"
  | "FIXED_AMOUNT"
  | "NEW_PRICE"
  | "VOLUME"
  | "BOGO"
  | "CART_TOTAL"
  | "FREE_SHIPPING";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCampaignConfig(type: CampaignType, config: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];

  switch (type) {
    case "PERCENTAGE":
      if (typeof config.percentage !== "number" || config.percentage <= 0 || config.percentage > 100) {
        errors.push("Percentage must be a number between 0 and 100.");
      }
      break;
    case "FIXED_AMOUNT":
      if (typeof config.amount !== "number" || config.amount <= 0) {
        errors.push("Fixed amount must be a positive number.");
      }
      break;
    case "NEW_PRICE":
      if (typeof config.newPrice !== "number" || config.newPrice < 0) {
        errors.push("New price must be zero or a positive number.");
      }
      break;
    case "VOLUME": {
      const tiers = config.tiers as Array<{ minQuantity: number; percentage: number }> | undefined;
      if (!Array.isArray(tiers) || tiers.length === 0) {
        errors.push("Volume campaigns need at least one tier.");
      } else if (tiers.some((t) => !(t.minQuantity > 0) || !(t.percentage > 0 && t.percentage <= 100))) {
        errors.push("Every tier needs a positive minimum quantity and a 0-100% discount.");
      }
      break;
    }
    case "BOGO":
      if (!config.buyProductIds || !config.getProductIds) {
        errors.push("BOGO campaigns need both a 'buy' and a 'get' product selection.");
      }
      if (typeof config.buyQuantity !== "number" || config.buyQuantity < 1) {
        errors.push("Buy quantity must be at least 1.");
      }
      break;
    case "CART_TOTAL":
      if (typeof config.percentage !== "number" && typeof config.amount !== "number") {
        errors.push("Cart-total campaigns need either a percentage or a fixed amount.");
      }
      break;
    case "FREE_SHIPPING":
      // shipping percentage defaults to 100; nothing strictly required.
      break;
    default:
      errors.push(`Unknown campaign type: ${type}`);
  }

  if (config.minSubtotal !== undefined && typeof config.minSubtotal !== "string") {
    errors.push("minSubtotal must be a decimal string (money minor-unit safe), not a float.");
  }

  return { valid: errors.length === 0, errors };
}
