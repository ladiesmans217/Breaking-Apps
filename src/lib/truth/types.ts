export type Product = {
  id: string;
  name: string;
  description: string;
  sku: string;
  price: string;
  inventory: number;
  badge?: string;
};

export type CartLineInput = {
  productId: string;
  quantity: number;
};

export type OrderLine = {
  productId: string;
  name: string;
  sku: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
};

export type MoneyBreakdown = {
  subtotal: string;
  discount: string;
  tax: string;
  shipping: string;
  total: string;
};

export type BugFlag =
  | "BUG_COUPON_LIES"
  | "BUG_TAX_ROUNDING_DRIFT"
  | "BUG_EMAIL_TOTAL_WRONG"
  | "BUG_INVOICE_CENT_OFF"
  | "BUG_FREE_SHIPPING_THRESHOLD_WRONG"
  | "BUG_ADMIN_IGNORES_SHIPPING"
  | "BUG_INVENTORY_DOUBLE_SELLS"
  | "BUG_LOCALE_DECIMAL_DRIFT";

export type BugFlags = Partial<Record<BugFlag, boolean>>;

export type ClaimSource =
  | "product"
  | "cart"
  | "checkout"
  | "confirmation"
  | "email"
  | "admin"
  | "api"
  | "invoice";

export type SourceClaim = {
  source: ClaimSource;
  label: string;
  observed: MoneyBreakdown;
  fields: (keyof MoneyBreakdown)[];
  evidence?: string;
};

export type Order = {
  id: string;
  checkoutId?: string;
  customerEmail: string;
  customerName: string;
  locale: string;
  couponCode?: string;
  lines: OrderLine[];
  expected: MoneyBreakdown;
  claims: Record<ClaimSource, MoneyBreakdown>;
  bugFlags: BugFlags;
  createdAt: string;
};

export type CheckoutDraft = {
  id: string;
  customerEmail: string;
  customerName: string;
  locale: string;
  couponCode?: string;
  lines: OrderLine[];
  expected: MoneyBreakdown;
  claims: Pick<Record<ClaimSource, MoneyBreakdown>, "product" | "cart" | "checkout">;
  bugFlags: BugFlags;
  createdAt: string;
};

export type TruthMismatch = {
  source: ClaimSource;
  label: string;
  field: keyof MoneyBreakdown;
  expected: string;
  observed: string;
};

export type TruthReport = {
  runId: string;
  orderId: string;
  mode: "honest" | "mutant";
  scenario: string;
  bugFlags: BugFlags;
  decision: "SHIP" | "DO NOT SHIP";
  truthScore: number;
  checkedAt: string;
  expected: MoneyBreakdown;
  sources: SourceClaim[];
  mismatches: TruthMismatch[];
  evidence: {
    screenshot?: string;
    trace?: string;
    video?: string;
    invoiceText?: string;
    reproCommand?: string;
    localeChecks?: {
      locale: string;
      formatted: string;
      parsed: string;
      expected: string;
    }[];
  };
};

export type TruthRun = {
  runId: string;
  checkedAt: string;
  reports: TruthReport[];
  decision: "SHIP" | "DO NOT SHIP";
  truthScore: number;
};
