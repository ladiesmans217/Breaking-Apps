import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Gauge, ShieldCheck } from "lucide-react";
import { getOrder } from "@/lib/store/state";
import { formatINR } from "@/lib/truth/money";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = getOrder(id);
  if (!order) {
    notFound();
  }
  const claim = order.claims.confirmation;

  return (
    <main className="page">
      <Link className="button ghost" href="/">
        Back to store
      </Link>
      <section className="report-box">
        <h1>Order confirmed</h1>
        <p className="muted">Order {order.id}</p>
        <div className="decision ship">{formatINR(claim.total)}</div>
        <table aria-label="Confirmation totals">
          <tbody>
            <tr>
              <th>Subtotal</th>
              <td>{formatINR(claim.subtotal)}</td>
            </tr>
            <tr>
              <th>Discount</th>
              <td>{formatINR(claim.discount)}</td>
            </tr>
            <tr>
              <th>Tax</th>
              <td>{formatINR(claim.tax)}</td>
            </tr>
            <tr>
              <th>Shipping</th>
              <td>{formatINR(claim.shipping)}</td>
            </tr>
            <tr>
              <th>Total</th>
              <td>{formatINR(claim.total)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="grid">
        <a className="button" href={`/api/invoices/${order.id}.pdf`}>
          <Download size={18} />
          Invoice
        </a>
        <Link className="button ghost" href={`/admin/orders/${order.id}`}>
          <ShieldCheck size={18} />
          Admin
        </Link>
        <Link className="button ghost" href="/truth">
          <Gauge size={18} />
          Truth
        </Link>
      </section>
    </main>
  );
}
