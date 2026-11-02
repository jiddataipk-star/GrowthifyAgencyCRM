/**
 * Money is stored as integer minor units (paisa / cents) with a currency code.
 * Dashboards report PKR; USD is always shown separately and never converted.
 */
export type Currency = "PKR" | "USD";

export const CURRENCIES: Currency[] = ["PKR", "USD"];

/** Major units (what people type) → integer minor units. */
export function toMinor(major: number | string): number {
  const value = typeof major === "string" ? Number(major.replace(/[,\s]/g, "")) : major;
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

/** Integer minor units → major units (for form defaults). */
export function toMajor(minor: number | null | undefined): number {
  return (minor ?? 0) / 100;
}

type FormatOptions = {
  /** Prefix + / − (uses a true minus sign). */
  sign?: "auto" | "always" | "never";
  /** 1.2M / 450k style for chart axes and tight spaces. */
  compact?: boolean;
  /** Hide the currency code. */
  bare?: boolean;
};

const plain = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatNumber(value: number | null | undefined): string {
  return plain.format(value ?? 0);
}

export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000_000) return `${sign}${trim(abs / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${trim(abs / 1_000)}k`;
  return `${sign}${plain.format(abs)}`;
}

function trim(value: number): string {
  return value >= 100 ? value.toFixed(0) : value.toFixed(1).replace(/\.0$/, "");
}

export function formatMoney(
  minor: number | null | undefined,
  currency: Currency | string = "PKR",
  options: FormatOptions = {},
): string {
  const value = (minor ?? 0) / 100;
  const abs = Math.abs(value);
  let body: string;
  if (options.compact) {
    body = compactNumber(abs);
  } else if (currency === "USD" && !Number.isInteger(abs)) {
    body = cents.format(abs);
  } else {
    body = plain.format(abs);
  }
  const code = options.bare ? "" : `${currency} `;
  const sign = options.sign ?? "auto";
  const prefix =
    sign === "never" ? "" : value < 0 ? "−" : sign === "always" && value > 0 ? "+" : "";
  return `${prefix}${code}${body}`;
}

/** Sum amounts per currency, e.g. for "PKR 1.2M · USD 900" summaries. */
export function sumByCurrency<T>(rows: T[], amount: (row: T) => number, currency: (row: T) => string) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(currency(row), (totals.get(currency(row)) ?? 0) + amount(row));
  }
  return totals;
}
