import { getOrder, setLastReport } from "@/lib/store/state";
import { sameMoney } from "@/lib/truth/money";
import type { ClaimSource, MoneyBreakdown, SourceClaim, TruthMismatch, TruthReport } from "@/lib/truth/types";

const SOURCE_LABELS: Record<ClaimSource, string> = {
  product: "Product page",
  cart: "Cart",
  checkout: "Checkout",
  confirmation: "Confirmation page",
  email: "Email receipt",
  admin: "Admin order",
  api: "Order API",
  invoice: "Invoice PDF",
};

const SOURCE_FIELDS: Record<ClaimSource, (keyof MoneyBreakdown)[]> = {
  product: ["subtotal"],
  cart: ["subtotal", "discount", "tax", "shipping", "total"],
  checkout: ["subtotal", "discount", "tax", "shipping", "total"],
  confirmation: ["total"],
  email: ["subtotal", "discount", "tax", "shipping", "total"],
  admin: ["subtotal", "discount", "tax", "shipping", "total"],
  api: ["subtotal", "discount", "tax", "shipping", "total"],
  invoice: ["subtotal", "discount", "tax", "shipping", "total"],
};

export function buildTruthReport(input: {
  orderId: string;
  mode: "honest" | "mutant";
  scenario: string;
  evidence?: TruthReport["evidence"];
}): TruthReport {
  const order = getOrder(input.orderId);
  if (!order) {
    throw new Error(`Unknown order: ${input.orderId}`);
  }

  const sources = Object.entries(order.claims).map(([source, observed]) => {
    const typedSource = source as ClaimSource;
    return {
      source: typedSource,
      label: SOURCE_LABELS[typedSource],
      observed,
      fields: SOURCE_FIELDS[typedSource],
    } satisfies SourceClaim;
  });

  const mismatches: TruthMismatch[] = [];
  let checkedFields = 0;
  let passingFields = 0;

  for (const source of sources) {
    for (const field of source.fields) {
      checkedFields++;
      const expected = order.expected[field];
      const observed = source.observed[field];
      if (sameMoney(expected, observed)) {
        passingFields++;
      } else {
        mismatches.push({
          source: source.source,
          label: source.label,
          field,
          expected,
          observed,
        });
      }
    }
  }

  const truthScore = Math.round((passingFields / checkedFields) * 100);
  const report: TruthReport = {
    runId: `tr_${Date.now()}`,
    orderId: order.id,
    mode: input.mode,
    scenario: input.scenario,
    decision: mismatches.length === 0 ? "SHIP" : "DO NOT SHIP",
    truthScore,
    checkedAt: new Date().toISOString(),
    expected: order.expected,
    bugFlags: order.bugFlags,
    sources,
    mismatches,
    evidence: input.evidence ?? {},
  };

  setLastReport(report);
  return report;
}
