// Plan display definitions — safe for both server and client (no secrets,
// no server-only imports). The billing wiring itself lives in
// services/billing.server.ts.

export type PlanTier = "FREE" | "GROWTH" | "PRO";

export interface PlanDefinition {
  tier: PlanTier;
  displayName: string;
  monthlyPrice: number;
  annualPrice: number; // 10x monthly = 2 months free
  trialDays: number;
  features: string[];
}

// Owner decision 2026-07-25: no "API access (coming soon)" line anywhere —
// unbuilt features must not be advertised (known review-rejection reason).
export const PLAN_DISPLAY: Record<PlanTier, PlanDefinition> = {
  FREE: {
    tier: "FREE",
    displayName: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    trialDays: 0,
    features: ["2 active campaigns", "All discount types", "Unlimited variants", "Storefront widgets"],
  },
  GROWTH: {
    tier: "GROWTH",
    displayName: "Growth",
    monthlyPrice: 14.9,
    annualPrice: 149,
    trialDays: 14,
    features: ["15 active campaigns", "All widgets + customization", "Analytics dashboard"],
  },
  PRO: {
    tier: "PRO",
    displayName: "Pro",
    monthlyPrice: 39.9,
    annualPrice: 399,
    trialDays: 14,
    features: [
      "Unlimited campaigns (max 25 concurrently active — a Shopify platform limit)",
      "Customer segments & tags targeting",
      "Priority support",
    ],
  },
};
