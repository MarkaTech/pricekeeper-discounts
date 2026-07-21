import prisma from "../db.server";

export interface WidgetSettingsInput {
  accentColor: string;
  showPriceBadge: boolean;
  showTierTable: boolean;
  showBogoBadge: boolean;
  showCountdown: boolean;
  showShippingBar: boolean;
}

export const DEFAULT_WIDGET_SETTINGS: WidgetSettingsInput = {
  accentColor: "#111111",
  showPriceBadge: true,
  showTierTable: true,
  showBogoBadge: true,
  showCountdown: true,
  showShippingBar: true,
};

export async function getWidgetSettings(shopId: string): Promise<WidgetSettingsInput> {
  const row = await prisma.widgetSettings.findUnique({ where: { shopId } });
  return row
    ? {
        accentColor: row.accentColor,
        showPriceBadge: row.showPriceBadge,
        showTierTable: row.showTierTable,
        showBogoBadge: row.showBogoBadge,
        showCountdown: row.showCountdown,
        showShippingBar: row.showShippingBar,
      }
    : DEFAULT_WIDGET_SETTINGS;
}

export function sanitizeWidgetSettings(input: Record<string, unknown>): WidgetSettingsInput {
  const hexColor = /^#[0-9a-fA-F]{6}$/;
  const accentColor =
    typeof input.accentColor === "string" && hexColor.test(input.accentColor)
      ? input.accentColor
      : DEFAULT_WIDGET_SETTINGS.accentColor;

  return {
    accentColor,
    showPriceBadge: Boolean(input.showPriceBadge),
    showTierTable: Boolean(input.showTierTable),
    showBogoBadge: Boolean(input.showBogoBadge),
    showCountdown: Boolean(input.showCountdown),
    showShippingBar: Boolean(input.showShippingBar),
  };
}

export async function saveWidgetSettings(shopId: string, settings: WidgetSettingsInput) {
  return prisma.widgetSettings.upsert({
    where: { shopId },
    update: settings,
    create: { shopId, ...settings },
  });
}
