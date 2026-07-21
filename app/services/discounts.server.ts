// The ONLY Shopify writes this app performs: create/update/delete its own
// automatic discount nodes, plus the two app metafields (config, input-vars).
// There is deliberately no productUpdate / productVariantsBulkUpdate /
// productVariantUpdate / productSet / compareAtPrice write anywhere in this
// file, or anywhere else in the app — see architecture invariant 1.

import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { canActivateCampaign, updateCampaignStatus } from "../models/campaign.server";

const FUNCTION_ID = process.env.DISCOUNT_FUNCTION_ID || "REPLACE_WITH_FUNCTION_ID";

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

  const config = JSON.parse(campaign.configJson);
  const input = {
    title: campaign.name,
    functionId: FUNCTION_ID,
    startsAt: campaign.startsAt?.toISOString(),
    endsAt: campaign.endsAt?.toISOString() ?? null,
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

  const response = campaign.discountId
    ? await admin.graphql(DISCOUNT_UPDATE_MUTATION, { variables: { id: campaign.discountId, automaticAppDiscount: input } })
    : await admin.graphql(DISCOUNT_CREATE_MUTATION, { variables: { automaticAppDiscount: input } });

  const data = await response.json();
  const result = campaign.discountId
    ? data.data.discountAutomaticAppUpdate
    : data.data.discountAutomaticAppCreate;

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
