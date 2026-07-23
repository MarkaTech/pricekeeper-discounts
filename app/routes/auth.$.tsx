import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// Catches every /auth/* request (begin OAuth, callback, etc.) and hands it
// off to shopify-app-remix's authenticate.admin, which drives the whole
// OAuth flow. This matches the authPathPrefix: "/auth" set in shopify.server.ts.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};
