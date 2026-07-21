// Thin service wrapper so routes don't reach into models/campaign.server.ts
// directly for this concern. See rollRecurringCampaigns for the lazy-roll
// caveat (Phase 2: a real scheduled job replaces this).

import { rollRecurringCampaigns } from "../models/campaign.server";

export async function rollShopCampaigns(shopId: string) {
  await rollRecurringCampaigns(shopId, new Date());
}
