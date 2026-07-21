import prisma from "../db.server";

export type PlanTier = "FREE" | "GROWTH" | "PRO";

export interface PlanDefinition {
  tier: PlanTier;
  displayName: string;
  monthlyPrice: number;
  annualPrice: number; // 10x monthly = 2 months free
  trialDays: number;
  features: string[];
}

// Pro's "API access" line item is intentionally marked "(coming soon)" — no
// API is built yet. See docs/store-listing-draft.md founder flag (a).
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
      "API access (coming soon)",
    ],
  },
};

export const billingConfig = {
  GROWTH_MONTHLY: {
    amount: PLAN_DISPLAY.GROWTH.monthlyPrice,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS" as const,
    trialDays: PLAN_DISPLAY.GROWTH.trialDays,
  },
  GROWTH_ANNUAL: {
    amount: PLAN_DISPLAY.GROWTH.annualPrice,
    currencyCode: "USD",
    interval: "ANNUAL" as const,
    trialDays: PLAN_DISPLAY.GROWTH.trialDays,
  },
  PRO_MONTHLY: {
    amount: PLAN_DISPLAY.PRO.monthlyPrice,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS" as const,
    trialDays: PLAN_DISPLAY.PRO.trialDays,
  },
  PRO_ANNUAL: {
    amount: PLAN_DISPLAY.PRO.annualPrice,
    currencyCode: "USD",
    interval: "ANNUAL" as const,
    trialDays: PLAN_DISPLAY.PRO.trialDays,
  },
};

export async function setShopPlan(shopId: string, planTier: PlanTier, billingInterval: "MONTHLY" | "ANNUAL" | null, subscriptionId: string | null) {
  return prisma.shop.update({
    where: { id: shopId },
    data: { planTier, billingInterval, subscriptionId },
  });
}
