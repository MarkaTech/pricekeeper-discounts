# Scale targeting: why a 10,000-product collection costs the same as a 10-product one

PriceKeeper's collection targeting is **O(1) in collection size** at every stage of a
campaign's life. This document explains why, and defines the gate test that proves it
on a dev store.

## The design

**Activation writes only collection IDs — never product lists.**

When a campaign targeting collections is activated
(`app/services/discounts.server.ts` → `activateCampaign`), the app performs exactly one
`discountAutomaticAppCreate`/`Update` mutation. The discount node carries two metafields:

| Metafield | Contents |
|---|---|
| `$app:campaign` / `config` | the full `CampaignConfig` JSON (the campaign's single source of truth) |
| `$app:campaign` / `input-vars` | `{ "collectionIds": [...gids], "excludedCollectionIds": [...], "customerTags": [...] }` — built by `buildInputVars()` |

That is the entire cost of activating against a collection: a handful of collection
**IDs** in a JSON string. There is no product enumeration, no tagging, and no catalog
mutation of any kind (architecture invariant 1: the app has zero code paths that edit
products, variants, or prices).

**Membership is resolved by Shopify, inside the function's input query, at checkout.**

The discount function's input query
(`extensions/discount-function/src/cart_lines_discounts_generate_run.graphql`) declares
variables that Shopify populates from the `input-vars` metafield:

```graphql
merchandise {
  ... on ProductVariant {
    product {
      inTargetCollections: inAnyCollection(ids: $collectionIds)
      inExcludedCollections: inAnyCollection(ids: $excludedCollectionIds)
    }
  }
}
```

`inAnyCollection` is evaluated **by Shopify's backend, per cart line** — the function
receives a boolean per line. Cost scales with the number of lines in the cart
(bounded and small), never with the number of products in the collection.

**The only enumeration anywhere is the optional preview product fetch.**

`app/services/preview.server.ts` fetches a single product with
`collections(first: 250)` and `variants(first: 50)` to simulate the input-query
booleans for the live preview sandbox. One product, admin-side, on demand — it does
not run at checkout and does not scale with collection size.

## Complexity summary

| Operation | Cost | Scales with collection size? |
|---|---|---|
| Activate campaign | 1 mutation, IDs only | No — O(1) |
| Edit / sync campaign | 1 mutation, IDs only | No — O(1) |
| Checkout discounting | `inAnyCollection` per cart line | No — O(cart lines) |
| Deactivate | 1 delete mutation | No — O(1) |
| Preview (admin, optional) | 1 product fetch | No — O(1 product) |

## Gate test plan (run on the dev store)

Goal: demonstrate that activating a campaign against a 10,000-product collection is as
fast as against a 10-product collection, and that checkout discounts members only.

1. Create 10,000 products via `bulkOperationRunMutation` (staged-upload JSONL of
   `productCreate` inputs, all tagged `pk-bulk-10k`), then create a **smart
   collection** keyed on that tag so membership is instant.
2. In PriceKeeper, create a PERCENTAGE campaign targeting COLLECTIONS → the 10k
   collection, and time the Activate action. Repeat with a 10-product control
   collection.
3. **Pass criteria:** activation time for the 10k collection is within noise of the
   10-product control (both a single sub-second mutation, no extra API calls between
   click and ACTIVE status); no product-tagging/update calls anywhere in the app's
   request log; checkout correctly discounts member products and not non-members;
   removing a product from the collection removes the discount on the next checkout
   with no app interaction.
4. Cleanup: bulk-delete the products by tag, delete the smart collection.
