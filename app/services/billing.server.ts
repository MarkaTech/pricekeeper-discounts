import { BillingInterval } from "@shopify/shopify-app-remix/server";
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

// Uses the line-item billing shape (current Shopify standard; the legacy flat
// shape is deprecated). One recurring line item per plan.
export const billingConfig = {
  GROWTH_MONTHLY: {
    trialDays: PLAN_DISPLAY.GROWTH.trialDays,
    lineItems: [
      { amount: PLAN_DISPLAY.GROWTH.monthlyPrice, currencyCode: "USD", interval: BillingInterval.Every30Days as const },
    ],
  },
  GROWTH_ANNUAL: {
    trialDays: PLAN_DISPLAY.GROWTH.trialDays,
    lineItems: [
      { amount: PLAN_DISPLAY.GROWTH.annualPrice, currencyCode: "USD", interval: BillingInterval.Annual as const },
    ],
  },
  PRO_MONTHLY: {
    trialDays: PLAN_DISPLAY.PRO.trialDays,
    lineItems: [
      { amount: PLAN_DISPLAY.PRO.monthlyPrice, currencyCode: "USD", interval: BillingInterval.Every30Days as const },
    ],
  },
  PRO_ANNUAL: {
    trialDays: PLAN_DISPLAY.PRO.trialDays,
    lineItems: [
      { amount: PLAN_DISPLAY.PRO.annualPrice, currencyCode: "USD", interval: BillingInterval.Annual as const },
    ],
  },
};

export type BillingPlanKey = keyof typeof billingConfig;

export const ALL_PAID_PLAN_KEYS = Object.keys(billingConfig) as BillingPlanKey[];

/** Maps a billing plan key (also the Shopify subscription name) back to tier + interval. */
export function planFromSubscriptionName(name: string): { tier: PlanTier; interval: "MONTHLY" | "ANNUAL" } | null {
  if (!(name in billingConfig)) return null;
  const [tier, interval] = name.split("_") as [PlanTier, "MONTHLY" | "ANNUAL"];
  return { tier, interval };
}

/**
 * Test-mode flag for the Billing API. Defaults to TRUE (no real charges) —
 * dev stores can't accept real charges, and Shopify review is done on dev
 * stores. Set SHOPIFY_BILLING_TEST=false in the production environment at
 * launch to bill for real.
 */
export function billingIsTest(): boolean {
  return process.env.SHOPIFY_BILLING_TEST !== "false";
}

export async function setShopPlan(shopId: string, planTier: PlanTier, billingInterval: "MONTHLY" | "ANNUAL" | null, subscriptionId: string | null) {
  return prisma.shop.update({
    where: { id: shopId },
    data: { planTier, billingInterval, subscriptionId },
  });
}
