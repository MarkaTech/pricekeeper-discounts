import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

// Visiting /app exactly (the embedded app's home) just forwards to the
// campaigns list, which is the actual dashboard.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  throw redirect(`/app/campaigns${url.search}`);
};
