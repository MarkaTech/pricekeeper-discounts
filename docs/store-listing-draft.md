# App Store listing — DRAFT

> Every claim below is backed by the codebase (see the claims register at the end).
> Remaining owner sign-offs: privacy policy (legal pass) and the demo store URL.

## 1. App name — DECIDED 2026-07-25

**Listing name: `Discountify: Volume & BOGO`** (26/30 chars — owner decision).
The app's display name in the admin stays "Discountify". Use the full listing name
in the App Store listing title; use "Discountify" in body copy after first mention.

## 2. Tagline (max 70 chars) — 3 options

1. `Volume discounts, BOGO & flash sales that never edit your prices` (64)
2. `Quantity breaks, bulk discounts & BOGO — safe, native, at checkout` (66)
3. `The discount manager that can't break your catalog. Native & fast.` (66)

## 3. 100-word intro

> Some discount apps edit your product prices to create sales — and a crash, rate
> limit, or uninstall can leave your whole catalog wrong. Discountify never touches
> your prices. Every campaign is a native Shopify automatic discount, applied at
> checkout by Shopify Functions: volume discounts and quantity breaks, BOGO and free
> gifts, bulk discounts, new prices, cart-total offers, and free shipping. Track
> results with order-level analytics, and show was/now prices, tier tables, and
> countdowns on your storefront.
> Uninstall anytime — Shopify removes every discount automatically.

## 4. Feature bullets

- Never edits product prices — discounts run at checkout via Shopify Functions
- All discount types: percentage, fixed amount, new price, volume/quantity breaks,
  BOGO & free gift, cart total, free shipping
- Collection targeting with zero tagging — membership resolves at checkout
  _(⚠ keep only if collection targeting passes the Phase 1 checkout test)_
- Analytics from Shopify's own order data — revenue, orders, discounts given
- Storefront widgets: was/now strikethrough, tier table, BOGO badge, countdown,
  free-shipping bar

> **Removed 2026-07-25:** the "Live preview before activation" bullet. The preview
> engine exists server-side (`app/services/preview.server.ts`) but has no UI screen,
> so the claim can't be shown in genuine screenshots. Restore the bullet only if a
> preview UI ships. Same applies to the conflict checker (`scanConflicts` service,
> no panel).

## 5. Pricing (for the listing's pricing section)

All paid plans: 14-day free trial, annual billing = 2 months free.

| Plan | Price | Includes |
|---|---|---|
| Free | $0 | 2 active campaigns, all discount types, unlimited variants, storefront widgets |
| Growth | $14.90/mo or $149/yr | 15 active campaigns, all widgets + customization, analytics dashboard |
| Pro | $39.90/mo or $399/yr | Unlimited campaigns (max 25 concurrently active — Shopify platform limit), customer segments & tags targeting, priority support |

> **Decided 2026-07-25:** the "API access (coming soon)" line is dropped everywhere
> (listing, pricing copy, in-app billing page) until an API exists.
> **Open flag:** feature gating other than the active-campaign count is not enforced
> in code today.

## 6. Listing content compliance checklist

- [x] No fake urgency or scarcity claims
- [x] No competitor names
- [x] No unverifiable performance claims
- [x] No claims about unbuilt features — API access marked "(coming soon)"
- [ ] Demo store URL is a placeholder — must be real before submission
- [ ] Screenshots per docs/screenshots-plan.md

## 7. Claims register

| Claim | Evidence |
|---|---|
| Never edits prices; zero price-mutation code paths | Only Admin mutations in app are `discountAutomaticAppCreate/Update`, `discountAutomaticDelete`, `metafieldsSet` — `app/services/discounts.server.ts`, `app/services/storefront-sync.server.ts` |
| All 7 discount types | `extensions/discount-function/src/engine/config.ts` `CampaignType`; 38/38 unit tests passing in `extensions/discount-function/tests/` |
| Collection targeting resolves at checkout, zero tagging | `inAnyCollection` input query design — `docs/scale-targeting.md` |
| Live preview runs the actual checkout engine | `app/services/preview.server.ts` imports `buildLineOperations` from the function engine |
| Multi-currency fail-closed; JPY/BHD exact | `engine/value.ts` `resolveForCurrency` returns null → no discount; `engine/money.ts` zero/three-decimal sets |
| Clean uninstall, no customer PII | `app/routes/webhooks.app.uninstalled.tsx`, GDPR handlers; `prisma/schema.prisma` stores no customer records |
| Free trial 14 days, annual = 2 months free | `app/services/billing.server.ts` |
