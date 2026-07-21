import { describe, it, expect } from "vitest";
import { allocateBogo } from "../src/engine/bogo";

describe("bogo.ts — buy X get Y allocation", () => {
  it("allocates one free-gift unit for a simple 2-for-1", () => {
    const allocations = allocateBogo(
      { buyQuantity: 2, getQuantity: 1, getDiscountPercentage: 100 },
      [{ id: "buy-line", quantity: 2, pool: "BUY" }],
      [{ id: "get-line", quantity: 1, pool: "GET" }],
    );
    expect(allocations).toEqual([{ lineId: "get-line", discountedUnits: 1 }]);
  });

  it("respects maxRepeats cap", () => {
    const allocations = allocateBogo(
      { buyQuantity: 2, getQuantity: 1, getDiscountPercentage: 100, maxRepeats: 1 },
      [{ id: "buy-line", quantity: 6, pool: "BUY" }], // would qualify for 3 repeats
      [{ id: "get-line", quantity: 5, pool: "GET" }],
    );
    expect(allocations).toEqual([{ lineId: "get-line", discountedUnits: 1 }]);
  });

  it("returns no allocation when buy quantity is insufficient", () => {
    const allocations = allocateBogo(
      { buyQuantity: 2, getQuantity: 1, getDiscountPercentage: 100 },
      [{ id: "buy-line", quantity: 1, pool: "BUY" }],
      [{ id: "get-line", quantity: 1, pool: "GET" }],
    );
    expect(allocations).toEqual([]);
  });

  it("caps discounted units at the get-line's available quantity", () => {
    const allocations = allocateBogo(
      { buyQuantity: 1, getQuantity: 5, getDiscountPercentage: 100 },
      [{ id: "buy-line", quantity: 1, pool: "BUY" }],
      [{ id: "get-line", quantity: 2, pool: "GET" }],
    );
    expect(allocations).toEqual([{ lineId: "get-line", discountedUnits: 2 }]);
  });
});
