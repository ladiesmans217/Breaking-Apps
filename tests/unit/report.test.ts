import { beforeEach, describe, expect, it } from "vitest";
import { buildTruthReport } from "../../src/lib/reporter/truth-report";
import { createOrder, resetStore } from "../../src/lib/store/state";

describe("Truth Report", () => {
  beforeEach(() => {
    resetStore();
  });

  it("ships when every claim matches the oracle", () => {
    const order = createOrder({
      customerEmail: "unit@receiptripper.test",
      customerName: "Unit Shopper",
      couponCode: "SAVE20",
      cart: [
        { productId: "monsoon-hoodie", quantity: 1 },
        { productId: "ledger-mug", quantity: 1 },
      ],
    });

    const report = buildTruthReport({ orderId: order.id, mode: "honest", scenario: "unit-honest" });

    expect(report.decision).toBe("SHIP");
    expect(report.truthScore).toBe(100);
    expect(report.mismatches).toHaveLength(0);
  });

  it("blocks shipment when checkout and invoice lie", () => {
    resetStore({ BUG_COUPON_LIES: true, BUG_INVOICE_CENT_OFF: true });
    const order = createOrder({
      customerEmail: "unit@receiptripper.test",
      customerName: "Unit Shopper",
      couponCode: "SAVE20",
      cart: [
        { productId: "monsoon-hoodie", quantity: 1 },
        { productId: "ledger-mug", quantity: 1 },
      ],
    });

    const report = buildTruthReport({ orderId: order.id, mode: "mutant", scenario: "unit-mutant" });

    expect(report.decision).toBe("DO NOT SHIP");
    expect(report.truthScore).toBeLessThan(100);
    expect(report.mismatches.map((mismatch) => mismatch.source)).toEqual(
      expect.arrayContaining(["checkout", "confirmation", "invoice"]),
    );
  });
});
