import { NextResponse } from "next/server";
import { z } from "zod";
import { invoiceText } from "@/lib/invoice/pdf";
import { buildTruthReport } from "@/lib/reporter/truth-report";
import { getLastReport, getOrder } from "@/lib/store/state";

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
    })
    .optional(),
});

export async function GET() {
  return NextResponse.json({ report: getLastReport() ?? null });
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
