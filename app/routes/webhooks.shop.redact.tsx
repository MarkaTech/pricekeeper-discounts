import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// Sent by Shopify ~48h after uninstall. Permanently purges everything
// attached to the shop. Campaign / CampaignDailyStat / WidgetSettings cascade
// automatically via the Shop foreign key (onDelete: Cascade in schema.prisma).
//
// ShopDailyStat does NOT have a foreign-key relation to Shop (it's keyed by
// shopDomain string, not shopId, because analytics rows must survive even if
// the Shop row's own campaigns are gone) — so it needs an explicit delete
// here. This was the one-line gap flagged in the privacy policy's internal
// review note; it's fixed below so the policy's "everything attached to it"
// claim is actually true.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, webhookId, payload } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop} (${webhookId})`, payload);

  const already = await prisma.processedWebhook.findUnique({ where: { id: webhookId } });
  if (already) return new Response(null, { status: 200 });

  await prisma.shopDailyStat.deleteMany({ where: { shopDomain: shop } });
  await prisma.processedWebhook.deleteMany({ where: { shopDomain: shop } });
  await prisma.session.deleteMany({ where: { shop } });

  // Deleting the Shop row cascades Campaign -> CampaignDailyStat, WidgetSettings.
  await prisma.shop.deleteMany({ where: { domain: shop } });

  await prisma.processedWebhook.create({ data: { id: webhookId, topic, shopDomain: shop } });

  return new Response(null, { status: 200 });
};
