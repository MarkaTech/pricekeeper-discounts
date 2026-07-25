import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// Fired when the merchant approves a change to the app's granted scopes.
// Standard handler from the Shopify app template: persist the new scope list
// on the session so authenticate.admin sees current grants.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const current = (payload as any)?.current as string[] | undefined;
  if (session && current) {
    await prisma.session.update({
      where: { id: session.id },
      data: { scope: current.toString() },
    });
  }

  return new Response(null, { status: 200 });
};
