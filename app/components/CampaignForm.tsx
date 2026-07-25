// Shared builder UI for all 7 campaign types. Renders type-specific fields
// (tier rows for VOLUME, buy/get quantities for BOGO, etc.) plus the fields
// common to every campaign: name, targeting (with real product/collection
// pickers), schedule, and recurrence.
//
// The config this form emits ALWAYS includes `type` and `targeting` — the
// engine's parseConfig (extensions/discount-function/src/engine/config.ts)
// fail-closes to zero discounts without them.
import { useCallback, useMemo, useState } from "react";
import {
  FormLayout,
  TextField,
  Select,
  Checkbox,
  Button,
  InlineStack,
  BlockStack,
  Text,
  Tag,
  Banner,
} from "@shopify/polaris";

const RECURRENCE_OPTIONS = [
  { label: "Does not repeat", value: "NONE" },
  { label: "Daily", value: "DAILY" },
  { label: "Weekly", value: "WEEKLY" },
  { label: "Monthly", value: "MONTHLY" },
];

const SCOPE_OPTIONS = [
  { label: "Entire store", value: "STORE" },
  { label: "Specific products", value: "PRODUCTS" },
  { label: "Specific collections", value: "COLLECTIONS" },
];

export interface PickedResource {
  id: string;
  title: string;
}

export interface CampaignFormInitial {
  name?: string;
  type?: string;
  config?: Record<string, any>;
  startsAt?: string; // datetime-local format
  endsAt?: string;
  recurrence?: string;
  /** Titles for previously-picked resources, keyed by GID (best effort). */
  resourceTitles?: Record<string, string>;
}

interface VolumeTierRow {
  minQuantity: string;
  percentage: string;
}

// App Bridge v4 exposes a global `shopify` object inside the embedded admin.
declare global {
  interface Window {
    shopify?: {
      resourcePicker?: (options: Record<string, unknown>) => Promise<Array<{ id: string; title: string }> | undefined>;
    };
  }
}

async function pickResources(
  type: "product" | "collection",
  selectedIds: string[],
): Promise<PickedResource[] | null> {
  const picker = window.shopify?.resourcePicker;
  if (!picker) return null;
  const selection = await picker({
    type,
    multiple: true,
    selectionIds: selectedIds.map((id) => ({ id })),
  });
  if (!selection) return null; // merchant cancelled
  return selection.map((r) => ({ id: r.id, title: r.title }));
}

export default function CampaignForm({
  campaignTypes,
  initial,
}: {
  campaignTypes: string[];
  initial?: CampaignFormInitial;
}) {
  const init = initial ?? {};
  const initConfig = init.config ?? {};
  const titles = init.resourceTitles ?? {};

  const toPicked = (ids: string[] | undefined): PickedResource[] =>
    (ids ?? []).map((id) => ({ id, title: titles[id] ?? id.split("/").pop() ?? id }));

  const [type, setType] = useState(init.type ?? campaignTypes[0]);
  const [name, setName] = useState(init.name ?? "");
  const [startsAt, setStartsAt] = useState(init.startsAt ?? "");
  const [endsAt, setEndsAt] = useState(init.endsAt ?? "");
  const [recurrence, setRecurrence] = useState(init.recurrence ?? "NONE");

  // Targeting
  const [scope, setScope] = useState<string>(initConfig.targeting?.scope ?? "STORE");
  const [products, setProducts] = useState<PickedResource[]>(toPicked(initConfig.targeting?.productIds));
  const [collections, setCollections] = useState<PickedResource[]>(toPicked(initConfig.targeting?.collectionIds));
  const [pickerUnavailable, setPickerUnavailable] = useState(false);

  // Type-specific values
  const [percentage, setPercentage] = useState(String(initConfig.percentage ?? ""));
  const [amount, setAmount] = useState(String(initConfig.amount ?? ""));
  const [newPrice, setNewPrice] = useState(String(initConfig.newPrice ?? ""));
  const [fullShipping, setFullShipping] = useState(Boolean(initConfig.fullShipping ?? true));
  const [tiers, setTiers] = useState<VolumeTierRow[]>(
    Array.isArray(initConfig.tiers) && initConfig.tiers.length > 0
      ? initConfig.tiers.map((t: any) => ({ minQuantity: String(t.minQuantity), percentage: String(t.percentage) }))
      : [{ minQuantity: "3", percentage: "10" }],
  );
  const [buyQuantity, setBuyQuantity] = useState(String(initConfig.bogo?.buyQuantity ?? "1"));
  const [getQuantity, setGetQuantity] = useState(String(initConfig.bogo?.getQuantity ?? "1"));
  const [getDiscountPercentage, setGetDiscountPercentage] = useState(String(initConfig.bogo?.getDiscountPercentage ?? "100"));
  const [maxRepeats, setMaxRepeats] = useState(initConfig.bogo?.maxRepeats != null ? String(initConfig.bogo.maxRepeats) : "");

  const openPicker = useCallback(
    async (pickerType: "product" | "collection") => {
      const current = pickerType === "product" ? products : collections;
      const picked = await pickResources(pickerType, current.map((p) => p.id));
      if (picked === null) {
        if (!window.shopify?.resourcePicker) setPickerUnavailable(true);
        return; // cancelled or unavailable — keep current selection
      }
      if (pickerType === "product") setProducts(picked);
      else setCollections(picked);
    },
    [products, collections],
  );

  const config = useMemo(() => {
    const targeting: Record<string, unknown> = { scope };
    if (scope === "PRODUCTS") targeting.productIds = products.map((p) => p.id);
    if (scope === "COLLECTIONS") targeting.collectionIds = collections.map((c) => c.id);

    const cfg: Record<string, unknown> = { type, targeting };
    switch (type) {
      case "PERCENTAGE":
      case "CART_TOTAL":
        cfg.percentage = Number(percentage);
        break;
      case "FIXED_AMOUNT":
        cfg.amount = Number(amount);
        break;
      case "NEW_PRICE":
        cfg.newPrice = Number(newPrice);
        break;
      case "VOLUME":
        cfg.tiers = tiers.map((t) => ({ minQuantity: Number(t.minQuantity), percentage: Number(t.percentage) }));
        break;
      case "BOGO":
        cfg.bogo = {
          buyQuantity: Number(buyQuantity),
          getQuantity: Number(getQuantity),
          getDiscountPercentage: Number(getDiscountPercentage),
          ...(maxRepeats.trim() !== "" ? { maxRepeats: Number(maxRepeats) } : {}),
        };
        break;
      case "FREE_SHIPPING":
        cfg.fullShipping = fullShipping;
        break;
    }
    return cfg;
  }, [type, scope, products, collections, percentage, amount, newPrice, tiers, buyQuantity, getQuantity, getDiscountPercentage, maxRepeats, fullShipping]);

  return (
    <FormLayout>
      <TextField label="Campaign name" name="name" value={name} onChange={setName} autoComplete="off" />
      <Select
        label="Discount type"
        name="type"
        options={campaignTypes.map((t) => ({ label: t.replace(/_/g, " "), value: t }))}
        value={type}
        onChange={setType}
      />

      <TypeSpecificFields
        type={type}
        percentage={percentage} setPercentage={setPercentage}
        amount={amount} setAmount={setAmount}
        newPrice={newPrice} setNewPrice={setNewPrice}
        fullShipping={fullShipping} setFullShipping={setFullShipping}
        tiers={tiers} setTiers={setTiers}
        buyQuantity={buyQuantity} setBuyQuantity={setBuyQuantity}
        getQuantity={getQuantity} setGetQuantity={setGetQuantity}
        getDiscountPercentage={getDiscountPercentage} setGetDiscountPercentage={setGetDiscountPercentage}
        maxRepeats={maxRepeats} setMaxRepeats={setMaxRepeats}
      />

      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">Applies to</Text>
        <Select label="Applies to" labelHidden options={SCOPE_OPTIONS} value={scope} onChange={setScope} />
        {pickerUnavailable ? (
          <Banner tone="warning" title="Product picker unavailable">
            <p>The picker only works inside the Shopify admin. Reload the app from your Shopify admin and try again.</p>
          </Banner>
        ) : null}
        {scope === "PRODUCTS" ? (
          <ResourcePickerField
            label="products"
            resources={products}
            onBrowse={() => openPicker("product")}
            onRemove={(id) => setProducts((p) => p.filter((r) => r.id !== id))}
          />
        ) : null}
        {scope === "COLLECTIONS" ? (
          <ResourcePickerField
            label="collections"
            resources={collections}
            onBrowse={() => openPicker("collection")}
            onRemove={(id) => setCollections((c) => c.filter((r) => r.id !== id))}
          />
        ) : null}
        {type === "BOGO" ? (
          <Text as="p" tone="subdued" variant="bodySm">
            For Buy X get Y, both the &ldquo;buy&rdquo; and the &ldquo;get&rdquo; items come from
            the products this campaign applies to.
          </Text>
        ) : null}
      </BlockStack>

      <FormLayout.Group>
        <TextField
          label="Starts at"
          name="startsAt"
          type="datetime-local"
          autoComplete="off"
          onChange={setStartsAt}
          value={startsAt}
        />
        <TextField
          label="Ends at (optional)"
          name="endsAt"
          type="datetime-local"
          autoComplete="off"
          onChange={setEndsAt}
          value={endsAt}
        />
      </FormLayout.Group>

      <Select
        label="Recurrence"
        name="recurrence"
        options={RECURRENCE_OPTIONS}
        value={recurrence}
        onChange={setRecurrence}
      />

      <input type="hidden" name="config" value={JSON.stringify(config)} />

      <InlineStack align="end">
        <Button submit variant="primary">
          Save campaign
        </Button>
      </InlineStack>
    </FormLayout>
  );
}

function ResourcePickerField({
  label,
  resources,
  onBrowse,
  onRemove,
}: {
  label: string;
  resources: PickedResource[];
  onBrowse: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <BlockStack gap="200">
      <InlineStack gap="200" blockAlign="center">
        <Button onClick={onBrowse}>Browse {label}</Button>
        <Text as="span" tone="subdued" variant="bodySm">
          {resources.length === 0 ? `No ${label} selected yet` : `${resources.length} selected`}
        </Text>
      </InlineStack>
      {resources.length > 0 ? (
        <InlineStack gap="100" wrap>
          {resources.map((r) => (
            <Tag key={r.id} onRemove={() => onRemove(r.id)}>
              {r.title}
            </Tag>
          ))}
        </InlineStack>
      ) : null}
    </BlockStack>
  );
}

function TypeSpecificFields(props: {
  type: string;
  percentage: string; setPercentage: (v: string) => void;
  amount: string; setAmount: (v: string) => void;
  newPrice: string; setNewPrice: (v: string) => void;
  fullShipping: boolean; setFullShipping: (v: boolean) => void;
  tiers: VolumeTierRow[]; setTiers: React.Dispatch<React.SetStateAction<VolumeTierRow[]>>;
  buyQuantity: string; setBuyQuantity: (v: string) => void;
  getQuantity: string; setGetQuantity: (v: string) => void;
  getDiscountPercentage: string; setGetDiscountPercentage: (v: string) => void;
  maxRepeats: string; setMaxRepeats: (v: string) => void;
}) {
  switch (props.type) {
    case "PERCENTAGE":
    case "CART_TOTAL":
      return (
        <TextField
          label="Percentage off"
          type="number"
          suffix="%"
          autoComplete="off"
          value={props.percentage}
          onChange={props.setPercentage}
          helpText={props.type === "CART_TOTAL" ? "Applied across the whole cart at checkout." : undefined}
        />
      );
    case "FIXED_AMOUNT":
      return (
        <TextField
          label="Amount off"
          type="number"
          autoComplete="off"
          value={props.amount}
          onChange={props.setAmount}
          helpText="In the store's currency."
        />
      );
    case "NEW_PRICE":
      return (
        <TextField
          label="New price"
          type="number"
          autoComplete="off"
          value={props.newPrice}
          onChange={props.setNewPrice}
          helpText="Each targeted item is charged exactly this price at checkout."
        />
      );
    case "VOLUME":
      return (
        <BlockStack gap="200">
          <Text as="h3" variant="headingSm">Quantity tiers</Text>
          {props.tiers.map((tier, i) => (
            <InlineStack key={i} gap="200" blockAlign="end" wrap={false}>
              <TextField
                label="Minimum quantity"
                labelHidden={i > 0}
                type="number"
                autoComplete="off"
                value={tier.minQuantity}
                onChange={(v) => props.setTiers((rows) => rows.map((r, j) => (j === i ? { ...r, minQuantity: v } : r)))}
              />
              <TextField
                label="Discount"
                labelHidden={i > 0}
                type="number"
                suffix="%"
                autoComplete="off"
                value={tier.percentage}
                onChange={(v) => props.setTiers((rows) => rows.map((r, j) => (j === i ? { ...r, percentage: v } : r)))}
              />
              <Button
                tone="critical"
                variant="tertiary"
                disabled={props.tiers.length === 1}
                onClick={() => props.setTiers((rows) => rows.filter((_, j) => j !== i))}
                accessibilityLabel={`Remove tier ${i + 1}`}
              >
                Remove
              </Button>
            </InlineStack>
          ))}
          <InlineStack>
            <Button
              onClick={() =>
                props.setTiers((rows) => {
                  const last = rows[rows.length - 1];
                  const nextMin = String((Number(last?.minQuantity) || 0) + 2);
                  const nextPct = String(Math.min((Number(last?.percentage) || 5) + 5, 100));
                  return [...rows, { minQuantity: nextMin, percentage: nextPct }];
                })
              }
            >
              Add tier
            </Button>
          </InlineStack>
          <Text as="p" tone="subdued" variant="bodySm">
            Example: buy 3+ → 10% off, buy 5+ → 15% off. The highest tier the quantity reaches wins.
          </Text>
        </BlockStack>
      );
    case "FREE_SHIPPING":
      return (
        <Checkbox
          label="100% off shipping"
          checked={props.fullShipping}
          onChange={props.setFullShipping}
        />
      );
    case "BOGO":
      return (
        <BlockStack gap="200">
          <Text as="h3" variant="headingSm">Buy X get Y</Text>
          <FormLayout.Group>
            <TextField label="Customer buys (quantity)" type="number" autoComplete="off" value={props.buyQuantity} onChange={props.setBuyQuantity} />
            <TextField label="Customer gets (quantity)" type="number" autoComplete="off" value={props.getQuantity} onChange={props.setGetQuantity} />
          </FormLayout.Group>
          <FormLayout.Group>
            <TextField
              label="Discount on the 'get' items"
              type="number"
              suffix="%"
              autoComplete="off"
              value={props.getDiscountPercentage}
              onChange={props.setGetDiscountPercentage}
              helpText="100% = free."
            />
            <TextField
              label="Max repeats per cart (optional)"
              type="number"
              autoComplete="off"
              value={props.maxRepeats}
              onChange={props.setMaxRepeats}
              helpText="Leave blank for unlimited."
            />
          </FormLayout.Group>
        </BlockStack>
      );
    default:
      return null;
  }
}
