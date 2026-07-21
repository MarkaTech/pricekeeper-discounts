# Uninstall test — proving "zero residual discounts, zero price changes"

This is the executable script for the clean-uninstall claim and architecture invariant
3. Run it on the dev store before submission, and again before every major release.
Expected result: the catalog after uninstall is **byte-identical** to the catalog
before install.

The structural argument, for context: the app applies discounts exclusively as
Shopify-native automatic discounts backed by an app-owned Function. Shopify deletes
app-owned discounts and app-owned metafields itself on uninstall, and the app contains
zero code paths that write to products or variants. This test demonstrates that
argument empirically.

## Step 0 — Seed

On the dev store, create via the app: one campaign of each type (7 total), activate at
least 4 (volume on a collection, BOGO, cart total, free shipping). Place one test order
that receives a discount.

## Step 1 — Snapshot catalog prices (BEFORE)

Run in GraphiQL (Admin API), paginating until `hasNextPage` is false; save all pages to
`snapshot-before.json`:

```graphql
query CatalogSnapshot($after: String) {
  productVariants(first: 250, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes { id price compareAtPrice updatedAt product { id updatedAt } }
  }
}
```

## Step 2 — Snapshot discounts (BEFORE)

Save as `discounts-before.json`. Expect the app's campaigns to appear as
`DiscountAutomaticApp` nodes:

```graphql
query DiscountSnapshot($after: String) {
  discountNodes(first: 250, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes { id discount { __typename ... on DiscountAutomaticApp { title status appDiscountType { functionId } } } }
  }
}
```

## Step 3 — Uninstall

Shopify admin → Settings → Apps and sales channels → uninstall PriceKeeper Discounts.
Note the timestamp.

## Step 4 — Verify discounts are gone (within ~1 minute)

Re-run the Step 2 query. **PASS =** zero `DiscountAutomaticApp` nodes with the app's
function remain; native discounts (codes, Shopify automatic discounts) are untouched.

## Step 5 — Verify catalog prices unchanged

Re-run the Step 1 query, save as `snapshot-after.json`, then diff by `[id, price,
compareAtPrice]` key. **PASS =** no missing or added keys (i.e. no price changed).
`updatedAt` fields are excluded from the diff key since Shopify may touch them for
unrelated reasons.

## Step 6 — Verify webhook cleanup ran

Check app logs for the `app/uninstalled` handler: sessions deleted, Shop row marked
`uninstalledAt`, campaigns marked ENDED with `discountId` cleared.

## Step 7 — Verify GDPR purge (48h later)

Shopify sends `shop/redact` ~48h after uninstall. Check logs / DB: the Shop row and all
cascaded campaigns/stats for the store are gone (including `ShopDailyStat`, which needs
an explicit delete since it's keyed by shop domain rather than a foreign key — see
`app/routes/webhooks.shop.redact.tsx`), sessions and processed webhooks purged.

## Step 8 — Reinstall sanity (optional but recommended)

Reinstall within 48h: campaigns should still be listed (rows retained until redaction)
with status ENDED and no live discounts; activating one recreates a fresh discount
node.

## Storefront check

After Step 3, load a previously-discounted product page: widgets must render nothing
(the app blocks are removed with the app; even if a theme cached HTML, no prices were
ever modified). Cart and checkout show full prices immediately.
