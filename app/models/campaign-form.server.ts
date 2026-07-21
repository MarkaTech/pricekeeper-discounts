// FormData <-> CampaignConfig JSON, plus timezone-aware start/end parsing.

export interface CampaignFormInput {
  name: string;
  type: string;
  configJson: string;
  startsAt: string | null; // ISO in the shop's local timezone
  endsAt: string | null;
  recurrence: string;
}

export function parseCampaignForm(formData: FormData, shopTimezone: string): CampaignFormInput {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const configRaw = String(formData.get("config") ?? "{}");
  const startsAtLocal = formData.get("startsAt") as string | null;
  const endsAtLocal = formData.get("endsAt") as string | null;
  const recurrence = String(formData.get("recurrence") ?? "NONE");

  // Validate JSON shape early; config-validate.server.ts does the semantic check.
  JSON.parse(configRaw);

  return {
    name,
    type,
    configJson: configRaw,
    startsAt: startsAtLocal ? toUtcIso(startsAtLocal, shopTimezone) : null,
    endsAt: endsAtLocal ? toUtcIso(endsAtLocal, shopTimezone) : null,
    recurrence,
  };
}

// Naive local-time -> UTC conversion using Intl; good enough for the admin
// form since Shopify itself supplies the shop's IANA timezone string.
function toUtcIso(localDatetime: string, timezone: string): string {
  const naiveDate = new Date(localDatetime);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(naiveDate);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const asIfUtc = Date.UTC(
    Number(get("year")), Number(get("month")) - 1, Number(get("day")),
    Number(get("hour")), Number(get("minute")), Number(get("second")),
  );
  const offsetMs = asIfUtc - naiveDate.getTime();
  return new Date(naiveDate.getTime() - offsetMs).toISOString();
}
