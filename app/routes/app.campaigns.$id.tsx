import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import {
  Page,
  Card,
  Badge,
  Banner,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Modal,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getOrCreateShop, getCampaign, deleteCampaign } from "../models/campaign.server";
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
    } else if (intent === "pause" && campaign.discountId) {
      await deactivateCampaign(admin, campaign.id, campaign.discountId);
    } else if (intent === "delete") {
      // Remove the live discount node first (if any), then the campaign row.
      // A missing node (already deleted on Shopify's side) never blocks the
      // local delete.
      if (campaign.discountId) {
        try {
          await deactivateCampaign(admin, campaign.id, campaign.discountId);
        } catch (error) {
          console.warn("Deleting Shopify discount node failed (continuing):", error);
        }
      }
      await deleteCampaign(campaign.id, shop.id);
      try {
        await syncStorefront(admin, shop.id);
      } catch (syncError) {
        console.warn("Storefront metafield sync failed:", syncError);
      }
      return redirect("/app/campaigns");
    }
    // Refresh the storefront widget metafields to match the new active set.
    // Never blocks the action itself — widgets are display-only.
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
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  return (
    <Page
      title={campaign.name}
      backAction={{ url: "/app/campaigns" }}
      primaryAction={{ content: "Edit campaign", url: `/app/campaigns/${campaign.id}/edit` }}
      secondaryActions={[
        {
          content: "Delete",
          destructive: true,
          onAction: () => setDeleteModalOpen(true),
        },
      ]}
    >
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
            {campaign.startsAt ? (
              <Text as="p" variant="bodyMd" tone="subdued">
                Starts {new Date(campaign.startsAt).toLocaleString()}
                {campaign.endsAt ? ` · Ends ${new Date(campaign.endsAt).toLocaleString()}` : " · No end date"}
              </Text>
            ) : null}
          </BlockStack>

          <InlineStack gap="200">
            {campaign.status === "DRAFT" || campaign.status === "PAUSED" || campaign.status === "ENDED" ? (
              <Form method="post">
                <input type="hidden" name="intent" value="activate" />
                <Button submit variant="primary" loading={submitting}>
                  Activate campaign
                </Button>
              </Form>
            ) : campaign.status === "ACTIVE" ? (
              <Form method="post">
                <input type="hidden" name="intent" value="pause" />
                <Button submit loading={submitting}>
                  Pause campaign
                </Button>
              </Form>
            ) : null}
          </InlineStack>
        </BlockStack>
      </Card>

      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title={`Delete "${campaign.name}"?`}
        primaryAction={{
          content: "Delete campaign",
          destructive: true,
          onAction: () => {
            const form = document.getElementById("delete-campaign-form") as HTMLFormElement | null;
            form?.requestSubmit();
          },
        }}
        secondaryActions={[{ content: "Cancel", onAction: () => setDeleteModalOpen(false) }]}
      >
        <Modal.Section>
          <Text as="p">
            This removes the campaign{campaign.status === "ACTIVE" ? " and its live checkout discount" : ""} permanently.
            Your product prices are untouched — they were never edited in the first place.
          </Text>
        </Modal.Section>
      </Modal>
      <Form method="post" id="delete-campaign-form">
        <input type="hidden" name="intent" value="delete" />
      </Form>
    </Page>
  );
}
