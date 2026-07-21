# What this scaffolding session could and couldn't verify

**Summary:** this repository was built from scratch in a cloud sandbox with no Shopify
Partner account, no dev store, and no Shopify CLI network access. Everything that only
resolves against a real Shopify backend is flagged inline as `TODO-verify` at the exact
spot in the code, plus tracked here.

**What was verified in this session:**
- The discount engine (`extensions/discount-function/src/engine/*.ts`) is plain
  TypeScript with zero Shopify imports, and its 38 vitest tests actually run and pass
  (`cd extensions/discount-function && npm install && npm test`).
- A repo-wide grep for price-mutation call sites (`productUpdate`,
  `productVariantsBulkUpdate`, `productVariantUpdate`, `productSet`, `compareAtPrice`
  writes) returns zero matches in `app/` and `extensions/`.

**What was NOT verified (requires a real Shopify Partner account + dev store):**
1. `tsc --noEmit` and `remix vite:build` succeeding end-to-end (the Remix/Shopify
   toolchain wasn't installed in this sandbox).
2. The exact TOML nesting Shopify's CLI expects for the Function's input-query
   variables (`extensions/discount-function/shopify.extension.toml`) — flagged inline.
3. Whether the theme extension's metafield read needs the reserved `$app:pricekeeper`
   namespace instead of the plain `pricekeeper` namespace
   (`app/services/storefront-sync.server.ts`, `extensions/pricekeeper-widgets/snippets/pk-match.liquid`)
   — flagged inline.
4. All GraphQL operations against Shopify's live schema (previously validated in the
   original handover's session via the Shopify MCP schema validator; re-validate after
   any edits, since this rebuild wasn't done against that same validator).
5. Webhook delivery, billing subscribe/cancel round trip, Lighthouse/LCP on a live
   theme, and the 10,000-product collection timing gate (`docs/scale-targeting.md`).
6. The uninstall proof run (`docs/uninstall-test.md`) — the `ShopDailyStat` cascade fix
   is implemented in `app/routes/webhooks.shop.redact.tsx` but has not been run against
   a real `shop/redact` webhook delivery.

None of these are architectural risks — they're CLI/schema details and integration
tests that only resolve against a real Shopify backend. Section 6 of `HANDOVER.md` has
the exact commands to run once you have a Partner account and dev store.
