import { expect, test as playwrightTest, type APIRequestContext, type Page } from "@playwright/test";
import { runSteps } from "passmark";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import { renderTruthReportHtml, renderTruthRunHtml } from "../../src/lib/reporter/render";
import type { BugFlags, TruthReport, TruthRun } from "../../src/lib/truth/types";
import { configurePassmark, shouldUsePassmarkAI } from "./passmark";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3100";

export type CheckoutInput = {
  products: string[];
  couponCode?: string;
  customerEmail: string;
  customerName?: string;
  locale?: string;
};

export async function resetApp(request: APIRequestContext, flags: BugFlags = {}) {
  const response = await request.post(`${BASE_URL}/api/test/reset`, { data: { flags } });
  expect(response.ok()).toBeTruthy();
}

async function rawShop(page: Page, input: CheckoutInput): Promise<string> {
  await page.goto("/");
  for (const product of input.products) {
    await page.getByLabel(`Add ${product} to cart`).click();
  }
  await page.getByLabel("Coupon").fill(input.couponCode ?? "");
  await page.getByLabel("Name").fill(input.customerName ?? "Ada Lovelace");
  await page.getByLabel("Email").fill(input.customerEmail);
  if (input.locale) {
    await page.getByLabel("Locale", { exact: true }).selectOption(input.locale);
  }
  await page.getByRole("button", { name: "Checkout" }).click();
  await page.waitForURL(/\/checkout\/co_/);
  await page.getByRole("button", { name: "Place order" }).click();
  await page.waitForURL(/\/orders\/rr_/);
  return page.url().split("/").at(-1) ?? "";
}

async function passmarkShop(page: Page, input: CheckoutInput): Promise<string> {
  await page.goto("/");
  await runSteps({
    page,
    userFlow: "ReceiptRipper checkout truth flow",
    steps: [
      ...input.products.map((product) => ({ description: `Click the Add button for ${product}` })),
      { description: "Fill the Coupon input", data: { value: input.couponCode ?? "" } },
      { description: "Fill the Name input", data: { value: input.customerName ?? "Ada Lovelace" } },
      { description: "Fill the Email input", data: { value: input.customerEmail } },
      ...(input.locale ? [{ description: "Select the Locale option", data: { value: input.locale } }] : []),
      { description: "Click the Checkout button" },
      { description: "Click the Place order button" },
    ],
    assertions: [{ assertion: "The order confirmation page is visible and shows an order total." }],
    test: playwrightTest,
    expect,
  });
  await page.waitForURL(/\/orders\/rr_/);
  await page.waitForURL(/\/orders\/rr_/);
  return page.url().split("/").at(-1) ?? "";
}

export async function shop(page: Page, input: CheckoutInput): Promise<string> {
  configurePassmark(BASE_URL);
  return shouldUsePassmarkAI() ? passmarkShop(page, input) : rawShop(page, input);
}

export async function shopWithPassmark(page: Page, input: CheckoutInput): Promise<string> {
  configurePassmark(BASE_URL);
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is required for the Passmark checkout test.");
  }
  return passmarkShop(page, input);
}

export async function exercisePassmarkEmailProvider(page: Page, email: string): Promise<void> {
  configurePassmark(BASE_URL);
  await runSteps({
    page,
    userFlow: "ReceiptRipper email extraction",
    steps: [
      {
        description: "Extract the receipt total from the local inbox",
        isScript: true,
        data: { receiptTotal: `{{email.total:extract the Total amount:${email}}}` },
        script: "await page.locator('body').waitFor();",
      },
    ],
    test: playwrightTest,
  });
}

export async function buildReport(
  request: APIRequestContext,
  orderId: string,
  scenario: string,
  mode: "honest" | "mutant",
  evidence: TruthReport["evidence"] = {},
  page?: Page,
): Promise<TruthReport> {
  const screenshotPath = path.join("reports", "evidence", `${scenario}.png`);
  await mkdir(path.join(process.cwd(), "reports", "evidence"), { recursive: true });
  if (page) {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }
  const response = await request.post(`${BASE_URL}/api/truth`, {
    data: {
      orderId,
      scenario,
      mode,
      evidence: {
        reproCommand: `npx playwright test tests/e2e --grep ${scenario}`,
        screenshot: page ? screenshotPath : undefined,
        ...evidence,
      },
    },
  });
  expect(response.ok()).toBeTruthy();
  const data = (await response.json()) as { report: TruthReport };
  await persistReport(data.report, scenario);
  return data.report;
}

async function persistReport(report: TruthReport, scenario: string): Promise<void> {
  const reportsDir = path.join(process.cwd(), "reports");
  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, `${scenario}.json`), JSON.stringify(report, null, 2));
  await writeFile(path.join(reportsDir, `${scenario}.html`), renderTruthReportHtml(report));
}

export async function publishAggregateRun(request: APIRequestContext, reports: TruthReport[]): Promise<TruthRun> {
  const response = await request.put(`${BASE_URL}/api/truth`, { data: { reports } });
  expect(response.ok()).toBeTruthy();
  const data = (await response.json()) as { run: TruthRun };
  const reportsDir = path.join(process.cwd(), "reports");
  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "index.json"), JSON.stringify(data.run, null, 2));
  await writeFile(path.join(reportsDir, "index.html"), renderTruthRunHtml(data.run));
  return data.run;
}

export async function downloadInvoiceText(page: Page, orderId: string, scenario: string): Promise<string> {
  await page.goto(`/orders/${orderId}`);
  const href = await page.getByRole("link", { name: "Invoice" }).getAttribute("href");
  expect(href).toBeTruthy();
  const response = await page.request.get(`${BASE_URL}${href}`);
  expect(response.ok()).toBeTruthy();
  const invoiceDir = path.join(process.cwd(), "reports", "invoices");
  await mkdir(invoiceDir, { recursive: true });
  const invoicePath = path.join(invoiceDir, `${scenario}.pdf`);
  const body = await response.body();
  await writeFile(invoicePath, body);

  const parser = new PDFParse({ data: body });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}
