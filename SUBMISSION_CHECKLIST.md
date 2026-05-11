# ReceiptRipper Submission Checklist

Deadline note: the published hackathon deadline is May 10, 2026 at 11:59 PM PT, which is May 11, 2026 at 12:29 PM IST. Publish before 12:29 PM IST on May 11, 2026.

## Before Publishing

- Do not paste or commit the OpenRouter API key. `.env` is already ignored.
- Star and fork `bug0inc/passmark`.
- GitHub repo: https://github.com/ladiesmans217/Breaking-Apps
- Replace `your-hashnode-domain.hashnode.dev` in `ARTICLE_DRAFT.md` if publishing from GitHub.
- Upload `article-assets/truth-dashboard.png` to Hashnode CDN and use that URL as the cover.
- Upload or paste these screenshots into the article:
  - `article-assets/storefront.png`
  - `article-assets/truth-dashboard.png`
  - `article-assets/mutant-invoice-admin-report.png`
- Add the Hashnode tag `#BreakingAppsHackathon`.
- Keep tags to 5 if using GitHub frontmatter:
  - `breakingappshackathon`
  - `passmark`
  - `playwright`
  - `testing`
  - `nextjs`

## Commands Already Verified Locally

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:passmark
npm run truth:honest
npm run truth:mutants
npm test
npm run build
```

## Recommended Final Smoke Commands

Run these once right before pushing:

```bash
npm test
npm run build
```

## X Draft

Built ReceiptRipper for #BreakingAppsHackathon.

Passmark shops through checkout like a human. Decimal math judges whether cart, checkout, email, admin, API, and invoice tell the same money truth.

The honest store ships. The seeded mutants get a red DO NOT SHIP report.

AI shops. Math judges. @Bug0

Repo: https://github.com/ladiesmans217/Breaking-Apps
Article: TODO

## LinkedIn Draft

I built ReceiptRipper for the Breaking Apps Hackathon by Hashnode and Bug0.

Most E2E tests ask whether a checkout flow works. I wanted to ask whether checkout tells the same truth everywhere.

ReceiptRipper is a controlled local commerce app plus a Passmark regression gauntlet:

- Passmark shops like a user in plain English
- Playwright records the evidence
- Decimal math computes the expected money truth
- The report compares product page, cart, checkout, confirmation, email receipt, admin order, API, and invoice PDF

The best part is the mutant mode. I seeded realistic commerce bugs like coupon drift, tax rounding drift, bad email totals, invoice cent-off errors, false free-shipping thresholds, and admin totals ignoring shipping. The test suite passes only when those lies are caught and the report says DO NOT SHIP.

The thesis:

AI is the shopper. Math is the judge.

Repo: https://github.com/ladiesmans217/Breaking-Apps
Article: TODO

#BreakingAppsHackathon #Passmark #Playwright #Testing #NextJS
