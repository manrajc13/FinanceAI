// The ONLY module that formats financial values. Rates/weights arrive as decimals
// (0.25 = 25%); money arrives as decimal strings. Number() is used for display only.

export type Currency = "INR" | "USD";

const LOCALE: Record<Currency, string> = { INR: "en-IN", USD: "en-US" };

export function money(value: string | number, currency: Currency, digits = 0): string {
  return new Intl.NumberFormat(LOCALE[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value));
}

function trim(n: number, digits: number): string {
  return String(Number(n.toFixed(digits)));
}

/** Axis-friendly money: ₹70L, ₹1.2Cr, $70K, $1.2M. */
export function moneyCompact(value: string | number, currency: Currency): string {
  const n = Number(value);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (currency === "INR") {
    if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7, 2)}Cr`;
    if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5, 1)}L`;
    if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3, 1)}K`;
    return `${sign}₹${trim(abs, 0)}`;
  }
  if (abs >= 1e9) return `${sign}$${trim(abs / 1e9, 2)}B`;
  if (abs >= 1e6) return `${sign}$${trim(abs / 1e6, 2)}M`;
  if (abs >= 1e3) return `${sign}$${trim(abs / 1e3, 1)}K`;
  return `${sign}$${trim(abs, 0)}`;
}

export function pct(value: number, { digits = 1, sign = false }: { digits?: number; sign?: boolean } = {}): string {
  const text = `${(value * 100).toFixed(digits)}%`;
  return sign && value > 0 ? `+${text}` : text;
}

export function ratio(value: number, digits = 2): string {
  return value.toFixed(digits);
}

/** Correlation and other unitless values in [-1, 1]. */
export function corr(value: number): string {
  return value.toFixed(2);
}

function utcDate(iso: string): Date {
  return new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
}

export function monthYear(iso: string): string {
  return utcDate(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function year(iso: string): string {
  return String(utcDate(iso).getUTCFullYear());
}

export function dateLong(iso: string): string {
  return utcDate(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function currencySymbol(currency: Currency): string {
  return currency === "INR" ? "₹" : "$";
}

/** Group digits while typing (display only); the stored value stays a plain decimal string. */
export function groupDigits(raw: string, currency: Currency): string {
  if (!/^\d+(\.\d{0,2})?$/.test(raw)) return raw;
  const [whole, fraction] = raw.split(".");
  const grouped = new Intl.NumberFormat(LOCALE[currency], { maximumFractionDigits: 0 }).format(BigInt(whole));
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

export const MONEY_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;

export function isValidAmount(value: string): boolean {
  return MONEY_PATTERN.test(value) && Number(value) > 0;
}
