// Publishes the shop metafields the theme app extension reads for display.
// Display-only — the extension never trusts this data as pricing authority;
// checkout (the Function) is always the source of truth for what a customer
// actually pays. This metafield only drives what widgets *show*.
//
// NOTE (flagged in HANDOVER.md section 6, item 3 — TODO-verify against a real
// store): confirm whether the theme extension's read needs the reserved
// `$app:pricekeeper` namespace instead of the plain `pricekeeper` namespace
// used below. Resolve against the actual CLI error on first `shopify app dev`.

import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

const METAFIELDS_SET_MUTATION = `#graphql
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id namespace key }
      userErrors { field message }
    }
  }
`;

interface ActiveCampaignSummary {
  id: string;
  type: string;
  collectionIds: string[];
  productIds: string[];
  startsAt: string | null;
  endsAt: string | null;
}

export async function publishStorefrontMetafields(
  admin: AdminApiContext,
  shopGid: string,
  activeCampaigns: ActiveCampaignSummary[],
  widgetSettings: Record<string, unknown>,
) {
  const response = await admin.graphql(METAFIELDS_SET_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: shopGid,
          namespace: "pricekeeper",
          key: "active_campaigns",
          type: "json",
          value: JSON.stringify(activeCampaigns),
        },
        {
          ownerId: shopGid,
          namespace: "pricekeeper",
          key: "widget_settings",
          type: "json",
          value: JSON.stringify(widgetSettings),
        },
      ],
    },
  });

  const data = await response.json();
  if (data.data.metafieldsSet.userErrors?.length) {
    throw new Error(data.data.metafieldsSet.userErrors.map((e: any) => e.message).join("; "));
  }
  return data.data.metafieldsSet.metafields;
}
