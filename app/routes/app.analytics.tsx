import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigation, useRevalidator } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  DataTable,
  EmptyState,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { syncCampaignStats, getAnalyticsSummary } from "../services/analytics.server";

const WINDOW_DAYS = 60;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  // Pull fresh order-level attribution on every visit. Order volume in the
  // window is read via cursor pagination and collapsed to daily aggregates,
  // so this stays cheap at typical store sizes. (On-demand sync is the
  // documented design of analytics.server.ts — no background jobs.)
  await syncCampaignStats(admin, session.shop, WINDOW_DAYS);
  const { daily, totals } = await getAnalyticsSummary(session.shop, WINDOW_DAYS);

  // Totals per currency — never sum across currencies.
  const byCurrency = new Map<string, { orderCount: number; revenue: number; discountTotal: number }>();
  for (const day of daily) {
    const entry = byCurrency.get(day.currency) ?? { orderCount: 0, revenue: 0, discountTotal: 0 };
    entry.orderCount += day.orderCount;
    entry.revenue += day.revenue;
    entry.discountTotal += day.discountTotal;
    byCurrency.set(day.currency, entry);
  }

  return json({
    daily: daily.map((d: typeof daily[number]) => ({
      date: d.date,
      currency: d.currency,
      orderCount: d.orderCount,
      revenue: d.revenue,
      discountTotal: d.discountTotal,
    })),
    totalsByCurrency: Object.fromEntries(byCurrency),
    totalOrders: totals.orderCount,
  });
};

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export default function AnalyticsPage() {
  const { daily, totalsByCurrency, totalOrders } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const loading = navigation.state === "loading" || revalidator.state === "loading";

  const currencies = Object.keys(totalsByCurrency);

  if (daily.length === 0) {
    return (
      <Page title="Analytics">
        <Card>
          <EmptyState
            heading="No orders in the last 60 days yet"
            image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
          >
            <p>
              Once orders come in, you'll see revenue, order counts, and how much
              your campaigns discounted — attributed from Shopify's own order
              data, not estimates.
            </p>
          </EmptyState>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title="Analytics"
      subtitle={`Last ${WINDOW_DAYS} days, from Shopify order data`}
      primaryAction={
        <Button onClick={() => revalidator.revalidate()} loading={loading}>
          Refresh
        </Button>
      }
    >
      <BlockStack gap="400">
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">Orders</Text>
                <Text as="p" variant="heading2xl">{totalOrders}</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">Revenue</Text>
                {currencies.map((c) => (
                  <Text as="p" variant="heading2xl" key={c}>
                    {money(totalsByCurrency[c].revenue, c)}
                  </Text>
                ))}
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">Discounts given</Text>
                {currencies.map((c) => (
                  <Text as="p" variant="heading2xl" key={c}>
                    {money(totalsByCurrency[c].discountTotal, c)}
                  </Text>
                ))}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h3" variant="headingSm">Daily breakdown</Text>
            </InlineStack>
            <DataTable
              columnContentTypes={["text", "numeric", "numeric", "numeric"]}
              headings={["Date", "Orders", "Revenue", "Discounts"]}
              rows={[...daily]
                .reverse()
                .map((d) => [
                  new Date(d.date).toLocaleDateString(),
                  String(d.orderCount),
                  money(d.revenue, d.currency),
                  money(d.discountTotal, d.currency),
                ])}
            />
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
