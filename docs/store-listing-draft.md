# App Store listing — DRAFT — pending founder approval

> Every claim below is backed by the codebase (see the claims register at the end).
> Nothing here may ship until the founder signs off on: final app name, pricing copy,
> and the demo store URL.

## 1. App name (30-char limit)

| Option | Chars | Rationale |
|---|---|---|
| **PriceKeeper Discounts** (working name) | 21 | Name IS the promise: it keeps your prices. Matches `pricekeeper-discounts` handle. |
| PriceKeeper: Volume & BOGO | 26 | Keeps the brand, front-loads two high-volume search terms. |
| PriceKeeper Discount Manager | 28 | Targets "discount manager" directly. |

## 2. Tagline (max 70 chars) — 3 options

1. `Volume discounts, BOGO & flash sales that never edit your prices` (64)
2. `Quantity breaks, bulk discounts & BOGO — safe, native, at checkout` (66)
3. `The discount manager that can't break your catalog. Native & fast.` (66)

## 3. 100-word intro

> Some discount apps edit your product prices to create sales — and a crash, rate
> limit, or uninstall can leave your whole catalog wrong. PriceKeeper never touches
> your prices. Every campaign is a native Shopify automatic discount, applied at
> checkout by Shopify Functions: volume discounts and quantity breaks, BOGO and free
> gifts, bulk discounts, new prices, cart-total offers, and free shipping. Target
> collections of any size with zero tagging, preview the exact checkout math before
> going live, and show was/now prices, tier tables, and countdowns on your storefront.
> Uninstall anytime — Shopify removes every discount automatically.

## 4. Feature bullets

- Never edits product prices — discounts run at checkout via Shopify Functions
- All discount types: percentage, fixed amount, new price, volume/quantity breaks,
  BOGO & free gift, cart total, free shipping
- Collection targeting with zero tagging — membership resolves at checkout
- Live preview before activation, runs the same engine checkout uses
- Storefront widgets: was/now strikethrough, tier table, BOGO badge, countdown,
  free-shipping bar

## 5. Pricing (for the listing's pricing section)

All paid plans: 14-day free trial, annual billing = 2 months free.

| Plan | Price | Includes |
|---|---|---|
| Free | $0 | 2 active campaigns, all discount types, unlimited variants, storefront widgets |
| Growth | $14.90/mo or $149/yr | 15 active campaigns, all widgets + customization, analytics dashboard |
| Pro | $39.90/mo or $399/yr | Unlimited campaigns (max 25 concurrently active — Shopify platform limit), customer segments & tags targeting, priority support, API access (coming soon) |

> **Founder flags:** (a) API access is not built — must say "(coming soon)" everywhere
> or be dropped until it exists. (b) Feature gating other than the active-campaign
> count is not enforced in code today.

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
