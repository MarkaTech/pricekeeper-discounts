import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import { Page, Card, Badge, Banner, Button, BlockStack, Text } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getOrCreateShop, getCampaign } from "../models/campaign.server";
import { activateCampaign, deactivateCampaign } from "../services/discounts.server";
import { syncStorefront } from "../services/storefront-sync.server";

const STATUS_TONE: Record<string, "success" | "info" | "warning" | "critical"> = {
  ACTIVE: "success",
  DRAFT: "info",
  PAUSED: "warning",
  ENDED: "critical",
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const campaign = await getCampaign(params.id!, shop.id);
  if (!campaign) throw new Response("Campaign not found", { status: 404 });
  return json({ campaign });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const campaign = await getCampaign(params.id!, shop.id);
  if (!campaign) throw new Response("Campaign not found", { status: 404 });

  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    if (intent === "activate") {
      // shop.planTier is kept in sync with Shopify Billing by /app/billing
      // and the app_subscriptions/update webhook.
      await activateCampaign(admin, campaign, shop.id, shop.planTier);
    } else if (intent === "deactivate" && campaign.discountId) {
      await deactivateCampaign(admin, campaign.id, campaign.discountId);
    }
    // Refresh the storefront widget metafields to match the new active set.
    // Never blocks the activation itself — widgets are display-only.
    try {
      await syncStorefront(admin, shop.id);
    } catch (syncError) {
      console.warn("Storefront metafield sync failed:", syncError);
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) });
  }

  return redirect(`/app/campaigns/${campaign.id}`);
};

export default function CampaignDetail() {
  const { campaign } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <Page title={campaign.name} backAction={{ url: "/app/campaigns" }}>
      {actionData?.error && (
        <Banner tone="critical" title="Couldn't update this campaign">
          <p>{actionData.error}</p>
        </Banner>
      )}
      <Card>
        <BlockStack gap="400">
          <BlockStack gap="200">
            <Text as="span" variant="bodyMd">
              Status: <Badge tone={STATUS_TONE[campaign.status]}>{campaign.status}</Badge>
            </Text>
            <Text as="p" variant="bodyMd">Type: {campaign.type}</Text>
          </BlockStack>

          {campaign.status === "DRAFT" || campaign.status === "PAUSED" ? (
            <Form method="post">
              <input type="hidden" name="intent" value="activate" />
              <Button submit variant="primary">
                Activate campaign
              </Button>
            </Form>
          ) : campaign.status === "ACTIVE" ? (
            <Form method="post">
              <input type="hidden" name="intent" value="deactivate" />
              <Button submit tone="critical">
                Deactivate campaign
              </Button>
            </Form>
          ) : null}
        </BlockStack>
      </Card>
    </Page>
  );
}
