import { clearEmails, sendEmail } from "@/lib/email/inbox";
import { applyBugFlags } from "@/lib/truth/bugs";
import { formatINR } from "@/lib/truth/money";
import { buildOrderLines, computeTruth } from "@/lib/truth/oracle";
import type {
  BugFlags,
  CartLineInput,
  CheckoutDraft,
  ClaimSource,
  MoneyBreakdown,
  Order,
  Product,
  TruthReport,
  TruthRun,
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
    id: "threshold-edge-pack",
    name: "Threshold Edge Pack",
    description: "Exactly at the free shipping threshold: ₹2,000.00.",
    sku: "RR-EDGE-007",
    price: "2000.00",
    inventory: 6,
    badge: "Threshold",
  },
  {
    id: "free-ship-pack",
    name: "Free Ship Pack",
    description: "Exactly over free shipping at ₹2,000.01.",
    sku: "RR-FREESHIP-008",
    price: "2000.01",
    inventory: 6,
    badge: "Threshold",
  },
  {
    id: "last-stock-poster",
    name: "Last Stock Poster",
    description: "Only one exists, used for the inventory race test.",
    sku: "RR-LAST-009",
    price: "999.00",
    inventory: 1,
    badge: "Race",
  },
  {
    id: "locale-ledger",
    name: "Locale Ledger",
    description: "₹1,234.56 item used to catch locale decimal parsing mistakes.",
    sku: "RR-LOCALE-010",
    price: "1234.56",
    inventory: 8,
    badge: "Locale",
  },
];

type StoreState = {
  products: Product[];
  checkouts: Record<string, CheckoutDraft>;
  orders: Record<string, Order>;
  flags: BugFlags;
  lastReport?: TruthReport;
  lastRun?: TruthRun;
  sequence: number;
  checkoutSequence: number;
};

declare global {
  var __RECEIPTRIPPER_STORE_STATE__: StoreState | undefined;
}

function initialState(): StoreState {
  return {
    products: PRODUCTS.map((product) => ({ ...product })),
    checkouts: {},
    orders: {},
    flags: {},
    sequence: 0,
    checkoutSequence: 0,
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

export function setLastRun(run: TruthRun): void {
  const store = getStore();
  store.lastRun = run;
  store.lastReport = run.reports.at(-1);
}

export function getLastReport(): TruthReport | undefined {
  return getStore().lastReport;
}

export function getLastRun(): TruthRun | undefined {
  return getStore().lastRun;
}

export function getProducts(): Product[] {
  return getStore().products;
}

export function getOrder(id: string): Order | undefined {
  return getStore().orders[id];
}

export function getCheckout(id: string): CheckoutDraft | undefined {
  return getStore().checkouts[id];
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

function nextOrderId(store: StoreState): string {
  return `rr_${new Date().toISOString().slice(0, 10).replaceAll("-", "")}_${String(++store.sequence).padStart(3, "0")}`;
}

function nextCheckoutId(store: StoreState): string {
  return `co_${new Date().toISOString().slice(0, 10).replaceAll("-", "")}_${String(++store.checkoutSequence).padStart(3, "0")}`;
}

export class InsufficientInventoryError extends Error {
  constructor(
    public readonly productId: string,
    public readonly requested: number,
    public readonly available: number,
  ) {
    super(`Insufficient inventory for ${productId}: requested ${requested}, available ${available}`);
  }
}

function assertAndReserveInventory(store: StoreState, cart: CartLineInput[]): void {
  for (const item of cart) {
    const product = store.products.find((candidate) => candidate.id === item.productId);
    if (!product) {
      throw new Error(`Unknown product: ${item.productId}`);
    }
    if (!store.flags.BUG_INVENTORY_DOUBLE_SELLS && product.inventory < item.quantity) {
      throw new InsufficientInventoryError(product.id, item.quantity, product.inventory);
    }
  }

  if (store.flags.BUG_INVENTORY_DOUBLE_SELLS) {
    return;
  }

  for (const item of cart) {
    const product = store.products.find((candidate) => candidate.id === item.productId);
    if (product) {
      product.inventory -= item.quantity;
    }
  }
}

function cartFromLines(checkout: CheckoutDraft): CartLineInput[] {
  return checkout.lines.map((line) => ({ productId: line.productId, quantity: line.quantity }));
}

export function createCheckout(input: {
  cart: CartLineInput[];
  customerEmail: string;
  customerName: string;
  locale?: string;
  couponCode?: string;
}): CheckoutDraft {
  const store = getStore();
  const lines = buildOrderLines(store.products, input.cart);
  const expected = computeTruth(lines, input.couponCode);
  const allClaims = buildClaims(expected, store.flags, input.couponCode);
  const id = nextCheckoutId(store);
  const checkout: CheckoutDraft = {
    id,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    locale: input.locale || "en-IN",
    couponCode: input.couponCode?.trim().toUpperCase() || undefined,
    lines,
    expected,
    claims: {
      product: allClaims.product,
      cart: allClaims.cart,
      checkout: allClaims.checkout,
    },
    bugFlags: { ...store.flags },
    createdAt: new Date().toISOString(),
  };

  store.checkouts[id] = checkout;
  return checkout;
}

export function createOrder(input: {
  cart: CartLineInput[];
  customerEmail: string;
  customerName: string;
  locale?: string;
  couponCode?: string;
  checkoutId?: string;
}): Order {
  const store = getStore();
  assertAndReserveInventory(store, input.cart);
  const lines = buildOrderLines(store.products, input.cart);
  const expected = computeTruth(lines, input.couponCode);
  const id = nextOrderId(store);
  const order: Order = {
    id,
    checkoutId: input.checkoutId,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    locale: input.locale || "en-IN",
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

export function placeCheckoutOrder(checkoutId: string): Order {
  const checkout = getCheckout(checkoutId);
  if (!checkout) {
    throw new Error(`Unknown checkout: ${checkoutId}`);
  }

  return createOrder({
    checkoutId: checkout.id,
    cart: cartFromLines(checkout),
    customerEmail: checkout.customerEmail,
    customerName: checkout.customerName,
    locale: checkout.locale,
    couponCode: checkout.couponCode,
  });
}
