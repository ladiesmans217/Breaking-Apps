import { d, money, subtractMoney } from "./money";
import { totalWith } from "./oracle";
import type { BugFlags, ClaimSource, MoneyBreakdown } from "./types";

function cloneBreakdown(base: MoneyBreakdown): MoneyBreakdown {
  return { ...base };
}

export function applyBugFlags(
  source: ClaimSource,
  expected: MoneyBreakdown,
  flags: BugFlags,
  couponCode?: string,
): MoneyBreakdown {
  let observed = cloneBreakdown(expected);

  if (
    flags.BUG_FREE_SHIPPING_THRESHOLD_WRONG &&
    (source === "cart" || source === "checkout") &&
    d(expected.subtotal).equals("1999.99")
  ) {
    observed = totalWith({ shipping: "0.00" }, observed);
  }

  if (
    flags.BUG_COUPON_LIES &&
    couponCode?.toUpperCase() === "SAVE20" &&
    (source === "checkout" || source === "confirmation")
  ) {
    observed = {
      ...observed,
      total: money(d(observed.total).minus(observed.discount)),
    };
  }

  if (flags.BUG_TAX_ROUNDING_DRIFT && source === "checkout") {
    observed = totalWith({ tax: money(d(observed.tax).plus("0.01")) }, observed);
  }

  if (flags.BUG_EMAIL_TOTAL_WRONG && source === "email") {
    observed = { ...observed, total: observed.subtotal };
  }

  if (flags.BUG_ADMIN_IGNORES_SHIPPING && source === "admin") {
    const ignoredShipping = observed.shipping;
    observed = {
      ...observed,
      shipping: "0.00",
      total: subtractMoney(observed.total, ignoredShipping),
    };
  }

  if (flags.BUG_INVOICE_CENT_OFF && source === "invoice") {
    observed = { ...observed, total: money(d(observed.total).plus("0.01")) };
  }

  return observed;
}
