# ReceiptRipper

**AI shops. Math judges.**

ReceiptRipper is a controlled commerce target plus a Passmark regression gauntlet for checkout truth. It does not ask whether a checkout button exists. It asks whether product pages, cart, checkout, confirmation, email, admin, API, and invoice all tell the same money truth.

## What It Tests

- Coupon truth across customer-visible and backend surfaces.
- Tax rounding with awkward values like `₹999.99`, `₹149.95`, and `₹0.01`.
- Free-shipping threshold behavior at `₹1,999.99`, `₹2,000.00`, and above.
- Email receipt totals through a local Passmark email provider.
- Invoice PDF, admin order, and API consistency.

Seeded bug flags:

```txt
BUG_COUPON_LIES
BUG_TAX_ROUNDING_DRIFT
BUG_EMAIL_TOTAL_WRONG
BUG_INVOICE_CENT_OFF
BUG_FREE_SHIPPING_THRESHOLD_WRONG
BUG_ADMIN_IGNORES_SHIPPING
```

## Stack

- Next.js 16.2.6, React 19.2.6
- Passmark 1.0.13 + Playwright 1.59.1
- OpenRouter gateway for AI-backed Passmark runs
- Decimal.js for deterministic money math
- PDFKit + pdf-parse for invoice evidence
- Vitest for oracle/report unit tests

## Run

```bash
npm install
npx playwright install chromium
cp .env.example .env
# Add OPENROUTER_API_KEY for AI-driven Passmark steps.

npm run dev
```

By default, the core truth harness uses deterministic Playwright actions so the local evidence loop is reproducible and does not burn credits. `npm run test:passmark` runs the real Passmark/OpenRouter checkout flow. To force every truth test to use Passmark shopping, set `PASSMARK_SHOP_ALL=on`.

## Verification

```bash
npm run test:unit
npm run test:passmark
npm run truth:honest
npm run truth:mutants
```

Reports are written to `reports/*.json` and `reports/*.html`. The latest in-process report is visible at `/truth`.

## Core Line

Passmark observes the user-facing truth. Deterministic code computes the actual truth. ReceiptRipper fails when they disagree.
