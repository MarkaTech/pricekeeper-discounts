import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { planFromSubscriptionName } from "../services/billing.server";

// Fired by Shopify whenever an app subscription changes state (approved,
// cancelled, expired, declined, frozen). Keeps our Shop.planTier in sync even
// when the change happens outside our UI (e.g. merchant cancels from the
// Shopify admin, or a frozen store's charge lapses).
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, webhookId, payload } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop} (${webhookId})`);

  const already = await prisma.processedWebhook.findUnique({ where: { id: webhookId } });
  if (already) return new Response(null, { status: 200 });

  const sub = (payload as any)?.app_subscription;
  if (sub?.name && sub?.status) {
    const mapped = planFromSubscriptionName(sub.name);
    if (sub.status === "ACTIVE" && mapped) {
      await prisma.shop.updateMany({
        where: { domain: shop },
        data: {
          planTier: mapped.tier,
          billingInterval: mapped.interval,
          subscriptionId: sub.admin_graphql_api_id ?? null,
        },
      });
    } else if (["CANCELLED", "EXPIRED", "DECLINED"].includes(sub.status)) {
      await prisma.shop.updateMany({
        where: { domain: shop },
        data: { planTier: "FREE", billingInterval: null, subscriptionId: null },
      });
    }
    // FROZEN: store is paused for non-payment of their Shopify bill. We leave
    // the tier untouched — Shopify unfreezes automatically on payment.
  }

  await prisma.processedWebhook.create({ data: { id: webhookId, topic, shopDomain: shop } });
  return new Response(null, { status: 200 });
};
