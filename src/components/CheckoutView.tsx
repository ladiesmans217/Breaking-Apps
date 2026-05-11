"use client";

import { CreditCard, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatINRForLocale } from "@/lib/truth/money";
import type { CheckoutDraft } from "@/lib/truth/types";

export function CheckoutView({ checkout }: { checkout: CheckoutDraft }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [placing, setPlacing] = useState(false);
  const claim = checkout.claims.checkout;

  async function placeOrder() {
    setPlacing(true);
    setError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutId: checkout.id }),
      });
      const data = (await response.json()) as { order?: { id: string }; error?: string };
      if (!response.ok || !data.order) {
        setError(data.error ?? "Unable to place order");
        return;
      }
      router.push(`/orders/${data.order.id}`);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <section className="report-box">
      <div className="split-heading">
        <div>
          <p className="muted">CHECKOUT {checkout.id}</p>
          <h1>Review checkout</h1>
        </div>
        <ShieldCheck aria-hidden="true" />
      </div>

      <table aria-label="Checkout line items">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {checkout.lines.map((line) => (
            <tr key={line.productId}>
              <td>{line.name}</td>
              <td>{line.quantity}</td>
              <td>{formatINRForLocale(line.unitPrice, checkout.locale)}</td>
              <td>{formatINRForLocale(line.lineTotal, checkout.locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table aria-label="Checkout totals">
        <tbody>
          <tr>
            <th>Subtotal</th>
            <td>{formatINRForLocale(claim.subtotal, checkout.locale)}</td>
          </tr>
          <tr>
            <th>Discount</th>
            <td>{formatINRForLocale(claim.discount, checkout.locale)}</td>
          </tr>
          <tr>
            <th>Tax</th>
            <td>{formatINRForLocale(claim.tax, checkout.locale)}</td>
          </tr>
          <tr>
            <th>Shipping</th>
            <td>{formatINRForLocale(claim.shipping, checkout.locale)}</td>
          </tr>
          <tr>
            <th>Total</th>
            <td>{formatINRForLocale(claim.total, checkout.locale)}</td>
          </tr>
        </tbody>
      </table>

      {error ? <p className="error" role="alert">{error}</p> : null}
      <button className="button secondary" disabled={placing} onClick={placeOrder}>
        <CreditCard size={18} />
        Place order
      </button>
    </section>
  );
}
