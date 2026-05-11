import { expect, test } from "@playwright/test";
import {
  buildReport,
  downloadInvoiceText,
  exercisePassmarkEmailProvider,
  resetApp,
  shop,
} from "../support/flows";

test.describe.configure({ mode: "serial" });

test("coupon truth across UI, email, admin, API, and invoice @honest", async ({ page, request }) => {
  await resetApp(request);
  const orderId = await shop(page, {
    products: ["Monsoon Hoodie", "Ledger Mug"],
    couponCode: "SAVE20",
    customerEmail: "honest-coupon@receiptripper.test",
  });

  const invoiceText = await downloadInvoiceText(page, orderId, "honest-coupon");
  const report = await buildReport(request, orderId, "honest-coupon", "honest", { invoiceText });

  expect(report.decision).toBe("SHIP");
  expect(report.truthScore).toBe(100);
  expect(report.mismatches).toHaveLength(0);
});

test("coupon truth catches checkout and confirmation lies @mutant", async ({ page, request }) => {
  await resetApp(request, { BUG_COUPON_LIES: true });
  const orderId = await shop(page, {
    products: ["Monsoon Hoodie", "Ledger Mug"],
    couponCode: "SAVE20",
    customerEmail: "mutant-coupon@receiptripper.test",
  });

  const report = await buildReport(request, orderId, "mutant-coupon", "mutant");

  expect(report.decision).toBe("DO NOT SHIP");
  expect(report.mismatches.map((mismatch) => mismatch.source)).toEqual(
    expect.arrayContaining(["checkout", "confirmation"]),
  );
});

test("tax rounding truth catches one-paisa checkout drift @mutant", async ({ page, request }) => {
  await resetApp(request, { BUG_TAX_ROUNDING_DRIFT: true });
  const orderId = await shop(page, {
    products: ["Precision Mat", "Copper Cable", "One Paisa Washer"],
    customerEmail: "mutant-rounding@receiptripper.test",
  });

  const report = await buildReport(request, orderId, "mutant-tax-rounding", "mutant");

  expect(report.decision).toBe("DO NOT SHIP");
  expect(report.mismatches).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ source: "checkout", field: "tax" }),
      expect.objectContaining({ source: "checkout", field: "total" }),
    ]),
  );
});

test("free-shipping threshold truth catches a false banner at ₹1,999.99 @mutant", async ({ page, request }) => {
  await resetApp(request, { BUG_FREE_SHIPPING_THRESHOLD_WRONG: true });
  const orderId = await shop(page, {
    products: ["Threshold Pack"],
    customerEmail: "mutant-threshold@receiptripper.test",
  });

  const report = await buildReport(request, orderId, "mutant-threshold", "mutant");

  expect(report.decision).toBe("DO NOT SHIP");
  expect(report.mismatches).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ source: "cart", field: "shipping" }),
      expect.objectContaining({ source: "checkout", field: "shipping" }),
    ]),
  );
});

test("email receipt truth uses local Passmark email extraction @mutant", async ({ page, request }) => {
  await resetApp(request, { BUG_EMAIL_TOTAL_WRONG: true });
  const email = "mutant-email@receiptripper.test";
  const orderId = await shop(page, {
    products: ["Monsoon Hoodie", "Ledger Mug"],
    couponCode: "SAVE20",
    customerEmail: email,
  });

  await exercisePassmarkEmailProvider(page, email);
  const report = await buildReport(request, orderId, "mutant-email", "mutant");

  expect(report.decision).toBe("DO NOT SHIP");
  expect(report.mismatches).toEqual(
    expect.arrayContaining([expect.objectContaining({ source: "email", field: "total" })]),
  );
});

test("invoice, admin, and API truth separates bad evidence from good API data @mutant", async ({ page, request }) => {
  await resetApp(request, { BUG_INVOICE_CENT_OFF: true, BUG_ADMIN_IGNORES_SHIPPING: true });
  const orderId = await shop(page, {
    products: ["Precision Mat", "Copper Cable", "One Paisa Washer"],
    customerEmail: "mutant-invoice-admin@receiptripper.test",
  });

  const invoiceText = await downloadInvoiceText(page, orderId, "mutant-invoice-admin");
  const report = await buildReport(request, orderId, "mutant-invoice-admin", "mutant", { invoiceText });

  expect(report.decision).toBe("DO NOT SHIP");
  expect(report.mismatches).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ source: "invoice", field: "total" }),
      expect.objectContaining({ source: "admin", field: "shipping" }),
      expect.objectContaining({ source: "admin", field: "total" }),
    ]),
  );
  expect(report.mismatches.some((mismatch) => mismatch.source === "api")).toBe(false);
});
