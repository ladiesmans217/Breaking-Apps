import { describe, expect, it } from "vitest";
import { buildOrderLines, computeTruth } from "../../src/lib/truth/oracle";
import { PRODUCTS } from "../../src/lib/store/state";
import { formatINRForLocale, parseLocalizedMoneyWithFlags, SUPPORTED_LOCALES } from "../../src/lib/truth/money";

describe("money oracle", () => {
  it("computes coupon, tax, shipping, and total with Decimal math", () => {
    const lines = buildOrderLines(PRODUCTS, [
      { productId: "monsoon-hoodie", quantity: 1 },
      { productId: "ledger-mug", quantity: 1 },
    ]);

    expect(computeTruth(lines, "SAVE20")).toEqual({
      subtotal: "2399.00",
      discount: "479.80",
      tax: "345.46",
      shipping: "0.00",
      total: "2264.66",
    });
  });

  it("handles awkward values without floating-point drift", () => {
    const lines = buildOrderLines(PRODUCTS, [
      { productId: "precision-mat", quantity: 1 },
      { productId: "copper-cable", quantity: 1 },
      { productId: "one-paisa-washer", quantity: 1 },
    ]);

    expect(computeTruth(lines)).toEqual({
      subtotal: "1149.95",
      discount: "0.00",
      tax: "206.99",
      shipping: "99.00",
      total: "1455.94",
    });
  });

  it("honors the free-shipping threshold at exactly ₹2,000.00", () => {
    const under = computeTruth(buildOrderLines(PRODUCTS, [{ productId: "threshold-pack", quantity: 1 }]));
    const edge = computeTruth(buildOrderLines(PRODUCTS, [{ productId: "threshold-edge-pack", quantity: 1 }]));
    const over = computeTruth(buildOrderLines(PRODUCTS, [{ productId: "free-ship-pack", quantity: 1 }]));

    expect(under.shipping).toBe("99.00");
    expect(edge.shipping).toBe("0.00");
    expect(over.shipping).toBe("0.00");
  });

  it("round-trips formatted INR values across supported locales", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const formatted = formatINRForLocale("1234.56", locale);
      expect(parseLocalizedMoneyWithFlags(formatted, locale)).toBe("1234.56");
    }
  });

  it("can expose a German decimal parsing drift", () => {
    const formatted = formatINRForLocale("1234.56", "de-DE");
    expect(parseLocalizedMoneyWithFlags(formatted, "de-DE", true)).not.toBe("1234.56");
  });
});
