import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import { Page, Card, Badge, Banner, Button, BlockStack, Text } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getOrCreateShop, getCampaign } from "../models/campaign.server";
import { activateCampaign, deactivateCampaign } from "../services/discounts.server";

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
      // Free/Growth/Pro plan tiers aren't wired to real billing yet — default
      // to FREE's limit until the billing plan lookup is built (tracked
      // separately). This still enforces a sane cap rather than none.
      await activateCampaign(admin, campaign, shop.id, "FREE");
    } else if (intent === "deactivate" && campaign.discountId) {
      await deactivateCampaign(admin, campaign.id, campaign.discountId);
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
