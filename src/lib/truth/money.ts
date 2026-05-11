import Decimal from "decimal.js";

Decimal.set({ precision: 24, rounding: Decimal.ROUND_HALF_UP });

export const INR_SYMBOL = "₹";

export const SUPPORTED_LOCALES = ["en-IN", "en-US", "en-GB", "de-DE", "fr-FR"] as const;

export function d(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

export function money(value: Decimal.Value): string {
  return d(value).toDecimalPlaces(2).toFixed(2);
}

export function formatINR(value: Decimal.Value): string {
  return formatINRForLocale(value, "en-IN");
}

export function formatINRForLocale(value: Decimal.Value, locale: string): string {
  const fixed = money(value);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(fixed));
}

export function parseMoney(value: string): string {
  const normalized = value.replace(/[^\d.-]/g, "");
  return money(normalized || "0");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseLocalizedMoney(value: string, locale: string): string {
  const parts = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(12345.6);
  const group = parts.find((part) => part.type === "group")?.value ?? ",";
  const decimal = parts.find((part) => part.type === "decimal")?.value ?? ".";
  const normalized = value
    .replace(new RegExp(escapeRegExp(group), "g"), "")
    .replace(new RegExp(escapeRegExp(decimal), "g"), ".")
    .replace(/[^\d.-]/g, "");
  return money(normalized || "0");
}

export function parseLocalizedMoneyWithFlags(value: string, locale: string, bugLocaleDecimalDrift?: boolean): string {
  if (bugLocaleDecimalDrift && locale === "de-DE") {
    return parseMoney(value);
  }
  return parseLocalizedMoney(value, locale);
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
