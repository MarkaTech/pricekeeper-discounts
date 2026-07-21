# PriceKeeper Discounts — project handover

Working name: **PriceKeeper Discounts**. A Shopify discount app built to compete with
Discounty (Bulk Discount Sales) by fixing its structural flaw: Discounty edits product
prices directly, which corrupts catalogs and leaves discounts behind after uninstall.
This app never touches a price. Every discount is a native Shopify automatic discount
computed by a Shopify Function at checkout — the catalog cannot be corrupted because
there is no code path that writes to it. That claim is verified, not assumed: a
repo-wide scan for price-mutation call sites (`productUpdate`, `productVariantsBulkUpdate`,
`productVariantUpdate`, `productSet`, `compareAtPrice` writes) returns zero matches in
`app/` and `extensions/`.

This document is the single point of entry for picking the project back up — what
exists, what's proven, what's still open, and exactly how to get it running on a real
store. Deeper rationale for individual decisions lives in `notes/` (session-by-session
engineering log) and `docs/` (store-readiness content); this file summarizes and links
out rather than repeating them.

## 1. Architecture invariants (do not violate these)

1. **The discount engine never mutates product or variant prices.** All pricing math
   happens inside a Shopify Function and is returned as discount operations, not writes.
2. **Storefront display is a read-only layer.** The theme app extension renders computed
   prices; it has no authority — checkout is always the source of truth.
3. **Uninstall is always clean.** Shopify itself deletes app-owned Function discounts on
   uninstall. The app's `app/uninstalled` webhook only cleans local rows.
4. **Native discount compatibility.** Every campaign declares `combinesWith` explicitly,
   and a conflict-detection panel shows every discount it could collide with before
   activation.
5. **Targeting scales with zero tagging.** Collection/product targeting is resolved by
   Shopify at checkout time via `inAnyCollection`, not by enumerating products — this is
   what makes 10,000-product collections work without hand-tagging.
6. **A price-editing module is out of scope for this build.** If a "Sale Price Editor"
   is ever added (Phase 2), it must be a separate, off-by-default module with a
   pre-edit snapshot, rollback, and drift reconciliation — never merged into the core
   engine. Nothing in this codebase implements it; `app/modules/README.md` stubs it.

## 2. Tech stack

Shopify CLI Remix + TypeScript template, Prisma (SQLite in dev, swap to Postgres in
production), Polaris + App Bridge embedded admin, Shopify Functions (JavaScript/WASM)
on the **2026-01 unified Discount Function API**, one theme app extension, GraphQL
Admin API only, Shopify Billing API for subscriptions.

One deliberate deviation from the original spec worth knowing up front: the spec asked
for three separate Functions (product/order/shipping). Shopify deprecated that model in
favor of one unified Discount Function with two targets — `cart.lines.discounts.generate.run`
and `cart.delivery-options.discounts.generate.run`. This build uses the current,
non-deprecated API. Rationale in `notes/2026-07-12-unified-discount-api.md`.

## 3. Repository map

```
app/
  components/CampaignForm.tsx        Shared builder UI for all 7 campaign types
  models/
    campaign.server.ts               Campaign CRUD, plan limits, status transitions
    campaign-form.server.ts          FormData <-> configJson, timezone conversion
    config-validate.server.ts        Server-side mirror of the engine's config validator
    widget-settings.server.ts        Widget customization: types, defaults, sanitize
  services/
    discounts.server.ts              The ONLY Shopify writes: create/update/delete
                                      discount nodes, conflict-scan query
    billing.server.ts                Plan definitions, Shopify Billing config
    analytics.server.ts              Order-level attribution from discountAllocations
    preview.server.ts                Live preview: runs the real engine against a
                                      synthetic cart built from real product data
    storefront-sync.server.ts        Publishes the `pricekeeper` shop metafields the
                                      theme extension reads
    recurrence.server.ts             Rolls recurring campaigns to their next window
  routes/
    app.campaigns*.tsx                List, builder (new/edit), conflicts, preview
    app.analytics.tsx / app.billing.tsx / app.widgets.tsx
    webhooks.*.tsx                    All 10 webhooks (lifecycle, store-state, GDPR,
                                      billing)
  modules/README.md                  Phase 2 stubs (A/B testing, code gen, Flow,
                                      post-purchase, Sale Price Editor) — not implemented

extensions/discount-function/        The Shopify Function (checkout pricing authority)
  src/engine/                         Pure TypeScript, zero Shopify imports — this is
                                      why it's unit-testable without the CLI:
    config.ts                         CampaignConfig type + parseConfig (fail-closed
                                      validation: malformed config -> zero discounts,
                                      never a throw)
    money.ts                          Exact BigInt minor-unit math; currency exponent
                                      table (JPY 0-decimal, BHD 3-decimal, etc.)
    targeting.ts / tiers.ts / value.ts / bogo.ts / lines.ts / delivery.ts
  tests/                              38 vitest cases covering all of the above (run
                                      and passing in this repo — see section 5)
  src/cart_lines_discounts_generate_run.ts       Function entry point (PRODUCT/ORDER)
  src/cart_delivery_options_discounts_generate_run.ts   Function entry point (SHIPPING)

extensions/pricekeeper-widgets/       Theme app extension (display only)
  blocks/                             price-badge, tier-table, bogo-badge, countdown,
                                      shipping-bar
  assets/pricekeeper.js + pricekeeper.css
  snippets/pk-match.liquid            Shared targeting matcher

prisma/schema.prisma                  Shop, Campaign, WidgetSettings, CampaignDailyStat,
                                      ShopDailyStat, ProcessedWebhook, Session
shopify.app.toml                      Scopes, webhook subscriptions, API version

docs/                                 Store-readiness package (see section 6)
notes/                                Session-by-session engineering log (see section 7)
```

## 4. What's built, by milestone

| Milestone | Scope | Status |
|---|---|---|
| M1 | Scaffold, auth, DB schema, all 10 webhooks (lifecycle, store-state, GDPR trio, billing) | Code complete |
| M2 | Discount engine (all 7 campaign types), campaign CRUD, activation service | Code complete, unit-gate passed |
| M3 | Theme app extension: 5 storefront widgets | Code complete |
| M4 | Admin: campaign builder, conflict panel, live preview sandbox, widget customization, recurrence roller | Code complete |
| M5 | Billing (Free/Growth/Pro) + analytics (order-level attribution) | Code complete |
| M6 | Store readiness: listing draft, screenshots plan, privacy draft, BFS audit, uninstall-proof script | Drafts complete |

Every campaign type from the spec is implemented: percentage, fixed amount, new price,
multi-tier volume/quantity breaks, BOGO/Buy X Get Y (including free gift), cart total
discounts, and free shipping. Targeting covers whole store, collections, products,
variants, customer tags, and exclusions everywhere, with a logged-in gate. Scheduling
supports start/end in the store's timezone plus daily/weekly/monthly recurrence.

## 5. What's actually verified (and how)

This section only lists things that were run and produced evidence in this session —
not things that should work in theory.

- **Engine correctness:** 38/38 unit tests pass (vitest), covering money math, tier
  resolution, BOGO unit allocation, targeting/exclusions, customer gating, and
  fail-closed multi-currency behavior (a fixed-amount or new-price campaign gives no
  discount in a presentment currency it hasn't been configured for, rather than
  silently misconverting). Run it yourself: `cd extensions/discount-function && npm
  install && npm test`.
- **No price mutation:** a repo-wide grep for product/variant price-mutation mutations
  returns zero hits outside the explicitly-stubbed, disabled Phase 2 module.

Everything else — installing on a real dev store, webhook delivery, the billing
subscribe/cancel round trip, Lighthouse/LCP on a live theme, GraphQL operation
validation against Shopify's live schema, `tsc --noEmit`/build passing end-to-end, and
the 10,000-product collection timing gate — requires a Shopify Partner account, a dev
store, and `npm install` run against real Shopify CLI tooling, none of which this
scaffolding session has access to. Those are the "pending" items below, not failures —
see section 6 for exactly how to run them yourself.

## 6. How to actually run this

You need a Shopify Partner account and a development store. From your machine, inside
the project folder:

```bash
npm install
npx prisma migrate dev --name init
shopify app config link      # connects this repo to a Partner app; interactive
shopify app dev              # starts the local dev server + tunnel, installs on your dev store
```

The first `shopify app dev` run will surface three things flagged as TODO-verify in
the code (marked with comments at the exact spot):

1. The exact TOML nesting for the Function's input-query variables
   (`extensions/discount-function/shopify.extension.toml`).
2. Whether the JS Function build expects the snake_case exports as currently wired in
   `extensions/discount-function/src/index.ts`.
3. Whether the theme extension's `app.metafields.pricekeeper.*` read needs the
   reserved `$app:pricekeeper` namespace form instead of the plain `pricekeeper`
   namespace currently used by `storefront-sync.server.ts`.

None of these are architectural risks — they're CLI/schema details that only resolve
against a real Shopify backend, and each has a one-line fix once you see the actual
error message.

Once running, work through `docs/uninstall-test.md` (executable step-by-step script
with the exact GraphQL for each step) to prove the "zero residual discounts, zero
price changes" claim empirically on your dev store, and `docs/scale-targeting.md` for
the 10,000-product collection timing gate.

## 7. Known gaps (not hidden, tracked in docs/bfs-audit.md)

- Admin UI strings are inline English; no i18n extraction yet (the storefront widgets
  ARE fully translatable — `locales/en.default.json`).
- No per-currency override editor in the campaign builder yet (the engine and data
  model support `currencyOverrides`/`minSubtotalOverrides`; there's just no form for
  them — Markets polish, not a blocker).
- Recurrence rolls forward lazily, the first time anyone opens the campaigns list after
  a window ends, not on an unattended schedule. Fine for MVP; a real scheduled job is
  the Phase 2 fix.
- Pro plan's "API access" line item is aspirational — no API is built. The listing
  draft marks it "(coming soon)" rather than claiming it.
- The campaign builder's UI for VOLUME tiers and BOGO configuration is a raw JSON
  textarea (`app/components/CampaignForm.tsx`) — functional, but a real resource-picker
  UI (products, tier rows with add/remove) is a follow-up, not yet built.

## 8. Decisions that need you, not more engineering

1. **Final app name.** "PriceKeeper Discounts" is a placeholder used consistently
   throughout the code, config, and docs. `docs/store-listing-draft.md` has two
   alternatives. Renaming later means touching `shopify.app.toml`, the listing
   draft, and any UI copy that names the app.
2. **Pro "API access."** Ship the listing with "(coming soon)" or build a minimal
   read-only API before submission — currently promised in pricing copy, not built.
3. **Listing copy and privacy policy sign-off.** Both are explicitly marked DRAFT in
   `docs/` pending your review; the privacy policy in particular should get a legal
   pass since it makes claims about data retention and GDPR handling.

## 9. Where to look for more detail

- `notes/` — one file per engineering decision or constraint discovered this session,
  each with a one-line summary at the top. Read this before changing engine, billing,
  or theme-extension code — it explains *why*, not just *what*.
- `docs/bfs-audit.md` — Built for Shopify criteria, graded honestly per item.
- `docs/scale-targeting.md` and `docs/uninstall-test.md` — executable proofs for the
  two hardest claims this app makes (scales to 10k+ products, uninstalls cleanly).
- `docs/privacy-policy.md` — finalized draft; the one remaining code dependency
  (ShopDailyStat cascade on shop/redact) is now implemented in
  `app/routes/webhooks.shop.redact.tsx`.
