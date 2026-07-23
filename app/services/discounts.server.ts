// The ONLY Shopify writes this app performs: create/update/delete its own
// automatic discount nodes, plus the two app metafields (config, input-vars).
// There is deliberately no productUpdate / productVariantsBulkUpdate /
// productVariantUpdate / productSet / compareAtPrice write anywhere in this
// file, or anywhere else in the app — see architecture invariant 1.

import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { canActivateCampaign, updateCampaignStatus } from "../models/campaign.server";

// The discount function's ID isn't a fixed value we can hardcode — Shopify
// assigns it per app installation. Rather than requiring a manually-set
// DISCOUNT_FUNCTION_ID env var (easy to forget, silently wrong), we look it
// up at runtime from the shop's own installed functions and cache it.
const SHOPIFY_FUNCTIONS_QUERY = `#graphql
  query DiscountifyFunctions {
    shopifyFunctions(first: 25) {
      nodes { id apiType title }
    }
  }
`;

let cachedFunctionId: string | null = null;

export async function getDiscountFunctionId(admin: AdminApiContext): Promise<string> {
  if (cachedFunctionId) return cachedFunctionId;

  const response = await admin.graphql(SHOPIFY_FUNCTIONS_QUERY);
  const data = await response.json();
  const nodes = data.data?.shopifyFunctions?.nodes ?? [];

  const match = nodes.find(
    (n: { apiType: string; title: string }) =>
      n.apiType === "discount" && n.title === "Discountify Discount Engine",
  );

  if (!match) {
    throw new Error(
      "Could not find the Discountify discount function on this shop. Make sure `shopify app deploy` " +
        "(or `shopify app dev`) has run at least once so the function extension is registered.",
    );
  }

  cachedFunctionId = match.id;
  return match.id;
}

interface InputVars {
  collectionIds?: string[];
  excludedCollectionIds?: string[];
  productIds?: string[];
  excludedProductIds?: string[];
  variantIds?: string[];
  customerTags?: string[];
  requiresLogin?: boolean;
}

export function buildInputVars(config: Record<string, any>): InputVars {
  return {
    collectionIds: config.targeting?.collectionIds ?? [],
    excludedCollectionIds: config.targeting?.excludedCollectionIds ?? [],
    productIds: config.targeting?.productIds ?? [],
    excludedProductIds: config.targeting?.excludedProductIds ?? [],
    variantIds: config.targeting?.variantIds ?? [],
    customerTags: config.targeting?.customerTags ?? [],
    requiresLogin: Boolean(config.targeting?.requiresLogin),
  };
}

const DISCOUNT_CREATE_MUTATION = `#graphql
  mutation discountAutomaticAppCreate($automaticAppDiscount: DiscountAutomaticAppInput!) {
    discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
      automaticAppDiscount { discountId title status }
      userErrors { field message }
    }
  }
`;

const DISCOUNT_UPDATE_MUTATION = `#graphql
  mutation discountAutomaticAppUpdate($id: ID!, $automaticAppDiscount: DiscountAutomaticAppInput!) {
    discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $automaticAppDiscount) {
      automaticAppDiscount { discountId title status }
      userErrors { field message }
    }
  }
`;

const DISCOUNT_DELETE_MUTATION = `#graphql
  mutation discountAutomaticDelete($id: ID!) {
    discountAutomaticDelete(id: $id) {
      deletedAutomaticDiscountId
      userErrors { field message }
    }
  }
`;

export const CONFLICT_SCAN_QUERY = `#graphql
  query ConflictScan($first: Int!) {
    discountNodes(first: $first) {
      nodes {
        id
        discount {
          __typename
          ... on DiscountAutomaticBasic { title combinesWith { orderDiscounts productDiscounts shippingDiscounts } }
          ... on DiscountAutomaticApp { title combinesWith { orderDiscounts productDiscounts shippingDiscounts } appDiscountType { functionId } }
          ... on DiscountCodeBasic { title combinesWith { orderDiscounts productDiscounts shippingDiscounts } }
        }
      }
    }
  }
`;

function discountClassesFor(type: string): string[] {
  switch (type) {
    case "FREE_SHIPPING":
      return ["SHIPPING"];
    case "CART_TOTAL":
      return ["ORDER"];
    // PERCENTAGE, FIXED_AMOUNT, NEW_PRICE, VOLUME, BOGO all discount specific
    // line items/products rather than the order or shipping as a whole.
    default:
      return ["PRODUCT"];
  }
}

export async function activateCampaign(
  admin: AdminApiContext,
  campaign: { id: string; name: string; type: string; configJson: string; startsAt: Date | null; endsAt: Date | null; discountId: string | null },
  shopId: string,
  planTier: string,
) {
  const allowed = await canActivateCampaign(shopId, planTier);
  if (!allowed) {
    throw new Error("Active campaign limit reached for this plan. Upgrade or pause another campaign first.");
  }

  const functionId = await getDiscountFunctionId(admin);
  const config = JSON.parse(campaign.configJson);
  const input = {
    title: campaign.name,
    functionId,
    // Shopify rejects a blank startsAt outright ("Starts at can't be
    // blank"), so a campaign left with no explicit start defaults to "now".
    startsAt: (campaign.startsAt ?? new Date()).toISOString(),
    endsAt: campaign.endsAt?.toISOString() ?? null,
    // Required by the 2026-04 unified Discount Function API: any function
    // targeting cart.lines/delivery-options discounts.generate.run must
    // declare which discount classes it can produce, matching the
    // operations it's actually allowed to emit for this campaign type.
    discountClasses: discountClassesFor(campaign.type),
    combinesWith: {
      orderDiscounts: Boolean(config.combinesWith?.order),
      productDiscounts: Boolean(config.combinesWith?.product),
      shippingDiscounts: Boolean(config.combinesWith?.shipping),
    },
    metafields: [
      {
        namespace: "$app:campaign",
        key: "config",
        type: "json",
        value: campaign.configJson,
      },
      {
        namespace: "$app:campaign",
        key: "input-vars",
        type: "json",
        value: JSON.stringify(buildInputVars(config)),
      },
    ],
  };

  // Try to reuse the existing discount node if we have one, but self-heal if
  // that node no longer exists on Shopify's side (e.g. it was deleted on a
  // previous deactivate and the stale ID lingered on the campaign, or a
  // merchant deleted it manually in Shopify's own Discounts admin). In that
  // case we fall back to creating a fresh discount instead of failing with
  // "Discount does not exist."
  const runUpdate = async (id: string) => {
    const res = await admin.graphql(DISCOUNT_UPDATE_MUTATION, { variables: { id, automaticAppDiscount: input } });
    return (await res.json()).data.discountAutomaticAppUpdate;
  };
  const runCreate = async () => {
    const res = await admin.graphql(DISCOUNT_CREATE_MUTATION, { variables: { automaticAppDiscount: input } });
    return (await res.json()).data.discountAutomaticAppCreate;
  };

  let result = campaign.discountId ? await runUpdate(campaign.discountId) : await runCreate();

  const missingDiscount = (r: any) =>
    r?.userErrors?.some((e: any) => /does not exist|couldn'?t find|not found/i.test(e.message ?? ""));

  if (campaign.discountId && missingDiscount(result)) {
    // Stale reference — create a brand-new discount node instead.
    result = await runCreate();
  }

  if (result.userErrors?.length) {
    throw new Error(result.userErrors.map((e: any) => e.message).join("; "));
  }

  const discountId = result.automaticAppDiscount.discountId;
  await updateCampaignStatus(campaign.id, "ACTIVE", discountId);
  return discountId;
}

export async function deactivateCampaign(admin: AdminApiContext, campaignId: string, discountId: string) {
  const response = await admin.graphql(DISCOUNT_DELETE_MUTATION, { variables: { id: discountId } });
  const data = await response.json();
  if (data.data.discountAutomaticDelete.userErrors?.length) {
    throw new Error(data.data.discountAutomaticDelete.userErrors.map((e: any) => e.message).join("; "));
  }
  await updateCampaignStatus(campaignId, "PAUSED", null);
}

export async function scanConflicts(admin: AdminApiContext) {
  const response = await admin.graphql(CONFLICT_SCAN_QUERY, { variables: { first: 250 } });
  const data = await response.json();
  return data.data.discountNodes.nodes as Array<{ id: string; discount: Record<string, any> }>;
}
