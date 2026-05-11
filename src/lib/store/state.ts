import { sendEmail, clearEmails } from "@/lib/email/inbox";
import { applyBugFlags } from "@/lib/truth/bugs";
import { formatINR } from "@/lib/truth/money";
import { buildOrderLines, computeTruth } from "@/lib/truth/oracle";
import type {
  BugFlags,
  CartLineInput,
  ClaimSource,
  MoneyBreakdown,
  Order,
  Product,
  TruthReport,
} from "@/lib/truth/types";

export const PRODUCTS: Product[] = [
  {
    id: "monsoon-hoodie",
    name: "Monsoon Hoodie",
    description: "Heavyweight cotton hoodie used in the main coupon truth flow.",
    sku: "RR-HOODIE-001",
    price: "1999.00",
    inventory: 12,
    badge: "Hero item",
  },
  {
    id: "ledger-mug",
    name: "Ledger Mug",
    description: "Ceramic mug that pushes the coupon cart to ₹2,399.00.",
    sku: "RR-MUG-002",
    price: "400.00",
    inventory: 20,
    badge: "Coupon pair",
  },
  {
    id: "precision-mat",
    name: "Precision Mat",
    description: "Awkward ₹999.99 value for tax rounding checks.",
    sku: "RR-MAT-003",
    price: "999.99",
    inventory: 10,
    badge: "Rounding",
  },
  {
    id: "copper-cable",
    name: "Copper Cable",
    description: "Awkward ₹149.95 value for tax rounding checks.",
    sku: "RR-CABLE-004",
    price: "149.95",
    inventory: 10,
    badge: "Rounding",
  },
  {
    id: "one-paisa-washer",
    name: "One Paisa Washer",
    description: "Tiny ₹0.01 item that exposes rounding drift.",
    sku: "RR-WASHER-005",
    price: "0.01",
    inventory: 999,
    badge: "Rounding",
  },
  {
    id: "threshold-pack",
    name: "Threshold Pack",
    description: "Exactly under free shipping at ₹1,999.99.",
    sku: "RR-THRESH-006",
    price: "1999.99",
    inventory: 6,
    badge: "Threshold",
  },
  {
    id: "free-ship-pack",
    name: "Free Ship Pack",
    description: "Exactly over free shipping at ₹2,000.01.",
    sku: "RR-FREESHIP-007",
    price: "2000.01",
    inventory: 6,
    badge: "Threshold",
  },
];

type StoreState = {
  products: Product[];
  orders: Record<string, Order>;
  flags: BugFlags;
  lastReport?: TruthReport;
  sequence: number;
};

declare global {
  var __RECEIPTRIPPER_STORE_STATE__: StoreState | undefined;
}

function initialState(): StoreState {
  return {
    products: PRODUCTS,
    orders: {},
    flags: {},
    sequence: 0,
  };
}

export function getStore(): StoreState {
  globalThis.__RECEIPTRIPPER_STORE_STATE__ ??= initialState();
  return globalThis.__RECEIPTRIPPER_STORE_STATE__;
}

export function resetStore(flags: BugFlags = {}): StoreState {
  globalThis.__RECEIPTRIPPER_STORE_STATE__ = {
    ...initialState(),
    flags,
  };
  clearEmails();
  return getStore();
}

export function setLastReport(report: TruthReport): void {
  getStore().lastReport = report;
}

export function getLastReport(): TruthReport | undefined {
  return getStore().lastReport;
}

export function getProducts(): Product[] {
  return getStore().products;
}

export function getOrder(id: string): Order | undefined {
  return getStore().orders[id];
}

export function listOrders(): Order[] {
  return Object.values(getStore().orders);
}

function buildClaims(expected: MoneyBreakdown, flags: BugFlags, couponCode?: string): Record<ClaimSource, MoneyBreakdown> {
  const sources: ClaimSource[] = [
    "product",
    "cart",
    "checkout",
    "confirmation",
    "email",
    "admin",
    "api",
    "invoice",
  ];

  return sources.reduce(
    (claims, source) => {
      claims[source] = applyBugFlags(source, expected, flags, couponCode);
      return claims;
    },
    {} as Record<ClaimSource, MoneyBreakdown>,
  );
}

function receiptText(order: Order): string {
  const claim = order.claims.email;
  return [
    "ReceiptRipper Store Receipt",
    `Order: ${order.id}`,
    `Email: ${order.customerEmail}`,
    `Subtotal: ${formatINR(claim.subtotal)}`,
    `Discount: ${formatINR(claim.discount)}`,
    `Tax: ${formatINR(claim.tax)}`,
    `Shipping: ${formatINR(claim.shipping)}`,
    `Total: ${formatINR(claim.total)}`,
  ].join("\n");
}

export function createOrder(input: {
  cart: CartLineInput[];
  customerEmail: string;
  customerName: string;
  couponCode?: string;
}): Order {
  const store = getStore();
  const lines = buildOrderLines(store.products, input.cart);
  const expected = computeTruth(lines, input.couponCode);
  const id = `rr_${new Date().toISOString().slice(0, 10).replaceAll("-", "")}_${String(++store.sequence).padStart(3, "0")}`;
  const order: Order = {
    id,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    couponCode: input.couponCode?.trim().toUpperCase() || undefined,
    lines,
    expected,
    claims: buildClaims(expected, store.flags, input.couponCode),
    bugFlags: { ...store.flags },
    createdAt: new Date().toISOString(),
  };

  store.orders[id] = order;
  const text = receiptText(order);
  sendEmail({
    to: order.customerEmail,
    subject: `ReceiptRipper receipt for ${order.id}`,
    text,
    html: `<pre>${text}</pre>`,
  });

  return order;
}
