import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// Same rationale as customers.data_request: no customer-level data is ever
// stored (campaign targeting stores tag *strings*, e.g. "wholesale", never
// customer identities). Nothing to redact; acknowledge the request.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`Received ${topic} for ${shop}: customer redact acknowledged (no customer data held)`, payload);
  return new Response(null, { status: 200 });
};
