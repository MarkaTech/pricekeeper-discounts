# PriceKeeper Discounts

A Shopify discount app that never touches product prices. Every discount is a
native Shopify automatic discount computed at checkout by a Shopify Function —
there is no code path in this app that writes to a product or variant price.

See `HANDOVER.md` for the full project handover: architecture invariants, what's
built, what's verified, known gaps, and decisions pending founder sign-off.

## Quick start

You need a Shopify Partner account and a development store.

```bash
npm install
npx prisma migrate dev --name init
shopify app config link      # connects this repo to a Partner app; interactive
shopify app dev              # starts the local dev server + tunnel, installs on your dev store
```

Run the discount-engine unit tests (no Shopify CLI required):

```bash
cd extensions/discount-function
npm install
npm test
```

## Repository map

```
app/                    Remix admin app (routes, models, services)
extensions/
  discount-function/    Shopify Function — the only checkout pricing authority
  pricekeeper-widgets/   Theme app extension (display-only storefront widgets)
prisma/                 Database schema (Shop, Campaign, stats, sessions)
docs/                   Store-readiness package (listing, privacy policy, audits)
notes/                  Engineering decision log
```
