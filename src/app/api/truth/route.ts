import { NextResponse } from "next/server";
import { z } from "zod";
import { invoiceText } from "@/lib/invoice/pdf";
import { buildTruthReport } from "@/lib/reporter/truth-report";
import { getLastReport, getLastRun, getOrder, setLastRun } from "@/lib/store/state";
import type { TruthRun } from "@/lib/truth/types";

export const dynamic = "force-dynamic";

const reportSchema = z.object({
  orderId: z.string(),
  mode: z.enum(["honest", "mutant"]).default("honest"),
  scenario: z.string().default("manual"),
  evidence: z
    .object({
      screenshot: z.string().optional(),
      trace: z.string().optional(),
      video: z.string().optional(),
      invoiceText: z.string().optional(),
      reproCommand: z.string().optional(),
      localeChecks: z
        .array(
          z.object({
            locale: z.string(),
            formatted: z.string(),
            parsed: z.string(),
            expected: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
});

const runSchema = z.object({
  reports: z.array(z.any()).min(1),
});

export async function GET() {
  return NextResponse.json({ report: getLastReport() ?? null, run: getLastRun() ?? null });
}

export async function POST(request: Request) {
  const body = await request.json();
  const input = reportSchema.parse(body);
  const order = getOrder(input.orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  const report = buildTruthReport({
    orderId: input.orderId,
    mode: input.mode,
    scenario: input.scenario,
    evidence: {
      invoiceText: invoiceText(order),
      ...input.evidence,
    },
  });
  return NextResponse.json({ report });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const input = runSchema.parse(body);
  const reports = input.reports as TruthRun["reports"];
  const mismatches = reports.reduce((sum, report) => sum + report.mismatches.length, 0);
  const run: TruthRun = {
    runId: `truth_${Date.now()}`,
    checkedAt: new Date().toISOString(),
    reports,
    decision: mismatches === 0 ? "SHIP" : "DO NOT SHIP",
    truthScore: Math.round(reports.reduce((sum, report) => sum + report.truthScore, 0) / reports.length),
  };
  setLastRun(run);
  return NextResponse.json({ run });
}
