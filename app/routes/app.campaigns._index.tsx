import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Page, Card, IndexTable, Badge, EmptyState, Button } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getOrCreateShop, listCampaigns } from "../models/campaign.server";
import { rollShopCampaigns } from "../services/recurrence.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);

  // Recurrence rolls forward lazily, the first time anyone opens this list
  // after a window ends — not on an unattended schedule. Known MVP limit,
  // tracked as a Phase 2 follow-up (see HANDOVER.md section 7).
  await rollShopCampaigns(shop.id);

  const campaigns = await listCampaigns(shop.id);
  return { campaigns };
};

const STATUS_TONE: Record<string, "success" | "info" | "warning" | "critical"> = {
  ACTIVE: "success",
  DRAFT: "info",
  PAUSED: "warning",
  ENDED: "critical",
};

export default function CampaignsIndex() {
  const { campaigns } = useLoaderData<typeof loader>();

  if (campaigns.length === 0) {
    return (
      <Page title="Campaigns">
        <Card>
          <EmptyState
            heading="Every discount type, without touching a single price"
            action={{ content: "Create a campaign", url: "/app/campaigns/new" }}
            image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
          >
            <p>
              Volume discounts, BOGO, cart-total offers, and free shipping —
              all computed at checkout, never by editing your catalog.
            </p>
          </EmptyState>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Campaigns" primaryAction={<Button url="/app/campaigns/new">Create campaign</Button>}>
      <Card>
        <IndexTable
          resourceName={{ singular: "campaign", plural: "campaigns" }}
          itemCount={campaigns.length}
          headings={[{ title: "Name" }, { title: "Type" }, { title: "Status" }, { title: "Schedule" }]}
          selectable={false}
        >
          {campaigns.map((c, index) => (
            <IndexTable.Row id={c.id} key={c.id} position={index}>
              <IndexTable.Cell>
                <Link to={`/app/campaigns/${c.id}`}>{c.name}</Link>
              </IndexTable.Cell>
              <IndexTable.Cell>{c.type}</IndexTable.Cell>
              <IndexTable.Cell>
                <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
              </IndexTable.Cell>
              <IndexTable.Cell>
                {c.endsAt ? `Ends ${new Date(c.endsAt).toLocaleDateString()}` : "No end date"}
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      </Card>
    </Page>
  );
}
