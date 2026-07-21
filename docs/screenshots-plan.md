# App Store screenshots plan (7 shots, one seeded demo store)

Ordering logic: promise → proof → control → storefront payoff → results. Every shot
comes from the same seeded store, so styling, product names, and numbers are
consistent across the set. All admin shots: desktop, 1600x900, embedded app, light
mode, Dawn theme for storefront shots.

## Demo-store setup (once)

1. Dev store, Dawn theme published, app installed via `shopify app dev`.
2. Subscribe to Pro in test mode first (Free plan's 2-active-campaign cap won't fit
   5 active campaigns needed for the shots).
3. Create 12 products with images and real prices spanning the campaign types below
   (kettle, mugs with size variants, grinder + filters for BOGO, cold brew items in a
   "Summer Brew" collection, a "Mugs" smart collection, an excluded product, a
   non-discounted control product).
4. Create and activate 5 campaigns covering percentage, volume, BOGO, free shipping,
   and cart-total types; leave one DRAFT so the list shows the status range.
5. In the Dawn theme editor, add the Price badge + Tier table blocks to product
   templates, Countdown to the Summer products, BOGO badge to the grinder, and enable
   the Shipping bar app embed.
6. Place ~8 test orders across a few campaigns, plus 2 undiscounted orders, then open
   Analytics once to sync stats.

## The shots

1. **Campaign list (hero)** — 5 ACTIVE + 1 DRAFT campaigns visible. Caption: "Every
   discount type in one place — and none of them ever edit your product prices."
2. **Campaign builder** — a volume-tier campaign mid-edit, targeting a collection.
   Caption: "Quantity breaks in minutes: tiers, collection targeting, and exclusions
   — no tagging, no syncing."
3. **Live preview sandbox** — was/now pricing on a real product. Caption: "Preview runs
   the exact engine checkout uses — see the real math before you go live."
4. **Conflict checker** — one native code discount created alongside an app campaign
   so the table shows both a "stacks" and "better deal wins" verdict. Caption: "Know
   before you activate: every discount on your store, and whether it stacks."
5. **Storefront product page** — price badge + tier table live on a product. Caption:
   "Customers see the deal on the product page — display-only widgets, zero layout
   shift."
6. **Storefront countdown + free-shipping bar** — a flash-sale product with the
   shipping bar visible. Caption: "Flash-sale countdowns and a free-shipping bar that
   nudges carts over the line."
7. **Analytics** — seeded orders attributed across campaigns. Caption: "Order-level
   attribution from Shopify's own discount allocations. No estimates."

## Reuse note

The same seeded store doubles as the public demo store for the listing and as the
stage for `docs/uninstall-test.md` — run the uninstall test on a clone or after
screenshots are captured, since it uninstalls the app.
