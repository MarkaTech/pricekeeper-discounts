# Privacy Policy — Discountify

_Last updated: 2026-07-21_

Discountify ("the app", "we") is a Shopify app that creates native Shopify
automatic discounts. This policy describes exactly what data the app stores, what it
reads without storing, and how data is deleted. It is written against the app's actual
database schema (`prisma/schema.prisma`).

## 1. What we store

| Data | Details | Where |
|---|---|---|
| **Shop record** | `.myshopify.com` domain, timezone, currency, plan tier and billing interval, Shopify subscription ID, install/uninstall timestamps | `Shop` table |
| **Campaign configurations** | Name, type, status, discount settings, targeting by product/variant/collection IDs and customer *tag names* (never customer identities), schedule, and the Shopify discount ID it created | `Campaign` table |
| **Aggregate daily statistics** | Per campaign/shop, per day: order count, revenue total, discount total, currency. Aggregates only — no order IDs, no line items, no customer information | `CampaignDailyStat`, `ShopDailyStat` |
| **Widget display settings** | Colors, text labels, placement options | `WidgetSettings` |
| **App session data** | OAuth session tokens for the embedded admin, including the staff account's name/email who installed or uses the app (merchant staff data, not customer data) | `Session` |
| **Webhook receipt IDs** | Shopify webhook IDs for duplicate-delivery protection; no payload contents | `ProcessedWebhook` |

## 2. What we read but do not store

- **Orders** (`read_orders`): reads order discount allocations to compute analytics;
  stores only the daily aggregates above.
- **Products and collections** (`read_products`): read on demand for pickers and live
  preview; not persisted.
- **Discounts** (`read_discounts`/`write_discounts`): creates/updates/deletes its own
  automatic discounts and reads existing discounts for the conflict checker.

## 3. What we never do

- No customer personal data stored: no names, emails, addresses, phone numbers, or
  order histories of your customers.
- Never modifies products, variants, or prices — the app's only writes to your store
  are its own discount objects and two app metafields.
- Storefront widgets set no cookies, do no tracking, and make no network requests
  except reading your own store's cart on the cart page.

## 4. GDPR / privacy webhooks

All three mandatory Shopify privacy webhooks are implemented (`app/routes/webhooks.*`):

- **`customers/data_request`** — no customer-level data held; acknowledged.
- **`customers/redact`** — no customer-level data held; acknowledged.
- **`shop/redact`** — sent ~48h after uninstall. On receipt we permanently delete the
  shop record and everything attached to it: campaigns, daily statistics (both
  `CampaignDailyStat` and `ShopDailyStat`), widget settings, app sessions, and webhook
  receipt IDs (`app/routes/webhooks.shop.redact.tsx`).

## 5. Uninstalling

- The moment you uninstall, Shopify itself removes all discounts the app created.
  Your product prices were never edited, so there is nothing to revert.
- On the `app/uninstalled` webhook we immediately delete app sessions and mark
  campaigns ended.
- ~48 hours later, `shop/redact` permanently purges the remaining rows. Reinstalling
  within that window restores your campaign drafts.

## 6. Data processors and subprocessors

| Processor | Purpose | Location |
|---|---|---|
| Microsoft Azure (App Service / hosting) | Application hosting | [Azure region — confirm before publishing] |
| Azure Database for PostgreSQL | Data storage | Same Azure region as above |
| Shopify Inc. | Platform, discount execution, billing | per Shopify's own policy |

We do not sell data, share data with advertisers, or use analytics/tracking services
on merchant data.

## 7. Data retention

- Active install: data in section 1 is retained while the app is installed.
- After uninstall: purged on `shop/redact` (~48 hours after uninstall).
- Aggregate statistics are recomputed from a rolling 60-day order window and hold no
  personal data at any point.

## 8. Contact

Questions or requests: **aniruddha@divinehindu.in** _(confirm this is the public
support address before publishing)._

---

### Notes for founder review (remove before publishing)

1. **Azure region:** pick the specific Azure region you're deploying to and fill it
   into both rows above.
2. **Legal review:** this is a founder-drafted document, not a lawyer-reviewed one —
   get an actual legal read before this goes live, especially the 48-hour
   `shop/redact` timing claim (Shopify's typical window, not a contractual guarantee
   you control).
