import { describe, it, expect } from "vitest";
import { isTargeted } from "../src/engine/targeting";

describe("targeting.ts", () => {
  it("STORE scope targets everything not excluded", () => {
    expect(isTargeted({ scope: "STORE" }, { variantId: "v1", productId: "p1" })).toBe(true);
  });

  it("excluded collection always wins", () => {
    expect(
      isTargeted({ scope: "STORE" }, { variantId: "v1", productId: "p1", inExcludedCollections: true }),
    ).toBe(false);
  });

  it("COLLECTIONS scope requires inTargetCollections", () => {
    expect(
      isTargeted({ scope: "COLLECTIONS" }, { variantId: "v1", productId: "p1", inTargetCollections: false }),
    ).toBe(false);
    expect(
      isTargeted({ scope: "COLLECTIONS" }, { variantId: "v1", productId: "p1", inTargetCollections: true }),
    ).toBe(true);
  });

  it("PRODUCTS scope matches product ID list", () => {
    expect(
      isTargeted({ scope: "PRODUCTS", productIds: ["p1"] }, { variantId: "v1", productId: "p1" }),
    ).toBe(true);
    expect(
      isTargeted({ scope: "PRODUCTS", productIds: ["p2"] }, { variantId: "v1", productId: "p1" }),
    ).toBe(false);
  });

  it("excludedProductIds overrides an otherwise-matching product", () => {
    expect(
      isTargeted(
        { scope: "STORE", excludedProductIds: ["p1"] },
        { variantId: "v1", productId: "p1" },
      ),
    ).toBe(false);
  });

  it("customer tag gating requires a matching tag", () => {
    const targeting = { scope: "STORE" as const, customerTags: ["wholesale"] };
    expect(isTargeted(targeting, { variantId: "v1", productId: "p1" }, [])).toBe(false);
    expect(isTargeted(targeting, { variantId: "v1", productId: "p1" }, ["wholesale"])).toBe(true);
  });

  it("logged-in gate blocks anonymous carts", () => {
    const targeting = { scope: "STORE" as const, requiresLogin: true };
    expect(isTargeted(targeting, { variantId: "v1", productId: "p1" }, [], false)).toBe(false);
    expect(isTargeted(targeting, { variantId: "v1", productId: "p1" }, [], true)).toBe(true);
  });
});
