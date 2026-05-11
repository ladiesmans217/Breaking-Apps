import { d, money } from "./money";
import type { CartLineInput, MoneyBreakdown, OrderLine, Product } from "./types";

export const TAX_RATE = d("0.18");
export const SAVE20_RATE = d("0.20");
export const SHIPPING_FEE = d("99.00");
export const FREE_SHIPPING_THRESHOLD = d("2000.00");

export function buildOrderLines(products: Product[], cart: CartLineInput[]): OrderLine[] {
  return cart.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product) {
      throw new Error(`Unknown product: ${item.productId}`);
    }

    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      unitPrice: money(product.price),
      quantity: item.quantity,
      lineTotal: money(d(product.price).times(item.quantity)),
    };
  });
}

export function computeTruth(lines: OrderLine[], couponCode?: string): MoneyBreakdown {
  const subtotal = lines.reduce((sum, line) => sum.plus(line.lineTotal), d(0));
  const normalizedCoupon = couponCode?.trim().toUpperCase();
  const discount = normalizedCoupon === "SAVE20" ? subtotal.times(SAVE20_RATE) : d(0);
  const discountedSubtotal = subtotal.minus(discount);
  const tax = discountedSubtotal.times(TAX_RATE);
  const shipping = subtotal.greaterThanOrEqualTo(FREE_SHIPPING_THRESHOLD) ? d(0) : SHIPPING_FEE;
  const total = discountedSubtotal.plus(tax).plus(shipping);

  return {
    subtotal: money(subtotal),
    discount: money(discount),
    tax: money(tax),
    shipping: money(shipping),
    total: money(total),
  };
}

export function totalWith(overrides: Partial<MoneyBreakdown>, base: MoneyBreakdown): MoneyBreakdown {
  const next = { ...base, ...overrides };
  const total = d(next.subtotal).minus(next.discount).plus(next.tax).plus(next.shipping);
  return { ...next, total: money(total) };
}
