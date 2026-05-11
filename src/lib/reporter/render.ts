import { formatINR } from "@/lib/truth/money";
import type { TruthReport } from "@/lib/truth/types";

export function renderTruthReportHtml(report: TruthReport): string {
  const rows = report.sources
    .map(
      (source) => `
        <tr>
          <td>${source.label}</td>
          <td>${formatINR(source.observed.subtotal)}</td>
          <td>${formatINR(source.observed.discount)}</td>
          <td>${formatINR(source.observed.tax)}</td>
          <td>${formatINR(source.observed.shipping)}</td>
          <td>${formatINR(source.observed.total)}</td>
        </tr>`,
    )
    .join("");

  const mismatches = report.mismatches
    .map(
      (mismatch) =>
        `<li>${mismatch.label} ${mismatch.field}: expected ${formatINR(mismatch.expected)}, observed ${formatINR(mismatch.observed)}</li>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ReceiptRipper Truth Report</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; margin: 40px; color: #121212; }
    .decision { font-size: 44px; font-weight: 800; margin: 0; }
    .bad { color: #b91c1c; }
    .good { color: #047857; }
    table { border-collapse: collapse; width: 100%; margin-top: 24px; }
    th, td { border-bottom: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background: #f3f4f6; }
  </style>
</head>
<body>
  <p>RECEIPTRIPPER TRUTH REPORT</p>
  <h1 class="decision ${report.decision === "SHIP" ? "good" : "bad"}">${report.decision}</h1>
  <p>Truth score: ${report.truthScore}% · Order: ${report.orderId} · Scenario: ${report.scenario}</p>
  <table>
    <thead><tr><th>Source</th><th>Subtotal</th><th>Discount</th><th>Tax</th><th>Shipping</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <h2>Mismatches</h2>
  <ul>${mismatches || "<li>None</li>"}</ul>
</body>
</html>`;
}
