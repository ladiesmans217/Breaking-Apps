import { NextResponse } from "next/server";
import { invoicePdf } from "@/lib/invoice/pdf";
import { getOrder } from "@/lib/store/state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const orderId = file.replace(/\.pdf$/i, "");
  const order = getOrder(orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const pdf = await invoicePdf(order);
  const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${order.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
