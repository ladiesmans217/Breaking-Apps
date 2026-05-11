import PDFDocument from "pdfkit";
import { formatINR } from "@/lib/truth/money";
import type { Order } from "@/lib/truth/types";

export function invoiceText(order: Order): string {
  const claim = order.claims.invoice;
  return [
    "ReceiptRipper Invoice",
    `Order: ${order.id}`,
    `Customer: ${order.customerName}`,
    `Email: ${order.customerEmail}`,
    `Subtotal: ${formatINR(claim.subtotal)}`,
    `Discount: ${formatINR(claim.discount)}`,
    `Tax: ${formatINR(claim.tax)}`,
    `Shipping: ${formatINR(claim.shipping)}`,
    `Total: ${formatINR(claim.total)}`,
  ].join("\n");
}

export async function invoicePdf(order: Order): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 56, size: "A4" });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(22).text("ReceiptRipper Invoice");
  doc.moveDown();
  doc.fontSize(11).text(`Order: ${order.id}`);
  doc.text(`Customer: ${order.customerName}`);
  doc.text(`Email: ${order.customerEmail}`);
  doc.moveDown();

  for (const line of order.lines) {
    doc.text(`${line.quantity} x ${line.name} (${line.sku})`);
    doc.text(`Unit: ${formatINR(line.unitPrice)}  Line: ${formatINR(line.lineTotal)}`);
    doc.moveDown(0.5);
  }

  doc.moveDown();
  doc.fontSize(13).text(invoiceText(order));
  doc.end();

  return done;
}
