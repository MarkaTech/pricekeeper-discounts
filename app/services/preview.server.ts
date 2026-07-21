// Live preview: runs the REAL engine against a synthetic cart built from a
// real product, so what the merchant sees is exactly what checkout computes.
// Known limit: fetches only the product's first 250 collections — a product
// in 250+ collections could preview as "not targeted" while checkout (which
// resolves membership authoritatively) still discounts it. Practically
// irrelevant since products rarely belong to 250+ collections.

import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { buildLineOperations, type CartLine } from "../../extensions/discount-function/src/engine/lines";
import { parseConfig } from "../../extensions/discount-function/src/engine/config";

const PREVIEW_PRODUCT_QUERY = `#graphql
  query PreviewProduct($id: ID!) {
    product(id: $id) {
      id
      collections(first: 250) { nodes { id } }
      variants(first: 50) {
        nodes {
          id
          price
          product { id }
        }
      }
    }
  }
`;

export async function previewCampaign(
  admin: AdminApiContext,
  configJson: string,
  productId: string,
  variantId: string,
  quantity: number,
  presentmentCurrency: string,
) {
  const response = await admin.graphql(PREVIEW_PRODUCT_QUERY, { variables: { id: productId } });
  const data = await response.json();
  const product = data.data.product;
  const variant = product.variants.nodes.find((v: any) => v.id === variantId) ?? product.variants.nodes[0];

  const config = parseConfig(configJson);
  if (!config) {
    return { discounted: false, reason: "Invalid campaign configuration — no discount would apply." };
  }

  const collectionIds: string[] = product.collections.nodes.map((c: any) => c.id);
  const line: CartLine = {
    id: "preview-line-1",
    quantity,
    merchandise: {
      variantId: variant.id,
      productId: product.id,
      priceMinor: toMinorUnits(variant.price, presentmentCurrency),
      inTargetCollections: collectionIds.some((id) => config.targeting.collectionIds?.includes(id)),
      inExcludedCollections: collectionIds.some((id) => config.targeting.excludedCollectionIds?.includes(id)),
    },
  };

  const result = buildLineOperations(config, [line], presentmentCurrency);
  if (result.operations.length === 0) {
    return { discounted: false, reason: "This cart gets no discount from this campaign." };
  }
  return { discounted: true, operations: result.operations };
}

function toMinorUnits(decimalPrice: string, currency: string): bigint {
  // Mirrors extensions/discount-function/src/engine/money.ts exponent table
  // for the admin-side preview only; the Function itself is the source of truth.
  const zeroDecimal = new Set(["JPY", "KRW", "VND"]);
  const threeDecimal = new Set(["BHD", "KWD", "OMR"]);
  const exponent = zeroDecimal.has(currency) ? 0 : threeDecimal.has(currency) ? 3 : 2;
  const [whole, frac = ""] = decimalPrice.split(".");
  const paddedFrac = (frac + "0".repeat(exponent)).slice(0, exponent);
  return BigInt(whole + paddedFrac || "0");
}
