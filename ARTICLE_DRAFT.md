Most end-to-end tests ask a simple question:

> Can the user buy something?

I wanted to ask a more uncomfortable question:

> Did the store tell the same money truth everywhere?

That became **ReceiptRipper**, a controlled local commerce app plus a Passmark regression gauntlet.

Passmark shops through the store like a user. Playwright records the evidence. A deterministic Decimal oracle checks the totals. The app either tells the same truth across product page, cart, checkout, confirmation, email receipt, admin dashboard, API, and invoice, or the report says:

```txt
DO NOT SHIP
```

The project thesis is simple:

> **AI is the shopper. Math is the judge.**

![ReceiptRipper storefront](https://raw.githubusercontent.com/ladiesmans217/Breaking-Apps/main/article-assets/storefront.png)

## Why I Built A Controlled Store

For the Breaking Apps Hackathon, the obvious move was to point Passmark at a public demo app and write a suite of natural-language regression tests.

That works, but I wanted a test target where every failure was reproducible. Money bugs are especially good for this because they do not need much explanation. If checkout says one total and the invoice says another, nobody argues that the test is being picky.

So I built **ReceiptRipper Store**, a local Next.js commerce app with the exact surfaces I wanted to test:

1. Product grid
2. Cart
3. Checkout
4. Confirmation page
5. Email receipt
6. Admin order page
7. Order API
8. Invoice PDF
9. Truth report dashboard

There is no real payment processor, no SMTP server, no Docker, no Medusa, no Saleor, and no database in the MVP. That was intentional. The point was not to recreate all of commerce. The point was to create a clean lab for one question:

> When checkout claims a total, can every other surface prove it?

## What ReceiptRipper Checks

The store uses INR money rules:

```txt
Coupon: SAVE20 gives 20% off
Tax: 18%
Shipping: INR 99.00
Free shipping threshold: INR 2,000.00
Currency: INR
Rounding: exact Decimal math, rounded to 2 decimal places at the boundary
```

The oracle computes:

```txt
subtotal = sum(line totals)
discount = subtotal * 0.20 when coupon is SAVE20
discountedSubtotal = subtotal - discount
tax = discountedSubtotal * 0.18
shipping = 0 when subtotal >= 2000.00, otherwise 99.00
total = discountedSubtotal + tax + shipping
```

Then the report compares expected values against every observed source:

```txt
product page
cart
checkout
confirmation page
email receipt
admin order
order API
invoice PDF
```

A normal browser test might pass because the confirmation page appeared. ReceiptRipper can still fail because the email receipt, invoice, or admin view disagreed with the math.

That distinction is the whole project.

## Architecture

The stack is boring on purpose:

| Layer | What it does |
| --- | --- |
| Next.js App Router | Local controlled store, admin, API, invoice, and truth dashboard |
| Passmark | Drives checkout in plain English through Playwright |
| OpenRouter | Routes Passmark model calls through the hackathon API key |
| Playwright | Runs the browser, downloads invoices, captures evidence, and calls APIs |
| Decimal.js | Computes the source of truth for money |
| PDFKit | Generates invoice PDFs |
| pdf-parse | Extracts invoice text during tests |
| Vitest | Unit tests the oracle, bug flags, and report scoring |

Passmark is the user layer. It reads and acts on the UI like a shopper.

The oracle is the truth layer. It does not ask an AI whether a number looks right. It computes the number.

The reporter is the evidence layer. It writes JSON and HTML reports so a failure is not just "test failed", but a bug card with expected values, observed values, mismatches, and a shipping decision.

## Passmark Setup

The hackathon provides OpenRouter credits, so I configured Passmark to use OpenRouter. I also used snapshot mode because I wanted this to stay compatible with the hackathon key and Passmark's normal Playwright flow.

```ts
import { configure } from "passmark";

configure({
  ai: {
    gateway: "openrouter",
    mode: "snapshot",
    models: {
      stepExecution: "google/gemini-2.0-flash-lite-001",
      assertionPrimary: "google/gemini-2.0-flash-lite-001",
      assertionSecondary: "google/gemini-2.0-flash-lite-001",
      assertionArbiter: "google/gemini-2.0-flash-lite-001",
      utility: "google/gemini-2.0-flash-lite-001",
    },
  },
  email: localInboxProvider(baseURL),
});
```

My local `.env` contains:

```txt
OPENROUTER_API_KEY=sk-or-...
PASSMARK_AI=on
PASSMARK_LOG_LEVEL=info
```

The API key is not committed.

## The Passmark Checkout Test

The dedicated AI-driven test is small. It resets the app, asks Passmark to shop the store, then lets the oracle judge the generated order.

```ts
test("Passmark shops the store and the money oracle approves it @passmark", async ({ page, request }) => {
  test.setTimeout(120_000);
  await resetApp(request);

  const orderId = await shopWithPassmark(page, {
    products: ["Monsoon Hoodie", "Ledger Mug"],
    couponCode: "SAVE20",
    customerEmail: "passmark-shopper@receiptripper.test",
  });

  const report = await buildReport(request, orderId, "passmark-checkout", "honest");

  expect(report.decision).toBe("SHIP");
  expect(report.truthScore).toBe(100);
});
```

Inside `shopWithPassmark`, the user journey is written in plain English:

```ts
await runSteps({
  page,
  userFlow: "ReceiptRipper checkout truth flow",
  steps: [
    { description: "Click the Add button for Monsoon Hoodie" },
    { description: "Click the Add button for Ledger Mug" },
    { description: "Fill the Coupon input", data: { value: "SAVE20" } },
    { description: "Fill the Name input", data: { value: "Ada Lovelace" } },
    { description: "Fill the Email input", data: { value: "passmark-shopper@receiptripper.test" } },
    { description: "Click the Checkout button" },
  ],
  assertions: [
    { assertion: "The order confirmation page is visible and shows an order total." },
  ],
  test,
  expect,
});
```

That is the part Passmark owns. It can find the UI and complete checkout. Once the order exists, the deterministic report takes over.

## Local Email Without Real SMTP

Receipt bugs often hide in email. A checkout page can be right while the customer receipt is stale, rounded differently, or missing a discount.

I did not want real SMTP in the critical path, so the app has an in-memory local inbox. When an order is created, the store writes an email receipt into process-local state. The test harness provides a custom Passmark email provider that reads from `/api/emails`.

The provider supports Passmark-style email extraction:

```ts
data: {
  receiptTotal: "{{email.total:extract the Total amount:mutant-email@receiptripper.test}}"
}
```

That let me keep the email flow realistic without adding external infrastructure.

## Seeded Bugs

The app can run honestly, or it can run with seeded bug flags. The test API resets state before every spec:

```txt
POST /api/test/reset
```

Each mutant run enables one or more bug flags:

```txt
BUG_COUPON_LIES
BUG_TAX_ROUNDING_DRIFT
BUG_EMAIL_TOTAL_WRONG
BUG_INVOICE_CENT_OFF
BUG_FREE_SHIPPING_THRESHOLD_WRONG
BUG_ADMIN_IGNORES_SHIPPING
```

These are not random failures. Each bug represents a real commerce class of problem:

| Bug | What it simulates |
| --- | --- |
| Coupon lie | Checkout and confirmation ignore the real discount |
| Tax rounding drift | Checkout is off by one paisa on tax and total |
| Email total wrong | Receipt email disagrees with checkout |
| Invoice cent off | PDF invoice total differs by 0.01 |
| Free shipping threshold wrong | UI claims free shipping below the real threshold |
| Admin ignores shipping | Back-office order total does not match the customer-facing order |

This is the part I care about most. The suite is not trying to produce 50 shallow checks. It tries to catch a few expensive lies very clearly.

## Truth Report

Every run writes:

```txt
reports/<scenario>.json
reports/<scenario>.html
```

The report contains:

1. Run ID
2. Order ID
3. Scenario name
4. Expected money breakdown
5. Observed money claims by source
6. Mismatch list
7. Truth score
8. Decision: `SHIP` or `DO NOT SHIP`
9. Evidence such as invoice text

An honest checkout run produces:

```txt
Scenario: passmark-checkout
Decision: SHIP
Truth score: 100

Expected:
Subtotal: INR 2,399.00
Discount: INR 479.80
Tax: INR 345.46
Shipping: INR 0.00
Total: INR 2,264.66
```

The test passes only when every checked source agrees.

## The Red Report

Here is a seeded mutant where the admin order ignores shipping and the invoice is off by one paisa:

![ReceiptRipper red truth report](https://raw.githubusercontent.com/ladiesmans217/Breaking-Apps/main/article-assets/truth-dashboard.png)

The report says:

```txt
Decision: DO NOT SHIP
Truth score: 91

Expected total: INR 1,455.94

Mismatches:
Admin order shipping expected INR 99.00, observed INR 0.00
Admin order total expected INR 1,455.94, observed INR 1,356.94
Invoice PDF total expected INR 1,455.94, observed INR 1,455.95
```

That is the demo moment. The checkout itself can look calm. The report shows where the store lied.

![ReceiptRipper mutant report artifact](https://raw.githubusercontent.com/ladiesmans217/Breaking-Apps/main/article-assets/mutant-invoice-admin-report.png)

## Tests I Shipped

I kept the suite small and sharp.

### Unit Tests

Vitest covers:

1. Money oracle math
2. Coupon calculation
3. Tax rounding
4. Free shipping threshold
5. Bug-flag behavior
6. Truth report scoring

### Passmark And Playwright Tests

The E2E suite covers:

1. A real Passmark checkout flow through the local store
2. Honest coupon truth across UI, email, admin, API, and invoice
3. Coupon lie detection
4. Tax rounding drift detection
5. Free shipping threshold lie detection
6. Email receipt total mismatch detection
7. Invoice/admin/API truth separation

Two execution modes matter:

```txt
npm run truth:honest
npm run truth:mutants
```

`truth:honest` must produce a clean `SHIP` report.

`truth:mutants` must catch the seeded bugs and still exit successfully because the tests expected those mismatches. A mutant run is green only when ReceiptRipper catches the lie.

## Final Local Run

The full verification command passed:

```bash
npm test
```

It ran:

```txt
Vitest unit tests: 8 passed
Real Passmark checkout test: 1 passed
Honest truth run: 1 passed
Mutant truth run: 5 passed
```

I also ran:

```bash
npm run lint
npm run typecheck
npm run build
```

All passed locally.

## What Surprised Me

The biggest lesson was that AI is very useful at the edge of the product, but I do not want it to be the source of truth.

Passmark is good at acting like a shopper:

1. Find the button
2. Fill the coupon
3. Complete checkout
4. Confirm that an order page appeared

But the value of the test suite comes from refusing to let the AI decide whether the money is correct. The model drives the browser. Decimal math judges the totals.

That split made the tests feel much more trustworthy.

The second lesson was that not all evidence belongs inside Passmark. PDF invoice parsing, report generation, direct API calls, and mutant orchestration are better handled with deterministic Playwright and Node helpers. Passmark is the human-facing flow layer. Playwright is the forensic layer.

The third lesson was cost control. Natural-language tests are not free, even with hackathon credits. I kept one dedicated AI checkout spec, then used deterministic helpers for repeated mutant scenarios. That kept the project reproducible without burning model calls on every small regression check.

## How To Run It

Clone the repo:

```bash
git clone https://github.com/ladiesmans217/Breaking-Apps.git
cd Breaking-Apps
```

Install dependencies:

```bash
npm install
npx playwright install chromium
```

Create `.env`:

```txt
OPENROUTER_API_KEY=sk-or-...
PASSMARK_AI=on
PASSMARK_LOG_LEVEL=info
```

Run the full suite:

```bash
npm test
```

Run only the honest truth check:

```bash
npm run truth:honest
```

Run only the mutant gauntlet:

```bash
npm run truth:mutants
```

Start the app:

```bash
npm run dev
```

Open:

```txt
http://127.0.0.1:3100
http://127.0.0.1:3100/truth
```

The generated evidence lives in:

```txt
reports/
article-assets/
playwright-report/
test-results/
```

## What I Would Add Next

The MVP proves the core idea, but the next version could go deeper:

1. Locale and currency parsing across `en-IN`, `en-US`, `de-DE`, and `fr-FR`
2. Inventory race tests with two shoppers buying the last item
3. A real Medusa or Saleor target after the controlled store
4. GitHub Actions with the honest suite on every push
5. Optional Redis caching for larger Passmark suites
6. Video evidence stitched into each Truth Report
7. A public hosted demo so the report can be inspected without cloning the repo

I would still keep the main idea the same:

> Passmark shops. Playwright records. Decimal math judges.

## Final Thought

This project changed how I think about AI regression testing.

The obvious use case is "let AI click around so I do not write selectors." That is useful, but it is not the most interesting part.

The more interesting pattern is:

> Let AI observe the product like a user, then compare what it saw against a deterministic invariant.

For ReceiptRipper, the invariant is money truth. A store must not say different totals in checkout, email, admin, API, and invoice.

That is why the build is called ReceiptRipper.

It lets AI shop until the checkout lies.

Then it rips the receipt open.

## Resources

- Project repo: https://github.com/ladiesmans217/Breaking-Apps
- Passmark website: https://passmark.dev/
- Passmark GitHub repo: https://github.com/bug0inc/passmark
- Breaking Apps Hackathon page: https://hashnode.com/hackathons/breaking-things
- Playwright docs: https://playwright.dev/docs/intro
- Next.js installation docs: https://nextjs.org/docs/app/getting-started/installation
