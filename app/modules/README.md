# Phase 2 modules — not implemented

This folder is intentionally empty of implementation. It exists to record what's
explicitly **out of scope** for the core build, per architecture invariant 6 in
`HANDOVER.md`.

If any of these are built later, each must be a separate, off-by-default module —
never merged into `extensions/discount-function/src/engine/`, which must stay free of
any code path that writes to a product, variant, or price.

- **Sale Price Editor** — a module that *does* edit product prices directly (the
  approach this app was built to avoid using as its core mechanism). If ever added, it
  needs its own pre-edit snapshot, rollback, and drift-reconciliation logic, and must
  ship disabled by default with a clear warning that it changes the invariant this
  app's entire pitch rests on.
- **A/B testing** — split-test discount configs against control groups.
- **Code generation** — auto-generate discount codes from campaigns.
- **Flow integration** — trigger campaigns from Shopify Flow workflows.
- **Post-purchase offers** — post-purchase upsell/cross-sell extension.
