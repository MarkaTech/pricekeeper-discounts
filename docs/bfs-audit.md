# Built for Shopify audit — status per criterion

Statuses: **PASS** (verified in this codebase), **PENDING-DEV-STORE** (implemented,
needs measurement/verification on a live dev store), **GAP** (work remaining).
Evidence points at files or session-verified results.

## Performance

| Criterion | Status | Evidence |
|---|---|---|
| No blocking JS in storefront critical path | PASS | widgets JS loaded via theme app extension asset, small footprint (extensions/pricekeeper-widgets/assets/pricekeeper.js) |
| Storefront asset budget | PASS | JS + CSS well under typical theme-extension budgets (byte counts to reconfirm on build) |
| < 10-point Lighthouse impact / LCP < 100ms added | PENDING-DEV-STORE | zero-render design when no campaign matches (blocks emit no DOM); must measure on Dawn with Lighthouse |
| Admin performance (Polaris, no heavy bundles) | PENDING-DEV-STORE | measure TTI in embedded admin once deployed |
| Checkout performance | PASS-BY-DESIGN | discounting runs inside Shopify Functions (WASM, instruction-capped), not on our servers |

## Ease of use / merchant experience

| Criterion | Status | Evidence |
|---|---|---|
| Embedded admin with App Bridge + Polaris | PASS | app/routes/app.tsx, NavMenu |
| Onboarding: useful empty states | PASS | campaigns empty state with core promise + CTA (app.campaigns._index.tsx) |
| Preview before going live | PASS | live preview sandbox runs the actual engine (app/services/preview.server.ts) |
| Conflict transparency | PASS | conflict-scan query wired (app/services/discounts.server.ts); dedicated conflicts route is a near-term follow-up |
| Localization-ready | PARTIAL | theme extension fully translatable (locales/en.default.json); admin strings hardcoded EN — i18n extraction is a GAP |

## Merchant value / app quality

| Criterion | Status | Evidence |
|---|---|---|
| Uses current, non-deprecated APIs | PASS | unified Discount Function API 2026-01; deprecated product/order/shipping-discount APIs avoided |
| Minimal scopes | PASS | read_products, read_orders, read_discounts, write_discounts only (shopify.app.toml, each justified in comments) |
| Never mutates merchant catalog | PASS | repo-wide scan: zero price-mutation call sites; no code path exists |
| Clean uninstall | PASS-BY-DESIGN + PENDING-DEV-STORE | Shopify auto-removes function discounts; executable proof script in docs/uninstall-test.md; ShopDailyStat cascade fix applied in webhooks.shop.redact.tsx |
| Webhooks: mandatory GDPR trio + lifecycle | PASS | shopify.app.toml + app/routes/webhooks.*.tsx; delivery check pending dev store |
| Billing via Shopify Billing API | PASS | app/services/billing.server.ts, 14-day trial, annual; flows pending dev store |
| No data hoarding / PII | PASS | schema stores shop domain, configs, aggregate stats only (prisma/schema.prisma) |
| Error resilience | PASS | function returns zero ops on bad config (unit-tested); webhook handlers idempotent via ProcessedWebhook table |

## Support & listing quality

| Criterion | Status | Evidence |
|---|---|---|
| Help documentation | GAP | not yet drafted in this rebuild — see HANDOVER.md follow-ups |
| Privacy policy | FINALIZED DRAFT | docs/privacy-policy.md — code dependency resolved, still needs founder/legal sign-off |
| Listing content rules (no competitor names, no unverifiable claims) | DRAFT | docs/store-listing-draft.md — pending founder approval |
| Screenshots | PLANNED | docs/screenshots-plan.md — needs seeded demo store |
| Support contact | GAP | decide support email/channel before submission |

## Known GAPs to close before submission

1. Admin i18n extraction (spec: "i18n-ready admin (EN first)") — strings are
   inline; extract to a locale module.
2. Support contact + response SLA for the listing.
3. "API access" is promised in Pro pricing copy but not built — either build a
   minimal token-scoped read API or mark "coming soon" in the listing (flagged
   for founder decision).
4. Dev-store measurements: Lighthouse/LCP, webhook delivery, billing flows,
   10k-collection activation timing (docs/scale-targeting.md has the plan),
   uninstall proof run (docs/uninstall-test.md).
5. Conflict-checker UI route (`app.campaigns.$id.conflicts.tsx`) — the
   underlying GraphQL query exists in discounts.server.ts; the dedicated
   admin page is a near-term follow-up.
