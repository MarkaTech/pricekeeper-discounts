import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Banner,
  Checkbox,
  TextField,
  Box,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { getOrCreateShop } from "../models/campaign.server";
import {
  getWidgetSettings,
  sanitizeWidgetSettings,
  saveWidgetSettings,
} from "../models/widget-settings.server";
import { syncStorefront } from "../services/storefront-sync.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const settings = await getWidgetSettings(shop.id);
  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();

  const settings = sanitizeWidgetSettings({
    accentColor: formData.get("accentColor"),
    showPriceBadge: formData.get("showPriceBadge") === "on",
    showTierTable: formData.get("showTierTable") === "on",
    showBogoBadge: formData.get("showBogoBadge") === "on",
    showCountdown: formData.get("showCountdown") === "on",
    showShippingBar: formData.get("showShippingBar") === "on",
  });

  await saveWidgetSettings(shop.id, settings);

  // Push the new settings to the shop metafield the theme extension reads,
  // so the storefront reflects the change immediately.
  try {
    await syncStorefront(admin, shop.id);
  } catch (error) {
    return json({
      saved: true,
      syncError: error instanceof Error ? error.message : String(error),
    });
  }

  return json({ saved: true, syncError: null });
};

const TOGGLES: Array<{ name: string; key: keyof SettingsShape; label: string; help: string }> = [
  { name: "showPriceBadge", key: "showPriceBadge", label: "Discount badge on product pages", help: "Shows the active discount (e.g. \"20% off at checkout\") next to the price." },
  { name: "showTierTable", key: "showTierTable", label: "Volume tier table", help: "Displays quantity-break pricing (\"Buy 3, save 10%\") on products in a volume campaign." },
  { name: "showBogoBadge", key: "showBogoBadge", label: "BOGO badge", help: "Highlights buy-one-get-one offers on eligible products." },
  { name: "showCountdown", key: "showCountdown", label: "Campaign countdown", help: "Counts down to the end of a time-limited campaign." },
  { name: "showShippingBar", key: "showShippingBar", label: "Free-shipping progress bar", help: "Shows how close the cart is to qualifying for free shipping." },
];

type SettingsShape = {
  accentColor: string;
  showPriceBadge: boolean;
  showTierTable: boolean;
  showBogoBadge: boolean;
  showCountdown: boolean;
  showShippingBar: boolean;
};

export default function WidgetsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  const [form, setForm] = useState<SettingsShape>(settings);

  return (
    <Page
      title="Storefront widgets"
      subtitle="Widgets show shoppers what they'll save — the actual price change always happens at checkout."
    >
      <BlockStack gap="400">
        {actionData?.saved && !actionData.syncError ? (
          <Banner tone="success" title="Widget settings saved">
            <p>The storefront will reflect your changes on the next page load.</p>
          </Banner>
        ) : null}
        {actionData?.syncError ? (
          <Banner tone="warning" title="Saved, but the storefront wasn't updated">
            <p>
              Settings were saved, but publishing to the storefront failed: {actionData.syncError}.
              They'll be re-published the next time you save or activate a campaign.
            </p>
          </Banner>
        ) : null}

        <Form method="post">
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Widgets</Text>
                  {TOGGLES.map((t) => (
                    <Checkbox
                      key={t.name}
                      name={t.name}
                      label={t.label}
                      helpText={t.help}
                      checked={form[t.key] as boolean}
                      onChange={(value) => setForm((f) => ({ ...f, [t.key]: value }))}
                    />
                  ))}
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section variant="oneThird">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Appearance</Text>
                  <InlineStack gap="300" blockAlign="center">
                    <Box
                      borderRadius="200"
                      minWidth="36px"
                      minHeight="36px"
                      borderWidth="025"
                      borderColor="border"
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: /^#[0-9a-fA-F]{6}$/.test(form.accentColor) ? form.accentColor : "#111111",
                        }}
                      />
                    </Box>
                    <Box minWidth="160px">
                      <TextField
                        label="Accent color"
                        labelHidden={false}
                        name="accentColor"
                        value={form.accentColor}
                        onChange={(value) => setForm((f) => ({ ...f, accentColor: value }))}
                        autoComplete="off"
                        placeholder="#111111"
                        helpText="Hex color used for badges and the shipping bar."
                      />
                    </Box>
                  </InlineStack>
                </BlockStack>
              </Card>
              <Box paddingBlockStart="400">
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Enable in your theme</Text>
                    <Text as="p" tone="subdued">
                      Widgets are theme app blocks. Add them in the theme editor:
                      Online Store → Customize → Add block → Discountify.
                    </Text>
                  </BlockStack>
                </Card>
              </Box>
            </Layout.Section>
          </Layout>

          <Box paddingBlockStart="400">
            <Button submit variant="primary" loading={submitting}>
              Save settings
            </Button>
          </Box>
        </Form>
      </BlockStack>
    </Page>
  );
}
