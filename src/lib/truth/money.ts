import Decimal from "decimal.js";

Decimal.set({ precision: 24, rounding: Decimal.ROUND_HALF_UP });

export const INR_SYMBOL = "₹";

export function d(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

export function money(value: Decimal.Value): string {
  return d(value).toDecimalPlaces(2).toFixed(2);
}

export function formatINR(value: Decimal.Value): string {
  const fixed = money(value);
  const [whole, cents] = fixed.split(".");
  const withGroups = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Number(whole));
  return `${INR_SYMBOL}${withGroups}.${cents}`;
}

export function parseMoney(value: string): string {
  const normalized = value.replace(/[^\d.-]/g, "");
  return money(normalized || "0");
}

export function addMoney(a: Decimal.Value, b: Decimal.Value): string {
  return money(d(a).plus(b));
}

export function subtractMoney(a: Decimal.Value, b: Decimal.Value): string {
  return money(d(a).minus(b));
}

export function sameMoney(a: string, b: string): boolean {
  return d(a).toDecimalPlaces(2).eq(d(b).toDecimalPlaces(2));
}
