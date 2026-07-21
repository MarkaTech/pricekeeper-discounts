# Unified Discount Function API, not three separate Functions

**Summary:** The original spec asked for three separate Shopify Functions
(product/order/shipping discounts). Shopify deprecated that model. This build uses the
current, non-deprecated **unified Discount Function** with two targets:
`cart.lines.discounts.generate.run` (PRODUCT + ORDER classes) and
`cart.delivery-options.discounts.generate.run` (SHIPPING class).

**Why it matters:** a single Function, declared once in
`extensions/discount-function/shopify.extension.toml` with two `[[extensions.targeting]]`
blocks, replaces what would otherwise be three separate extension folders each with
their own build and deploy step. It also means one shared `engine/` module (config
parsing, money math, targeting, tiers, BOGO, value resolution) backs every discount
type and every target — there's no duplicated pricing logic to keep in sync across
three Functions.

**Engine boundary:** `src/engine/*.ts` imports nothing from `@shopify/*` packages —
it's plain TypeScript, which is what makes it unit-testable with vitest, no Shopify CLI
required. The two entry point files
(`cart_lines_discounts_generate_run.ts`, `cart_delivery_options_discounts_generate_run.ts`)
are the only files that touch the Function's actual input/output shape; they're thin
adapters over the engine.
