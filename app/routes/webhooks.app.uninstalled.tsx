import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic, webhookId } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop} (${webhookId})`);

  // Idempotency: skip if we've already processed this webhook ID.
  const already = await prisma.processedWebhook.findUnique({ where: { id: webhookId } });
  if (already) return new Response(null, { status: 200 });

  if (session) {
    await prisma.session.deleteMany({ where: { shop } });
  }

  await prisma.shop.updateMany({
    where: { domain: shop },
    data: { uninstalledAt: new Date() },
  });

  await prisma.campaign.updateMany({
    where: { shop: { domain: shop } },
    data: { status: "ENDED", discountId: null },
  });

  await prisma.processedWebhook.create({ data: { id: webhookId, topic, shopDomain: shop } });

  return new Response(null, { status: 200 });
};
