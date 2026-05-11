A checkout flow can pass and still lie.

The button can work. The order page can load. The invoice can download. The email can arrive. Every normal end-to-end assertion can look green.

And still, somewhere in the system, the customer paid ₹1,455.94 while the admin screen says ₹1,356.94 and the invoice says ₹1,455.95.

That is the bug class I wanted to catch for **#breakingappshackathon**.

So I built **ReceiptRipper**: a controlled commerce app plus a Passmark regression gauntlet for checkout truth.

The thesis:

> **AI is the shopper. Math is the judge.**

Passmark drives the app like a user. Playwright records the evidence. Redis caches Passmark steps. A Decimal.js oracle computes the expected money truth. ReceiptRipper then compares every place the store makes a money claim:

```txt
product page
cart
checkout
confirmation page
email receipt
admin order
order API
invoice PDF
localized UI text
inventory state
```

If they agree, the report says:

```txt
SHIP
```

If they disagree, the report says:

```txt
DO NOT SHIP
```

![ReceiptRipper aggregate truth report](https://raw.githubusercontent.com/ladiesmans217/Breaking-Apps/main/article-assets/full-aggregate-report.png)

## The Short Version

ReceiptRipper is not a generic AI QA dashboard.

It is a domain-specific truth test:

> A store must not tell different money stories in different places.

The final local run passed:

```txt
Vitest unit tests: 12 passed
Real Passmark checkout test: 1 passed
Honest truth run: 1 passed
Mutant truth run: 7 passed
Full original truth run: 5 passed
Redis-backed test:full run: passed
```

The full gauntlet covers:

1. Product page to cart truth
2. Coupon truth
3. Tax rounding truth
4. Free-shipping threshold truth at ₹1,999.99, ₹2,000.00, and ₹2,000.01
5. Locale and currency parsing across `en-IN`, `en-US`, `en-GB`, `de-DE`, and `fr-FR`
6. Inventory race protection for a last-stock item
7. Email receipt truth using a local Passmark email provider
8. Invoice, admin, and API truth using PDF text extraction and direct API reads

That is the entire project in one sentence:

> Passmark shops. Playwright records. Redis caches. Decimal math judges. ReceiptRipper refuses to ship lies.

## Why I Built A Controlled Store

For this hackathon, the obvious path was to point Passmark at an existing public app and write plain-English tests.

That is useful, but I wanted a stronger demo.

Most web testing articles stop at:

```txt
The page rendered.
The button worked.
The user reached checkout.
```

ReceiptRipper asks a nastier question:

```txt
Did checkout tell the same truth everywhere?
```

That meant I needed a target where every surface was visible, deterministic, and reproducible. So I built a controlled local commerce app with:

1. Product grid
2. Cart
3. Checkout review page
4. Confirmation page
5. Email receipt
6. Admin order page
7. Order API
8. Invoice PDF
9. Truth report dashboard

No real payment provider. No real SMTP. No Medusa. No Saleor. No fake production story.

Just a small store designed to expose the places where commerce systems drift.

![ReceiptRipper storefront](https://raw.githubusercontent.com/ladiesmans217/Breaking-Apps/main/article-assets/storefront.png)

## The Bug That Makes The Demo Click

Here is a real seeded mutant from the suite:

```txt
Expected total:        ₹1,455.94
Admin order total:     ₹1,356.94
Invoice PDF total:     ₹1,455.95
Order API total:       ₹1,455.94
```

The API is right. The customer-facing confirmation is right. But admin ignored shipping and the invoice drifted by one paisa.

A shallow test would probably pass because checkout completed.

ReceiptRipper fails the run because the store told three different money stories.

![ReceiptRipper mutant invoice and admin report](https://raw.githubusercontent.com/ladiesmans217/Breaking-Apps/main/article-assets/mutant-invoice-admin-report.png)

That is why this project is not about “AI clicked buttons.”

It is about using AI to reach the same surfaces a user would reach, then using deterministic code to decide whether those surfaces are telling the truth.

## The Architecture

The architecture has four layers:

| Layer | Responsibility |
| --- | --- |
| Passmark | Acts like the shopper through natural-language browser steps |
| Playwright | Runs the browser, captures screenshots/videos/traces, downloads invoices, calls APIs |
| Decimal oracle | Computes the expected subtotal, discount, tax, shipping, and total |
| Truth Report | Turns mismatches into JSON/HTML evidence and a `SHIP` or `DO NOT SHIP` decision |

The important design choice is that AI never becomes the judge of correctness.

Passmark is excellent at this:

```txt
Click the Add button for Monsoon Hoodie
Click the Add button for Ledger Mug
Fill the Coupon input with SAVE20
Fill the Email input
Click Checkout
Click Place order
Verify the confirmation page shows an order total
```

But after checkout exists, the model steps aside.

The oracle takes over.

## The Money Oracle

The store uses simple INR rules:

```txt
Coupon: SAVE20 gives 20% off
Tax: 18%
Shipping: ₹99.00
Free shipping threshold: ₹2,000.00
Rounding: Decimal.js, 2 decimal places
```

The expected total is computed as:

```txt
subtotal = sum(line totals)
discount = subtotal * 0.20 when coupon is SAVE20
discountedSubtotal = subtotal - discount
tax = discountedSubtotal * 0.18
shipping = 0 when subtotal >= 2000.00, otherwise 99.00
total = discountedSubtotal + tax + shipping
```

This is deliberately boring.

Money tests should be boring. Boring math is what makes the result trustworthy.

## The Real Checkout Flow

The first version of ReceiptRipper went straight from cart to confirmation. The full version has a proper checkout draft:

```txt
POST /api/checkouts
/checkout/[id]
Place order
/orders/[id]
```

That matters because checkout is its own truth surface. It can show one total while confirmation, email, invoice, API, and admin show another.

The app now exposes:

```txt
Product page claim
Cart claim
Checkout claim
Confirmation claim
Email claim
Admin claim
API claim
Invoice claim
```

ReceiptRipper compares each claim against the oracle.

## The Seeded Bugs

I added bug flags so every failure is reproducible.

```txt
BUG_COUPON_LIES
BUG_TAX_ROUNDING_DRIFT
BUG_EMAIL_TOTAL_WRONG
BUG_INVOICE_CENT_OFF
BUG_FREE_SHIPPING_THRESHOLD_WRONG
BUG_ADMIN_IGNORES_SHIPPING
BUG_INVENTORY_DOUBLE_SELLS
BUG_LOCALE_DECIMAL_DRIFT
```

Each bug represents a real class of production problem:

| Bug flag | What it simulates |
| --- | --- |
| `BUG_COUPON_LIES` | Checkout/confirmation mishandle the discount |
| `BUG_TAX_ROUNDING_DRIFT` | Tax differs by ₹0.01 |
| `BUG_EMAIL_TOTAL_WRONG` | Receipt email disagrees with checkout |
| `BUG_INVOICE_CENT_OFF` | PDF invoice total is off by one paisa |
| `BUG_FREE_SHIPPING_THRESHOLD_WRONG` | UI claims free shipping below the real threshold |
| `BUG_ADMIN_IGNORES_SHIPPING` | Admin order drops shipping from the total |
| `BUG_INVENTORY_DOUBLE_SELLS` | Two buyers can buy the only remaining item |
| `BUG_LOCALE_DECIMAL_DRIFT` | Locale parsing turns formatted money into the wrong number |

The mutant suite is green only when the bug is caught.

That is the core trick:

> A mutant test passes when ReceiptRipper catches the lie.

## Passmark And Redis

The hackathon gives OpenRouter credits, so I configured Passmark through OpenRouter:

```ts
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
  redis: process.env.REDIS_URL ? { url: process.env.REDIS_URL } : undefined,
  email: localInboxProvider(baseURL),
});
```

Redis is important because Passmark is designed around the idea that AI discovers the flow once, then cached Playwright actions make repeat runs cheaper and faster.

I used Docker only for Redis:

```yaml
services:
  redis:
    image: redis:8.6.3-alpine
    ports:
      - "6379:6379"
    command: ["redis-server", "--save", "", "--appendonly", "no"]
```

The Redis-backed full run passed with:

```powershell
docker compose up -d redis
REDIS_URL=redis://localhost:6379 npm run test:full
docker compose down
```

## Email Without SMTP

Receipt bugs often hide in email.

Checkout can show the right total while the customer email uses stale data, misses a discount, or rounds differently.

I did not want real SMTP in the critical path, so ReceiptRipper has an in-memory local inbox. When an order is created, the app writes the email receipt into local process state. A custom Passmark email provider reads from `/api/emails`.

That lets the suite use Passmark-style email extraction:

```ts
data: {
  receiptTotal: "{{email.total:extract the Total amount:mutant-email@receiptripper.test}}"
}
```

No external mailbox. No flaky email delivery. Still a real email truth surface.

## Locale Truth

Locale bugs are sneaky because the page still looks right to a human.

ReceiptRipper formats and parses INR across:

```txt
en-IN
en-US
en-GB
de-DE
fr-FR
```

The `de-DE` case is especially useful because thousands and decimal separators differ from English-style formatting.

The locale mutant intentionally parses a localized string incorrectly. The test catches the drift before it becomes a money bug.

## Inventory Truth

Inventory is another truth surface.

I added a `Last Stock Poster` product with inventory `1`.

The honest race test sends two buyers at the same time:

```txt
Buyer A tries to buy the last item.
Buyer B tries to buy the last item.
```

The expected result:

```txt
One order succeeds with 201.
One order fails with 409.
```

The mutant mode enables double-selling. In that mode both orders succeed, and the test proves ReceiptRipper can expose the inventory lie.

## The Truth Report

Every scenario writes a JSON and HTML report:

```txt
reports/<scenario>.json
reports/<scenario>.html
```

The full run also writes:

```txt
reports/index.html
reports/index.json
```

The report includes:

1. Scenario name
2. Bug flags
3. Expected money breakdown
4. Observed claims by source
5. Mismatches
6. Truth score
7. `SHIP` or `DO NOT SHIP`
8. Evidence paths
9. Invoice text
10. Repro command

The aggregate report is intentionally simple:

```txt
full-product-cart       SHIP   100%
full-threshold-under    SHIP   100%
full-threshold-exact    SHIP   100%
full-threshold-over     SHIP   100%
full-locale             SHIP   100%
full-inventory-race     SHIP   100%
```

That gives judges a quick “yes, this ran” moment before they dive into code.

## Final Verification

I ran:

```bash
npm run lint
npm run typecheck
npm run build
```

All passed.

Then I ran the full Redis-backed suite:

```powershell
docker compose up -d redis
REDIS_URL=redis://localhost:6379 npm run test:full
docker compose down
```

Final result:

```txt
Unit tests: 12 passed
Real Passmark checkout: 1 passed
Honest truth run: 1 passed
Mutant truth run: 7 passed
Full original truth run: 5 passed
```

The first Redis-backed run hit a transient DNS failure to `openrouter.ai`, so I reran it. The rerun passed.

That matters because the failure was not a product bug. The product and Redis setup were fine. The retry proved the actual suite.

## What I Learned

The obvious use case for AI regression testing is:

> Let AI click the app so I do not write selectors.

That is useful, but ReceiptRipper made me care about a different pattern:

> Let AI reach the user-visible truth, then compare that truth against a deterministic invariant.

For this project, the invariant is money.

I do not want an AI deciding whether ₹1,455.94 is correct.

I want the AI to behave like the shopper, reach checkout, open the email, download the invoice, and expose the claims. Then I want deterministic code to judge those claims.

That split feels much more reliable:

```txt
AI for navigation.
Playwright for evidence.
Redis for replay.
Decimal math for truth.
```

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
REDIS_URL=redis://localhost:6379
```

Run the normal suite:

```bash
npm test
```

Run the full original gauntlet:

```bash
npm run truth:full
```

Run with Redis:

```bash
docker compose up -d redis
npm run test:full
docker compose down
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

## What I Would Add Next

ReceiptRipper is now complete as a controlled-store truth lab. The next version should test a real commerce engine:

1. Medusa or Saleor checkout as the target
2. Refund and return truth
3. Order edit truth
4. Payment provider webhook truth
5. GitHub Actions with Redis
6. Hosted demo with public report artifacts
7. Video evidence embedded directly inside reports

But I would keep the core architecture unchanged.

The AI should not be the judge.

The AI should be the shopper.

## Final Thought

Passmark made it easy to express a real user flow in plain English.

ReceiptRipper adds the part I think every serious AI regression suite needs:

```txt
A deterministic truth oracle.
```

Because the scariest bugs are not always the ones that crash.

Sometimes the page loads.

Sometimes checkout completes.

Sometimes the receipt arrives.

And sometimes the store quietly tells three different versions of the truth.

ReceiptRipper catches that.

Built for **#breakingappshackathon**.

## Resources

- Project repo: https://github.com/ladiesmans217/Breaking-Apps
- Passmark: https://passmark.dev/
- Passmark GitHub: https://github.com/bug0inc/passmark
- Breaking Apps Hackathon: https://hashnode.com/hackathons/breaking-things
- Playwright docs: https://playwright.dev/docs/intro
- Next.js docs: https://nextjs.org/docs/app/getting-started/installation
