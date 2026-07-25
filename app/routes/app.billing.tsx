import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Badge,
  Banner,
  Divider,
  List,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getOrCreateShop } from "../models/campaign.server";
import {
  PLAN_DISPLAY,
  ALL_PAID_PLAN_KEYS,
  billingIsTest,
  planFromSubscriptionName,
  setShopPlan,
  type BillingPlanKey,
  type PlanTier,
} from "../services/billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);

  const { appSubscriptions } = await billing.check({
    plans: ALL_PAID_PLAN_KEYS,
    isTest: billingIsTest(),
  });

  // Reconcile our DB with Shopify's word (source of truth). Covers approvals
  // that returned to this page and cancellations made from the Shopify admin.
  const active = appSubscriptions[0] ?? null;
  const mapped = active ? planFromSubscriptionName(active.name) : null;
  if (mapped) {
    if (shop.planTier !== mapped.tier || shop.subscriptionId !== active!.id) {
      await setShopPlan(shop.id, mapped.tier, mapped.interval, active!.id);
    }
  } else if (shop.planTier !== "FREE") {
    await setShopPlan(shop.id, "FREE", null, null);
  }

  return json({
    currentTier: (mapped?.tier ?? "FREE") as PlanTier,
    currentInterval: mapped ? (active!.name.endsWith("ANNUAL") ? "ANNUAL" : "MONTHLY") : null,
    subscriptionId: active?.id ?? null,
    isTest: billingIsTest(),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();
  const intent = String(formData.get("intent"));

  if (intent === "subscribe") {
    const plan = String(formData.get("plan")) as BillingPlanKey;
    if (!ALL_PAID_PLAN_KEYS.includes(plan)) {
      return json({ error: "Unknown plan." }, { status: 400 });
    }
    const apiKey = process.env.SHOPIFY_API_KEY || "";
    // billing.request throws a redirect to Shopify's subscription-confirmation
    // page; after the merchant approves, Shopify sends them to returnUrl.
    await billing.request({
      plan,
      isTest: billingIsTest(),
      returnUrl: `https://${session.shop}/admin/apps/${apiKey}/app/billing`,
    });
    return null; // unreachable — billing.request always redirects
  }

  if (intent === "cancel") {
    const subscriptionId = String(formData.get("subscriptionId") ?? "");
    if (!subscriptionId) return json({ error: "No active subscription to cancel." }, { status: 400 });
    try {
      await billing.cancel({
        subscriptionId,
        isTest: billingIsTest(),
        prorate: true,
      });
      await setShopPlan(shop.id, "FREE", null, null);
      return json({ cancelled: true });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 500 },
      );
    }
  }

  return json({ error: "Unknown action." }, { status: 400 });
};

const TIER_ORDER: PlanTier[] = ["FREE", "GROWTH", "PRO"];

export default function BillingPage() {
  const { currentTier, currentInterval, subscriptionId, isTest } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  return (
    <Page title="Billing" subtitle="Your plan only limits how many campaigns run at once — every discount type is available on every plan, including Free.">
      <BlockStack gap="400">
        {actionData && "error" in actionData && actionData.error ? (
          <Banner tone="critical" title="Billing action failed">
            <p>{actionData.error}</p>
          </Banner>
        ) : null}
        {actionData && "cancelled" in actionData && actionData.cancelled ? (
          <Banner tone="success" title="Subscription cancelled">
            <p>You're back on the Free plan. Campaigns beyond the Free limit stay saved but can't be newly activated.</p>
          </Banner>
        ) : null}
        {isTest ? (
          <Banner tone="info" title="Test mode">
            <p>Billing runs in test mode — approving a plan won't charge a real card.</p>
          </Banner>
        ) : null}

        <Layout>
          {TIER_ORDER.map((tier) => {
            const plan = PLAN_DISPLAY[tier];
            const isCurrent = tier === currentTier;
            const isPaid = tier !== "FREE";
            return (
              <Layout.Section variant="oneThird" key={tier}>
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h2" variant="headingMd">{plan.displayName}</Text>
                      {isCurrent ? <Badge tone="success">Current plan</Badge> : null}
                    </InlineStack>

                    <BlockStack gap="100">
                      <Text as="p" variant="headingLg">
                        {isPaid ? `$${plan.monthlyPrice}/month` : "Free"}
                      </Text>
                      {isPaid ? (
                        <Text as="p" tone="subdued" variant="bodySm">
                          or ${plan.annualPrice}/year (2 months free) · {plan.trialDays}-day free trial
                        </Text>
                      ) : (
                        <Text as="p" tone="subdued" variant="bodySm">
                          Forever. No card required.
                        </Text>
                      )}
                    </BlockStack>

                    <Divider />

                    <List type="bullet">
                      {plan.features.map((f) => (
                        <List.Item key={f}>{f}</List.Item>
                      ))}
                    </List>

                    {isPaid && (!isCurrent || currentInterval === "ANNUAL") ? (
                      <Form method="post">
                        <input type="hidden" name="intent" value="subscribe" />
                        <input type="hidden" name="plan" value={`${tier}_MONTHLY`} />
                        <Button
                          submit
                          fullWidth
                          variant={isCurrent ? "secondary" : "primary"}
                          disabled={submitting || (isCurrent && currentInterval === "MONTHLY")}
                        >
                          {isCurrent ? "Switch to monthly" : `Start ${plan.trialDays}-day trial (monthly)`}
                        </Button>
                      </Form>
                    ) : null}
                    {isPaid && (!isCurrent || currentInterval === "MONTHLY") ? (
                      <Form method="post">
                        <input type="hidden" name="intent" value="subscribe" />
                        <input type="hidden" name="plan" value={`${tier}_ANNUAL`} />
                        <Button submit fullWidth disabled={submitting}>
                          {isCurrent ? "Switch to annual" : `Start ${plan.trialDays}-day trial (annual)`}
                        </Button>
                      </Form>
                    ) : null}
                    {isCurrent && isPaid && subscriptionId ? (
                      <Form method="post">
                        <input type="hidden" name="intent" value="cancel" />
                        <input type="hidden" name="subscriptionId" value={subscriptionId} />
                        <Button submit fullWidth tone="critical" variant="plain" disabled={submitting}>
                          Cancel subscription
                        </Button>
                      </Form>
                    ) : null}
                  </BlockStack>
                </Card>
              </Layout.Section>
            );
          })}
        </Layout>

        <Card>
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">How billing works</Text>
            <Text as="p" tone="subdued">
              Subscriptions are billed by Shopify and appear on your regular Shopify invoice.
              Upgrades and downgrades take effect immediately — Shopify prorates the difference.
              Cancelling drops you to the Free plan at once; your campaigns and settings are kept.
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
