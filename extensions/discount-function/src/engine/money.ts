// Exact BigInt minor-unit money math. Never use floating point for money —
// this is why the engine imports nothing from Shopify: it's pure, and
// unit-testable without the CLI.

export const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW", "VND", "CLP", "ISK"]);
export const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "KWD", "OMR", "JOD", "TND"]);

export function currencyExponent(currency: string): number {
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(currency)) return 3;
  return 2;
}

export function decimalToMinorUnits(decimal: string, currency: string): bigint {
  const exponent = currencyExponent(currency);
  const [whole, frac = ""] = decimal.split(".");
  const paddedFrac = (frac + "0".repeat(exponent)).slice(0, exponent);
  const sign = whole.startsWith("-") ? -1n : 1n;
  const digits = whole.replace("-", "") + paddedFrac;
  return sign * BigInt(digits || "0");
}

export function minorUnitsToDecimal(minor: bigint, currency: string): string {
  const exponent = currencyExponent(currency);
  if (exponent === 0) return minor.toString();
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const str = abs.toString().padStart(exponent + 1, "0");
  const whole = str.slice(0, -exponent);
  const frac = str.slice(-exponent);
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

export function applyPercentage(amount: bigint, percentage: number): bigint {
  // percentage as e.g. 20 for 20%; round half up, deterministic across runs.
  const scaled = amount * BigInt(Math.round(percentage * 100));
  const divisor = 10_000n;
  const quotient = scaled / divisor;
  const remainder = scaled % divisor;
  // round half up
  return remainder * 2n >= divisor ? quotient + 1n : quotient;
}

export function subtractDiscount(original: bigint, percentage: number): bigint {
  const discount = applyPercentage(original, percentage);
  const result = original - discount;
  return result < 0n ? 0n : result;
}
