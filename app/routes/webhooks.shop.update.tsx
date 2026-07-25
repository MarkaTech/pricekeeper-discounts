import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// Keeps our cached shop currency/timezone in sync when the merchant changes
// store settings. Registered in shopify.app.toml ([[webhooks.subscriptions]]).
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const currency = (payload as any)?.currency;
  const timezone = (payload as any)?.iana_timezone;
  const data: Record<string, string> = {};
  if (typeof currency === "string" && currency) data.currency = currency;
  if (typeof timezone === "string" && timezone) data.timezone = timezone;

  if (Object.keys(data).length > 0) {
    await prisma.shop.updateMany({ where: { domain: shop }, data });
  }

  return new Response(null, { status: 200 });
};
