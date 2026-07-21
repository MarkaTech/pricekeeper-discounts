import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { Page, Card, FormLayout, TextField, Select, Banner } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getOrCreateShop, createCampaign } from "../models/campaign.server";
import { parseCampaignForm } from "../models/campaign-form.server";
import { validateCampaignConfig, type CampaignType } from "../models/config-validate.server";
import CampaignForm from "../components/CampaignForm";

const CAMPAIGN_TYPES = ["PERCENTAGE", "FIXED_AMOUNT", "NEW_PRICE", "VOLUME", "BOGO", "CART_TOTAL", "FREE_SHIPPING"];

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();
  const input = parseCampaignForm(formData, shop.timezone);

  const config = JSON.parse(input.configJson);
  const validation = validateCampaignConfig(input.type as CampaignType, config);
  if (!validation.valid) {
    return { errors: validation.errors };
  }

  const campaign = await createCampaign(shop.id, {
    name: input.name,
    type: input.type,
    configJson: input.configJson,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    recurrence: input.recurrence,
  });

  return redirect(`/app/campaigns/${campaign.id}`);
};

export default function NewCampaign() {
  const actionData = useActionData<typeof action>();

  return (
    <Page title="New campaign" backAction={{ url: "/app/campaigns" }}>
      {actionData?.errors && (
        <Banner tone="critical" title="Fix these before saving">
          <ul>
            {actionData.errors.map((e: string) => <li key={e}>{e}</li>)}
          </ul>
        </Banner>
      )}
      <Card>
        <Form method="post">
          <CampaignForm campaignTypes={CAMPAIGN_TYPES} />
        </Form>
      </Card>
    </Page>
  );
}
