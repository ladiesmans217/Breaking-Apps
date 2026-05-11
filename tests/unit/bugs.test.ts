import { describe, expect, it } from "vitest";
import { applyBugFlags } from "../../src/lib/truth/bugs";
import { createOrder, InsufficientInventoryError, resetStore } from "../../src/lib/store/state";
import type { MoneyBreakdown } from "../../src/lib/truth/types";

const base: MoneyBreakdown = {
  subtotal: "2399.00",
  discount: "479.80",
  tax: "345.46",
  shipping: "0.00",
  total: "2264.66",
};

describe("seeded commerce lies", () => {
  it("makes checkout lie about coupon totals", () => {
    const observed = applyBugFlags("checkout", base, { BUG_COUPON_LIES: true }, "SAVE20");
    expect(observed.total).toBe("1784.86");
  });

  it("makes email receipts report subtotal as total", () => {
    const observed = applyBugFlags("email", base, { BUG_EMAIL_TOTAL_WRONG: true }, "SAVE20");
    expect(observed.total).toBe("2399.00");
  });

  it("makes admin ignore shipping without affecting the API claim", () => {
    const shippingBase = { ...base, shipping: "99.00", total: "2363.66" };
    const admin = applyBugFlags("admin", shippingBase, { BUG_ADMIN_IGNORES_SHIPPING: true }, "SAVE20");
    const api = applyBugFlags("api", shippingBase, { BUG_ADMIN_IGNORES_SHIPPING: true }, "SAVE20");

    expect(admin.shipping).toBe("0.00");
    expect(admin.total).toBe("2264.66");
    expect(api.total).toBe("2363.66");
  });

  it("prevents double-selling the last stock item by default", () => {
    resetStore();
    createOrder({
      customerEmail: "one@receiptripper.test",
      customerName: "Buyer One",
      cart: [{ productId: "last-stock-poster", quantity: 1 }],
    });

    expect(() =>
      createOrder({
        customerEmail: "two@receiptripper.test",
        customerName: "Buyer Two",
        cart: [{ productId: "last-stock-poster", quantity: 1 }],
      }),
    ).toThrow(InsufficientInventoryError);
  });

  it("can seed an inventory double-sell bug", () => {
    resetStore({ BUG_INVENTORY_DOUBLE_SELLS: true });
    const first = createOrder({
      customerEmail: "one@receiptripper.test",
      customerName: "Buyer One",
      cart: [{ productId: "last-stock-poster", quantity: 1 }],
    });
    const second = createOrder({
      customerEmail: "two@receiptripper.test",
      customerName: "Buyer Two",
      cart: [{ productId: "last-stock-poster", quantity: 1 }],
    });

    expect(first.id).not.toBe(second.id);
  });
});
