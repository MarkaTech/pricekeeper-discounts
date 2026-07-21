import { describe, it, expect } from "vitest";
import { parseConfig } from "../src/engine/config";

describe("config.ts — fail-closed parseConfig", () => {
  it("returns null (never throws) on malformed JSON", () => {
    expect(parseConfig("{not json")).toBeNull();
  });

  it("returns null on missing required fields", () => {
    expect(parseConfig(JSON.stringify({ type: "PERCENTAGE", targeting: { scope: "STORE" } }))).toBeNull();
  });

  it("returns null on unknown campaign type", () => {
    expect(parseConfig(JSON.stringify({ type: "MYSTERY", targeting: { scope: "STORE" } }))).toBeNull();
  });

  it("returns null on out-of-range percentage", () => {
    expect(parseConfig(JSON.stringify({ type: "PERCENTAGE", percentage: 150, targeting: { scope: "STORE" } }))).toBeNull();
  });

  it("accepts a valid PERCENTAGE config", () => {
    const cfg = parseConfig(JSON.stringify({ type: "PERCENTAGE", percentage: 20, targeting: { scope: "STORE" } }));
    expect(cfg?.percentage).toBe(20);
  });

  it("accepts a valid VOLUME config with tiers", () => {
    const cfg = parseConfig(
      JSON.stringify({
        type: "VOLUME",
        tiers: [{ minQuantity: 3, percentage: 10 }],
        targeting: { scope: "COLLECTIONS", collectionIds: ["gid://shopify/Collection/1"] },
      }),
    );
    expect(cfg?.tiers?.length).toBe(1);
  });

  it("rejects VOLUME with empty tiers", () => {
    expect(
      parseConfig(JSON.stringify({ type: "VOLUME", tiers: [], targeting: { scope: "STORE" } })),
    ).toBeNull();
  });

  it("rejects BOGO missing buy/get quantities", () => {
    expect(parseConfig(JSON.stringify({ type: "BOGO", bogo: {}, targeting: { scope: "STORE" } }))).toBeNull();
  });

  it("null input returns null", () => {
    expect(parseConfig(null)).toBeNull();
    expect(parseConfig(undefined)).toBeNull();
  });
});
