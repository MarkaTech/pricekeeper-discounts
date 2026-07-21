import { describe, it, expect } from "vitest";
import { decimalToMinorUnits, minorUnitsToDecimal, applyPercentage, subtractDiscount, currencyExponent } from "../src/engine/money";

describe("money.ts — exact minor-unit math", () => {
  it("converts standard 2-decimal currencies", () => {
    expect(decimalToMinorUnits("19.99", "USD")).toBe(1999n);
    expect(minorUnitsToDecimal(1999n, "USD")).toBe("19.99");
  });

  it("handles JPY as zero-decimal", () => {
    expect(currencyExponent("JPY")).toBe(0);
    expect(decimalToMinorUnits("1500", "JPY")).toBe(1500n);
    expect(minorUnitsToDecimal(1500n, "JPY")).toBe("1500");
  });

  it("handles BHD as three-decimal", () => {
    expect(currencyExponent("BHD")).toBe(3);
    expect(decimalToMinorUnits("12.500", "BHD")).toBe(12500n);
    expect(minorUnitsToDecimal(12500n, "BHD")).toBe("12.500");
  });

  it("applies percentage with correct rounding", () => {
    expect(applyPercentage(1000n, 20)).toBe(200n);
    expect(applyPercentage(999n, 33.33)).toBe(333n); // rounds half up
  });

  it("subtractDiscount never goes negative", () => {
    expect(subtractDiscount(100n, 100)).toBe(0n);
    expect(subtractDiscount(0n, 50)).toBe(0n);
  });

  it("round-trips negative amounts (refund scenarios)", () => {
    expect(minorUnitsToDecimal(decimalToMinorUnits("-5.00", "USD"), "USD")).toBe("-5.00");
  });
});
