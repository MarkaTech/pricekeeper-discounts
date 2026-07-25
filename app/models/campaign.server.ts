import prisma from "../db.server";

export const PLAN_ACTIVE_LIMITS: Record<string, number> = {
  FREE: 2,
  GROWTH: 15,
  PRO: 25, // Shopify platform limit on concurrently active app discounts
};

export async function getOrCreateShop(domain: string) {
  return prisma.shop.upsert({
    where: { domain },
    update: {},
    create: { domain },
  });
}

export async function listCampaigns(shopId: string) {
  return prisma.campaign.findMany({
    where: { shopId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getCampaign(id: string, shopId: string) {
  return prisma.campaign.findFirst({ where: { id, shopId } });
}

export async function countActiveCampaigns(shopId: string) {
  return prisma.campaign.count({ where: { shopId, status: "ACTIVE" } });
}

export async function canActivateCampaign(shopId: string, planTier: string) {
  const activeCount = await countActiveCampaigns(shopId);
  const limit = PLAN_ACTIVE_LIMITS[planTier] ?? PLAN_ACTIVE_LIMITS.FREE;
  return activeCount < limit;
}

export async function createCampaign(shopId: string, data: {
  name: string;
  type: string;
  configJson: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  recurrence?: string | null;
}) {
  return prisma.campaign.create({
    data: { shopId, status: "DRAFT", ...data },
  });
}

export async function updateCampaign(id: string, shopId: string, data: {
  name: string;
  type: string;
  configJson: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  recurrence?: string | null;
}) {
  return prisma.campaign.update({
    where: { id, shopId },
    data,
  });
}

export async function deleteCampaign(id: string, shopId: string) {
  return prisma.campaign.delete({ where: { id, shopId } });
}

export async function updateCampaignStatus(id: string, status: string, discountId?: string | null) {
  // Distinguish three cases:
  //  - discountId is a string  -> set it (just activated, got a fresh node)
  //  - discountId is null       -> CLEAR it (just deactivated; the Shopify
  //                                discount was deleted, so the stored ID is
  //                                now stale and must not be reused)
  //  - discountId is undefined  -> leave the column untouched
  // The previous `discountId ?? undefined` collapsed null into undefined, so
  // deactivation silently kept a dead ID and re-activation then failed with
  // "Discount does not exist."
  return prisma.campaign.update({
    where: { id },
    data: discountId === undefined ? { status } : { status, discountId },
  });
}

/**
 * Rolls recurring campaigns forward once their window has ended. Lazily
 * invoked whenever the campaigns list is loaded (see app.campaigns._index.tsx)
 * — not on an unattended schedule. Known MVP limitation, tracked as a Phase 2
 * follow-up (a real scheduled job) per the handover.
 */
export async function rollRecurringCampaigns(shopId: string, now: Date) {
  const ended = await prisma.campaign.findMany({
    where: { shopId, status: "ACTIVE", endsAt: { lte: now }, recurrence: { not: "NONE" } },
  });

  for (const campaign of ended) {
    const next = nextWindow(campaign.startsAt, campaign.endsAt, campaign.recurrence, now);
    if (next) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { startsAt: next.startsAt, endsAt: next.endsAt },
      });
    } else {
      await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "ENDED" } });
    }
  }
}

function nextWindow(startsAt: Date | null, endsAt: Date | null, recurrence: string | null, now: Date) {
  if (!startsAt || !endsAt || !recurrence) return null;
  const durationMs = endsAt.getTime() - startsAt.getTime();
  const stepMs =
    recurrence === "DAILY" ? 86_400_000 :
    recurrence === "WEEKLY" ? 7 * 86_400_000 :
    recurrence === "MONTHLY" ? 30 * 86_400_000 :
    null;
  if (!stepMs) return null;

  let newStart = startsAt;
  let newEnd = endsAt;
  while (newEnd.getTime() <= now.getTime()) {
    newStart = new Date(newStart.getTime() + stepMs);
    newEnd = new Date(newStart.getTime() + durationMs);
  }
  return { startsAt: newStart, endsAt: newEnd };
}
