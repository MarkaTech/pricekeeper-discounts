// Order-level attribution from Shopify's own discountAllocations — no
// estimates, no separately-tracked order data. Reads orders on demand via
// read_orders scope, stores only the daily aggregates below.

import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import prisma from "../db.server";

const ORDER_DISCOUNTS_QUERY = `#graphql
  query OrderDiscounts($query: String!, $first: Int!, $after: String) {
    orders(first: $first, after: $after, query: $query) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        createdAt
        currentTotalPriceSet { shopMoney { amount currencyCode } }
        discountApplications(first: 10) {
          nodes {
            ... on DiscountAutomaticApplication {
              targetType
              value { ... on MoneyV2 { amount currencyCode } }
            }
          }
        }
      }
    }
  }
`;

export async function syncCampaignStats(admin: AdminApiContext, shopDomain: string, sinceDays = 60) {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString().slice(0, 10);
  let after: string | null = null;
  let hasNextPage = true;

  const byDay = new Map<string, { orderCount: number; revenue: number; discountTotal: number; currency: string }>();

  while (hasNextPage) {
    const response = await admin.graphql(ORDER_DISCOUNTS_QUERY, {
      variables: { query: `created_at:>=${since}`, first: 100, after },
    });
    const data = await response.json();
    const { nodes, pageInfo } = data.data.orders;

    for (const order of nodes) {
      const day = order.createdAt.slice(0, 10);
      const currency = order.currentTotalPriceSet.shopMoney.currencyCode;
      const key = `${day}:${currency}`;
      const entry = byDay.get(key) ?? { orderCount: 0, revenue: 0, discountTotal: 0, currency };
      entry.orderCount += 1;
      entry.revenue += Number(order.currentTotalPriceSet.shopMoney.amount);
      for (const app of order.discountApplications.nodes) {
        if (app.value?.amount) entry.discountTotal += Number(app.value.amount);
      }
      byDay.set(key, entry);
    }

    hasNextPage = pageInfo.hasNextPage;
    after = pageInfo.endCursor;
  }

  for (const [key, stat] of byDay) {
    const [day] = key.split(":");
    await prisma.shopDailyStat.upsert({
      where: { shopDomain_date_currency: { shopDomain, date: new Date(day), currency: stat.currency } },
      update: { orderCount: stat.orderCount, revenue: stat.revenue, discountTotal: stat.discountTotal },
      create: { shopDomain, date: new Date(day), currency: stat.currency, ...stat },
    });
  }

  return byDay.size;
}

export async function getAnalyticsSummary(shopDomain: string, sinceDays = 60) {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const stats = await prisma.shopDailyStat.findMany({
    where: { shopDomain, date: { gte: since } },
    orderBy: { date: "asc" },
  });

  const totals = stats.reduce(
    (acc, s) => ({
      orderCount: acc.orderCount + s.orderCount,
      revenue: acc.revenue + s.revenue,
      discountTotal: acc.discountTotal + s.discountTotal,
    }),
    { orderCount: 0, revenue: 0, discountTotal: 0 },
  );

  return { daily: stats, totals };
}
