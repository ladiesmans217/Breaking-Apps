import { expect, test } from "@playwright/test";
import { buildReport, resetApp, shopWithPassmark } from "../support/flows";

test("Passmark shops the store and the money oracle approves it @passmark", async ({ page, request }) => {
  test.setTimeout(120_000);
  await resetApp(request);

  const orderId = await shopWithPassmark(page, {
    products: ["Monsoon Hoodie", "Ledger Mug"],
    couponCode: "SAVE20",
    customerEmail: "passmark-shopper@receiptripper.test",
  });

  const report = await buildReport(request, orderId, "passmark-checkout", "honest", {}, page);

  expect(report.decision).toBe("SHIP");
  expect(report.truthScore).toBe(100);
});
