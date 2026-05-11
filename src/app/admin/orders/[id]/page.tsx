import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrder } from "@/lib/store/state";
import { formatINR } from "@/lib/truth/money";

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = getOrder(id);
  if (!order) {
    notFound();
  }
  const claim = order.claims.admin;

  return (
    <main className="page">
      <Link className="button ghost" href={`/orders/${order.id}`}>
        Back to order
      </Link>
      <section className="report-box">
        <h1>Admin order</h1>
        <p className="muted">{order.id}</p>
        <table aria-label="Admin order totals">
          <tbody>
            <tr>
              <th>Customer</th>
              <td>{order.customerEmail}</td>
            </tr>
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
    </main>
  );
}
