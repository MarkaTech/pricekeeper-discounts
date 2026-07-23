import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { login } from "../shopify.server";

// Shopify's OAuth login flow requires this exact path (/auth/login) to call
// shopify.login(), NOT authenticate.admin() — that's what our catch-all
// app/routes/auth.$.tsx does for every other /auth/* path, and Shopify
// explicitly detects and rejects that combination at runtime with:
// "Detected call to shopify.authenticate.admin() from configured login path".
// Remix matches this more specific route over the auth.$ splat route, so
// this one wins for exactly /auth/login.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = await login(request);
  return json({ errors: errors ?? {} });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = await login(request);
  return json({ errors: errors ?? {} });
};

export default function AuthLogin() {
  const { errors } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");
  const shownErrors = actionData?.errors ?? errors;

  return (
    <div style={{ fontFamily: "sans-serif", padding: "3rem", maxWidth: 480, margin: "0 auto" }}>
      <h1>Log in to Discountify</h1>
      <Form method="post">
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Shop domain
          <input
            type="text"
            name="shop"
            value={shop}
            onChange={(e) => setShop(e.target.value)}
            placeholder="my-shop-domain.myshopify.com"
            style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.25rem" }}
          />
        </label>
        {shownErrors?.shop && (
          <p style={{ color: "crimson" }}>{shownErrors.shop}</p>
        )}
        <button type="submit" style={{ padding: "0.5rem 1rem", marginTop: "0.75rem" }}>
          Log in
        </button>
      </Form>
    </div>
  );
}
