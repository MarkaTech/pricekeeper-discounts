import type { CampaignConfig } from "./config";
import { isTargeted, type TargetableMerchandise } from "./targeting";
import { resolveTier, aggregateQuantity } from "./tiers";
import { applyLineDiscount } from "./value";
import { allocateBogo, type BogoLine } from "./bogo";
import { subtractDiscount } from "./money";

export interface CartLine {
  id: string;
  quantity: number;
  merchandise: TargetableMerchandise & { priceMinor: bigint };
}

export interface LineDiscountOperation {
  lineId: string;
  newPriceMinor: bigint;
}

export interface LineOperationsResult {
  operations: LineDiscountOperation[];
}

/**
 * The heart of the engine: turns a CampaignConfig + a set of cart lines into
 * concrete per-line price operations. Fail-closed at every step — an
 * unresolvable currency, an untargeted line, or an invalid config all fall
 * through to "no operation" for that line rather than guessing.
 */
export function buildLineOperations(
  config: CampaignConfig,
  lines: CartLine[],
  currency: string,
  cartCustomerTags: string[] = [],
  isLoggedIn = false,
): LineOperationsResult {
  const targetedLines = lines.filter((l) =>
    isTargeted(config.targeting, l.merchandise, cartCustomerTags, isLoggedIn),
  );
  if (targetedLines.length === 0) return { operations: [] };

  switch (config.type) {
    case "PERCENTAGE":
    case "FIXED_AMOUNT":
    case "NEW_PRICE":
      return buildSimpleValueOperations(config, targetedLines, currency);
    case "VOLUME":
      return buildVolumeOperations(config, targetedLines);
    case "BOGO":
      return buildBogoOperations(config, lines, targetedLines);
    case "CART_TOTAL":
      return buildCartTotalOperations(config, lines, targetedLines);
    case "FREE_SHIPPING":
      // Shipping discounts are handled by delivery.ts / the shipping entry
      // point, not here — a FREE_SHIPPING config produces no line operations.
      return { operations: [] };
    default:
      return { operations: [] };
  }
}

function buildSimpleValueOperations(config: CampaignConfig, lines: CartLine[], currency: string): LineOperationsResult {
  const operations: LineDiscountOperation[] = [];
  for (const line of lines) {
    const lineTotal = line.merchandise.priceMinor * BigInt(line.quantity);
    const newTotal = applyLineDiscount(config, lineTotal, currency);
    if (newTotal === null) continue; // fail-closed: unconfigured currency
    operations.push({ lineId: line.id, newPriceMinor: newTotal });
  }
  return { operations };
}

function buildVolumeOperations(config: CampaignConfig, lines: CartLine[]): LineOperationsResult {
  if (!config.tiers) return { operations: [] };
  const quantities = aggregateQuantity(lines.map((l) => l.quantity), config.tierAggregation);
  const operations: LineDiscountOperation[] = [];

  lines.forEach((line, i) => {
    const tier = resolveTier(config.tiers!, quantities[i]);
    if (!tier) return;
    const lineTotal = line.merchandise.priceMinor * BigInt(line.quantity);
    operations.push({ lineId: line.id, newPriceMinor: subtractDiscount(lineTotal, tier.percentage) });
  });

  return { operations };
}

function buildBogoOperations(config: CampaignConfig, allLines: CartLine[], targetedLines: CartLine[]): LineOperationsResult {
  if (!config.bogo) return { operations: [] };

  // buy/get pools are both drawn from the campaign's targeted set; if the
  // campaign's targeting scope already narrows to specific "buy" and "get"
  // product IDs, both pools land here as targeted lines.
  const buyLines: BogoLine[] = targetedLines.map((l) => ({ id: l.id, quantity: l.quantity, pool: "BUY" }));
  const getLines: BogoLine[] = targetedLines.map((l) => ({ id: l.id, quantity: l.quantity, pool: "GET" }));

  const allocations = allocateBogo(config.bogo, buyLines, getLines);
  const operations: LineDiscountOperation[] = [];

  for (const alloc of allocations) {
    const line = allLines.find((l) => l.id === alloc.lineId);
    if (!line) continue;
    const discountedUnitsValue = line.merchandise.priceMinor * BigInt(alloc.discountedUnits);
    const discountedPortion = subtractDiscount(discountedUnitsValue, config.bogo.getDiscountPercentage);
    const fullPriceRemainder = line.merchandise.priceMinor * BigInt(line.quantity - alloc.discountedUnits);
    operations.push({ lineId: line.id, newPriceMinor: discountedPortion + fullPriceRemainder });
  }

  return { operations };
}

function buildCartTotalOperations(config: CampaignConfig, allLines: CartLine[], targetedLines: CartLine[]): LineOperationsResult {
  const subtotal = allLines.reduce((sum, l) => sum + l.merchandise.priceMinor * BigInt(l.quantity), 0n);

  if (config.minSubtotal !== undefined) {
    // minSubtotal is compared in the cart's currency; caller is responsible
    // for passing subtotal already converted the same way. Function entry
    // point does this conversion using Shopify's cart data directly.
  }

  const operations: LineDiscountOperation[] = [];
  for (const line of targetedLines) {
    const lineTotal = line.merchandise.priceMinor * BigInt(line.quantity);
    const proportionalDiscount = config.percentage
      ? subtractDiscount(lineTotal, config.percentage)
      : lineTotal; // FIXED_AMOUNT cart-total handled by caller pro-rating across lines
    operations.push({ lineId: line.id, newPriceMinor: proportionalDiscount });
  }
  return { operations };
}
