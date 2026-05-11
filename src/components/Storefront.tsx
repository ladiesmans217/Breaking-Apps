"use client";

import { Minus, Plus, ReceiptText, ShoppingCart } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/truth/money";
import type { Product } from "@/lib/truth/types";

type Cart = Record<string, number>;

function cartCount(cart: Cart): number {
  return Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
}

function cartSubtotal(products: Product[], cart: Cart): string {
  const total = products.reduce((sum, product) => sum + Number(product.price) * (cart[product.id] ?? 0), 0);
  return total.toFixed(2);
}

export function Storefront({ products }: { products: Product[] }) {
  const router = useRouter();
  const [cart, setCart] = useState<Cart>({});
  const [couponCode, setCouponCode] = useState("SAVE20");
  const [customerEmail, setCustomerEmail] = useState("shopper@receiptripper.test");
  const [customerName, setCustomerName] = useState("Ada Lovelace");
  const [submitting, setSubmitting] = useState(false);
  const count = cartCount(cart);
  const subtotal = useMemo(() => cartSubtotal(products, cart), [products, cart]);
  const lines = products.filter((product) => cart[product.id]);

  function add(productId: string) {
    setCart((current) => ({ ...current, [productId]: (current[productId] ?? 0) + 1 }));
  }

  function remove(productId: string) {
    setCart((current) => {
      const next = { ...current, [productId]: Math.max((current[productId] ?? 0) - 1, 0) };
      if (next[productId] === 0) {
        delete next[productId];
      }
      return next;
    });
  }

  async function checkout() {
    setSubmitting(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail,
          customerName,
          couponCode,
          cart: Object.entries(cart).map(([productId, quantity]) => ({ productId, quantity })),
        }),
      });
      const data = (await response.json()) as { order: { id: string } };
      router.push(`/orders/${data.order.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>ReceiptRipper Store</strong>
          <span>AI shops. Math judges.</span>
        </div>
        <a className="button ghost" href="/truth" aria-label="Open Truth Report">
          <ReceiptText size={18} />
          Truth Report
        </a>
      </header>

      <div className="layout">
        <section className="grid" aria-label="Product grid">
          {products.map((product) => (
            <article className="product" key={product.id}>
              {product.badge ? <span className="badge">{product.badge}</span> : null}
              <h2>{product.name}</h2>
              <p className="muted">{product.description}</p>
              <div className="price">{formatINR(product.price)}</div>
              <button className="button" onClick={() => add(product.id)} aria-label={`Add ${product.name} to cart`}>
                <ShoppingCart size={18} />
                Add
              </button>
            </article>
          ))}
        </section>

        <aside className="summary" aria-label="Cart and checkout">
          <h2>Cart</h2>
          {lines.length === 0 ? <p className="muted">No items selected.</p> : null}
          {lines.map((product) => (
            <div className="line" key={product.id}>
              <div>
                <strong>{product.name}</strong>
                <div className="muted">{formatINR(product.price)}</div>
              </div>
              <div className="qty">
                <button className="icon-button" onClick={() => remove(product.id)} aria-label={`Remove ${product.name}`}>
                  <Minus size={16} />
                </button>
                <span aria-label={`${product.name} quantity`}>{cart[product.id]}</span>
                <button className="icon-button" onClick={() => add(product.id)} aria-label={`Add another ${product.name}`}>
                  <Plus size={16} />
                </button>
              </div>
            </div>
          ))}

          <div className="field">
            <label htmlFor="coupon">Coupon</label>
            <input id="coupon" value={couponCode} onChange={(event) => setCouponCode(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="customerName">Name</label>
            <input id="customerName" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="customerEmail">Email</label>
            <input
              id="customerEmail"
              type="email"
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
            />
          </div>

          <div className="totals">
            <div className="total-row">
              <span>Visible product subtotal</span>
              <strong>{formatINR(subtotal)}</strong>
            </div>
            <div className="total-row final">
              <span>Items</span>
              <span>{count}</span>
            </div>
          </div>

          <button className="button secondary" disabled={count === 0 || submitting} onClick={checkout}>
            Checkout
          </button>
        </aside>
      </div>
    </main>
  );
}
