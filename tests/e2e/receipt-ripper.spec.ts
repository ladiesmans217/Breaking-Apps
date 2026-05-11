import { expect, test } from "@playwright/test";
import {
  buildReport,
  downloadInvoiceText,
  exercisePassmarkEmailProvider,
  publishAggregateRun,
  resetApp,
  shop,
} from "../support/flows";
import { formatINRForLocale, parseLocalizedMoneyWithFlags, SUPPORTED_LOCALES } from "../../src/lib/truth/money";
import type { TruthReport } from "../../src/lib/truth/types";

test.describe.configure({ mode: "serial" });

const fullReports: TruthReport[] = [];

test("coupon truth across UI, email, admin, API, and invoice @honest", async ({ page, request }) => {
  await resetApp(request);
  const orderId = await shop(page, {
    products: ["Monsoon Hoodie", "Ledger Mug"],
    couponCode: "SAVE20",
    customerEmail: "honest-coupon@receiptripper.test",
  });

  const invoiceText = await downloadInvoiceText(page, orderId, "honest-coupon");
  const report = await buildReport(request, orderId, "honest-coupon", "honest", { invoiceText }, page);
  fullReports.push(report);

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

  const report = await buildReport(request, orderId, "mutant-coupon", "mutant", {}, page);

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

  const report = await buildReport(request, orderId, "mutant-tax-rounding", "mutant", {}, page);

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

  const report = await buildReport(request, orderId, "mutant-threshold", "mutant", {}, page);

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
  const report = await buildReport(request, orderId, "mutant-email", "mutant", {}, page);

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
  const report = await buildReport(request, orderId, "mutant-invoice-admin", "mutant", { invoiceText }, page);

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

test("product page to cart truth keeps visible subtotal aligned @full", async ({ page, request }) => {
  await resetApp(request);
  await page.goto("/");
  await page.getByLabel("Add Monsoon Hoodie to cart").click();
  await expect(page.getByText("Visible product subtotal")).toBeVisible();
  await expect(page.locator(".total-row").filter({ hasText: "Visible product subtotal" }).locator("strong")).toHaveText(
    "₹1,999.00",
  );

  const orderId = await shop(page, {
    products: ["Monsoon Hoodie"],
    couponCode: "",
    customerEmail: "full-product-cart@receiptripper.test",
  });
  const report = await buildReport(request, orderId, "full-product-cart", "honest", {}, page);
  fullReports.push(report);
});

test("free-shipping threshold truth covers under, exact, and over boundaries @full", async ({ page, request }) => {
  const cases = [
    { product: "Threshold Pack", label: "under", expectedShipping: "99.00" },
    { product: "Threshold Edge Pack", label: "exact", expectedShipping: "0.00" },
    { product: "Free Ship Pack", label: "over", expectedShipping: "0.00" },
  ];

  for (const boundary of cases) {
    await resetApp(request);
    const orderId = await shop(page, {
      products: [boundary.product],
      couponCode: "",
      customerEmail: `${boundary.product.toLowerCase().replaceAll(" ", "-")}@receiptripper.test`,
    });
    const report = await buildReport(request, orderId, `full-threshold-${boundary.label}`, "honest", {}, page);
    fullReports.push(report);
    expect(report.expected.shipping).toBe(boundary.expectedShipping);
    expect(report.decision).toBe("SHIP");
  }
});

test("locale currency truth round-trips visible INR values across five locales @full", async ({ page, request }) => {
  await resetApp(request);
  const checks: TruthReport["evidence"]["localeChecks"] = [];

  for (const locale of SUPPORTED_LOCALES) {
    await page.goto("/");
    await page.getByLabel("Locale", { exact: true }).selectOption(locale);
    await page.getByLabel("Add Locale Ledger to cart").click();
    const formatted = await page.locator(".total-row").filter({ hasText: "Visible product subtotal" }).locator("strong").innerText();
    checks.push({
      locale,
      formatted,
      parsed: parseLocalizedMoneyWithFlags(formatted, locale),
      expected: "1234.56",
    });
    expect(parseLocalizedMoneyWithFlags(formatted, locale)).toBe("1234.56");
  }

  const orderId = await shop(page, {
    products: ["Locale Ledger"],
    customerEmail: "locale-honest@receiptripper.test",
    locale: "fr-FR",
  });
  const report = await buildReport(request, orderId, "full-locale", "honest", { localeChecks: checks }, page);
  fullReports.push(report);
  expect(report.decision).toBe("SHIP");
});

test("inventory race allows only one buyer to purchase the last stock item @full", async ({ request }) => {
  await resetApp(request);
  const payload = (email: string) => ({
    customerEmail: email,
    customerName: "Race Buyer",
    cart: [{ productId: "last-stock-poster", quantity: 1 }],
  });

  const [first, second] = await Promise.all([
    request.post("/api/orders", { data: payload("race-one@receiptripper.test") }),
    request.post("/api/orders", { data: payload("race-two@receiptripper.test") }),
  ]);
  const statuses = [first.status(), second.status()].sort();
  expect(statuses).toEqual([201, 409]);

  const winner = first.status() === 201 ? first : second;
  const data = (await winner.json()) as { order: { id: string } };
  const report = await buildReport(request, data.order.id, "full-inventory-race", "honest");
  fullReports.push(report);
});

test("inventory mutant proves the double-sell detector catches both orders succeeding @mutant", async ({ request }) => {
  await resetApp(request, { BUG_INVENTORY_DOUBLE_SELLS: true });
  const payload = (email: string) => ({
    customerEmail: email,
    customerName: "Race Buyer",
    cart: [{ productId: "last-stock-poster", quantity: 1 }],
  });

  const [first, second] = await Promise.all([
    request.post("/api/orders", { data: payload("mutant-race-one@receiptripper.test") }),
    request.post("/api/orders", { data: payload("mutant-race-two@receiptripper.test") }),
  ]);

  expect([first.status(), second.status()]).toEqual([201, 201]);
});

test("locale mutant catches decimal drift in de-DE parsing @mutant", async ({ page, request }) => {
  await resetApp(request, { BUG_LOCALE_DECIMAL_DRIFT: true });
  const formatted = formatINRForLocale("1234.56", "de-DE");
  const parsed = parseLocalizedMoneyWithFlags(formatted, "de-DE", true);
  expect(parsed).not.toBe("1234.56");

  const orderId = await shop(page, {
    products: ["Locale Ledger"],
    customerEmail: "mutant-locale@receiptripper.test",
    locale: "de-DE",
  });
  const report = await buildReport(
    request,
    orderId,
    "mutant-locale",
    "mutant",
    { localeChecks: [{ locale: "de-DE", formatted, parsed, expected: "1234.56" }] },
    page,
  );
  expect(report.decision).toBe("SHIP");
});

test("publishes aggregate full truth run @full", async ({ request }) => {
  expect(fullReports.length).toBeGreaterThanOrEqual(6);
  const run = await publishAggregateRun(request, fullReports);
  expect(run.truthScore).toBe(100);
  expect(run.decision).toBe("SHIP");
});
