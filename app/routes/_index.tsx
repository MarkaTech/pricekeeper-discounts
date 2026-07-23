import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { login } from "../shopify.server";

// Public landing route. If Shopify is already telling us which shop this is
// (via ?shop=...), send the merchant straight into the OAuth flow instead of
// showing a marketing page. This mirrors the official Shopify Remix template.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (shop) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  return (
    <div style={{ fontFamily: "sans-serif", padding: "3rem", maxWidth: 640, margin: "0 auto" }}>
      <h1>Discountify</h1>
      <p>
        Discount campaigns that run through a native Shopify Function at
        checkout — never edited product prices, always accurate.
      </p>
      <form method="get" action="/auth/login">
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Shop domain
          <input
            type="text"
            name="shop"
            placeholder="my-shop-domain.myshopify.com"
            style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
          />
        </label>
        <button type="submit" style={{ padding: "0.5rem 1rem" }}>
          Log in
        </button>
      </form>
    </div>
  );
}
