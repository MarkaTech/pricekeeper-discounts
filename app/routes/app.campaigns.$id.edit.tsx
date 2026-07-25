import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { Page, Card, Banner } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getOrCreateShop, getCampaign, updateCampaign } from "../models/campaign.server";
import { parseCampaignForm } from "../models/campaign-form.server";
import { validateCampaignConfig, type CampaignType } from "../models/config-validate.server";
import { activateCampaign } from "../services/discounts.server";
import { syncStorefront } from "../services/storefront-sync.server";
import CampaignForm from "../components/CampaignForm";

const CAMPAIGN_TYPES = ["PERCENTAGE", "FIXED_AMOUNT", "NEW_PRICE", "VOLUME", "BOGO", "CART_TOTAL", "FREE_SHIPPING"];

const RESOURCE_TITLES_QUERY = `#graphql
  query ResourceTitles($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product { id title }
      ... on Collection { id title }
    }
  }
`;

/** Stored UTC instant -> "YYYY-MM-DDTHH:mm" in the shop's timezone (datetime-local format). */
function toLocalInput(date: Date | null, timezone: string): string | undefined {
  if (!date) return undefined;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const campaign = await getCampaign(params.id!, shop.id);
  if (!campaign) throw new Response("Campaign not found", { status: 404 });

  let config: Record<string, any> = {};
  try {
    config = JSON.parse(campaign.configJson);
  } catch {
    // Malformed stored config — the form just starts from defaults.
  }

  // Best-effort titles for previously picked products/collections so the
  // form shows names instead of raw GIDs.
  const ids: string[] = [
    ...(config.targeting?.productIds ?? []),
    ...(config.targeting?.collectionIds ?? []),
  ];
  const resourceTitles: Record<string, string> = {};
  if (ids.length > 0) {
    try {
      const response = await admin.graphql(RESOURCE_TITLES_QUERY, { variables: { ids } });
      const data = await response.json();
      for (const node of data.data?.nodes ?? []) {
        if (node?.id && node?.title) resourceTitles[node.id] = node.title;
      }
    } catch {
      // Titles are cosmetic — never block the edit form on this lookup.
    }
  }

  return json({
    campaign: {
      id: campaign.id,
      name: campaign.name,
      type: campaign.type,
      status: campaign.status,
      config,
      startsAt: toLocalInput(campaign.startsAt, shop.timezone) ?? "",
      endsAt: toLocalInput(campaign.endsAt, shop.timezone) ?? "",
      recurrence: campaign.recurrence ?? "NONE",
      resourceTitles,
    },
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const campaign = await getCampaign(params.id!, shop.id);
  if (!campaign) throw new Response("Campaign not found", { status: 404 });

  const formData = await request.formData();
  const input = parseCampaignForm(formData, shop.timezone);

  const config = JSON.parse(input.configJson);
  const validation = validateCampaignConfig(input.type as CampaignType, config);
  if (!validation.valid) {
    return json({ errors: validation.errors });
  }

  const updated = await updateCampaign(campaign.id, shop.id, {
    name: input.name,
    type: input.type,
    configJson: input.configJson,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    recurrence: input.recurrence,
  });

  // If the campaign is live, push the new config to its Shopify discount node
  // immediately so checkout reflects the edit.
  if (campaign.status === "ACTIVE") {
    try {
      await activateCampaign(admin, { ...updated, discountId: campaign.discountId }, shop.id, shop.planTier, {
        skipLimitCheck: true,
      });
      await syncStorefront(admin, shop.id);
    } catch (error) {
      return json({
        errors: [
          `Saved, but updating the live discount failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
      });
    }
  }

  return redirect(`/app/campaigns/${campaign.id}`);
};

export default function EditCampaign() {
  const { campaign } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <Page title={`Edit: ${campaign.name}`} backAction={{ url: `/app/campaigns/${campaign.id}` }}>
      {actionData?.errors && (
        <Banner tone="critical" title="Fix these before saving">
          <ul>
            {actionData.errors.map((e: string) => <li key={e}>{e}</li>)}
          </ul>
        </Banner>
      )}
      <Card>
        <Form method="post">
          <CampaignForm
            campaignTypes={CAMPAIGN_TYPES}
            initial={{
              name: campaign.name,
              type: campaign.type,
              config: campaign.config,
              startsAt: campaign.startsAt,
              endsAt: campaign.endsAt,
              recurrence: campaign.recurrence,
              resourceTitles: campaign.resourceTitles,
            }}
          />
        </Form>
      </Card>
    </Page>
  );
}
