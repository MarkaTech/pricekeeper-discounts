// Shared builder UI for all 7 campaign types. Renders type-specific fields
// (tiers for VOLUME, buy/get pickers for BOGO, etc.) plus the fields common
// to every campaign: name, targeting, schedule, recurrence, combinesWith.
import { useState } from "react";
import { FormLayout, TextField, Select, Checkbox, Button, InlineStack } from "@shopify/polaris";

const RECURRENCE_OPTIONS = [
  { label: "Does not repeat", value: "NONE" },
  { label: "Daily", value: "DAILY" },
  { label: "Weekly", value: "WEEKLY" },
  { label: "Monthly", value: "MONTHLY" },
];

export default function CampaignForm({ campaignTypes }: { campaignTypes: string[] }) {
  const [type, setType] = useState(campaignTypes[0]);
  const [name, setName] = useState("");
  const [configState, setConfigState] = useState<Record<string, unknown>>({});
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [recurrence, setRecurrence] = useState("NONE");

  return (
    <FormLayout>
      <TextField label="Campaign name" name="name" value={name} onChange={setName} autoComplete="off" />
      <Select
        label="Discount type"
        name="type"
        options={campaignTypes.map((t) => ({ label: t.replace("_", " "), value: t }))}
        value={type}
        onChange={setType}
      />

      <TypeSpecificFields type={type} config={configState} onChange={setConfigState} />

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

      <input type="hidden" name="config" value={JSON.stringify(configState)} />

      <InlineStack align="end">
        <Button submit variant="primary">
          Save campaign
        </Button>
      </InlineStack>
    </FormLayout>
  );
}

function TypeSpecificFields({
  type,
  config,
  onChange,
}: {
  type: string;
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  switch (type) {
    case "PERCENTAGE":
    case "CART_TOTAL":
      return (
        <TextField
          label="Percentage off"
          type="number"
          suffix="%"
          autoComplete="off"
          value={String(config.percentage ?? "")}
          onChange={(v) => onChange({ ...config, percentage: Number(v) })}
        />
      );
    case "FIXED_AMOUNT":
      return (
        <TextField
          label="Amount off"
          type="number"
          autoComplete="off"
          value={String(config.amount ?? "")}
          onChange={(v) => onChange({ ...config, amount: Number(v) })}
        />
      );
    case "NEW_PRICE":
      return (
        <TextField
          label="New price"
          type="number"
          autoComplete="off"
          value={String(config.newPrice ?? "")}
          onChange={(v) => onChange({ ...config, newPrice: Number(v) })}
        />
      );
    case "VOLUME":
      return (
        <TextField
          label="Tiers (JSON — builder UI TODO, engine already supports it)"
          autoComplete="off"
          multiline={3}
          value={JSON.stringify(config.tiers ?? [{ minQuantity: 3, percentage: 10 }])}
          onChange={(v) => {
            try { onChange({ ...config, tiers: JSON.parse(v) }); } catch { /* ignore until valid */ }
          }}
        />
      );
    case "FREE_SHIPPING":
      return (
        <Checkbox
          label="100% off shipping"
          checked={Boolean(config.fullShipping ?? true)}
          onChange={(v) => onChange({ ...config, fullShipping: v })}
        />
      );
    case "BOGO":
      return (
        <TextField
          label="Buy/get config (JSON — resource pickers TODO)"
          autoComplete="off"
          multiline={3}
          value={JSON.stringify(config.bogo ?? { buyQuantity: 1, getQuantity: 1, getDiscountPercentage: 100 })}
          onChange={(v) => {
            try { onChange({ ...config, bogo: JSON.parse(v) }); } catch { /* ignore until valid */ }
          }}
        />
      );
    default:
      return null;
  }
}
