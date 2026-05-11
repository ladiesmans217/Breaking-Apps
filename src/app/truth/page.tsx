import Link from "next/link";
import { getLastReport } from "@/lib/store/state";
import { formatINR } from "@/lib/truth/money";

export default function TruthPage() {
  const report = getLastReport();

  if (!report) {
    return (
      <main className="page">
        <Link className="button ghost" href="/">
          Back to store
        </Link>
        <section className="report-box">
          <h1>Truth Report</h1>
          <p className="muted">No report has been generated in this server process yet.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <Link className="button ghost" href="/">
        Back to store
      </Link>
      <section className="report-box">
        <p className="muted">RECEIPTRIPPER TRUTH REPORT</p>
        <h1 className={`decision ${report.decision === "SHIP" ? "ship" : "stop"}`}>{report.decision}</h1>
        <p>
          Truth score: <strong>{report.truthScore}%</strong> · Order: <strong>{report.orderId}</strong> · Scenario:{" "}
          <strong>{report.scenario}</strong>
        </p>
      </section>

      <section className="report-box">
        <h2>Observed money claims</h2>
        <table aria-label="Truth report observed totals">
          <thead>
            <tr>
              <th>Source</th>
              <th>Subtotal</th>
              <th>Discount</th>
              <th>Tax</th>
              <th>Shipping</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {report.sources.map((source) => (
              <tr key={source.source}>
                <td>{source.label}</td>
                <td>{formatINR(source.observed.subtotal)}</td>
                <td>{formatINR(source.observed.discount)}</td>
                <td>{formatINR(source.observed.tax)}</td>
                <td>{formatINR(source.observed.shipping)}</td>
                <td>{formatINR(source.observed.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="report-box">
        <h2>Mismatches</h2>
        {report.mismatches.length === 0 ? <p>None</p> : null}
        {report.mismatches.map((mismatch) => (
          <div className="line" key={`${mismatch.source}-${mismatch.field}`}>
            <span>
              {mismatch.label} {mismatch.field}
            </span>
            <strong>
              expected {formatINR(mismatch.expected)}, observed {formatINR(mismatch.observed)}
            </strong>
          </div>
        ))}
      </section>
    </main>
  );
}
