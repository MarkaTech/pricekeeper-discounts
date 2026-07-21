import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// The app holds no customer-level personal data (see docs/privacy-policy.md
// section 1 — only campaign configs, aggregate stats, and merchant staff
// session data are stored). Nothing to export; acknowledge the request.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`Received ${topic} for ${shop}: customer data request acknowledged (no customer data held)`, payload);
  return new Response(null, { status: 200 });
};
