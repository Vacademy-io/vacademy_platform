/**
 * Locale-aware formatting helpers (Intl.*), driven by the active UI locale.
 *
 * Phase 0 of internationalization: these exist so new code (and later
 * call-site sweeps) format dates/numbers/currency per the user's language
 * instead of hardcoding en-US conventions. No existing call sites have been
 * migrated yet — adopt incrementally. Mirrors the admin app's
 * src/lib/formatters.ts (minus the per-currency decimals table, which this
 * app doesn't have — Intl's own minor-unit data covers e.g. JPY having 0).
 */
import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from "@/i18n/locales";
import { useLanguageStore } from "@/stores/localization/useLanguageStore";

/** The user's active UI locale (safe to call anywhere, including non-React code). */
export function getActiveLocale(): SupportedLocale {
  try {
    return normalizeLocale(useLanguageStore.getState().locale);
  } catch {
    return DEFAULT_LOCALE;
  }
}

type DateInput = Date | string | number;

function toDate(value: DateInput): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** e.g. en: "16 Jul 2026" · hi: "16 जुल॰ 2026" · ar: "١٦ يوليو ٢٠٢٦" */
export function formatDate(value: DateInput, options?: Intl.DateTimeFormatOptions): string {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(getActiveLocale(), {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  }).format(date);
}

/** Date + time, e.g. "16 Jul 2026, 5:30 pm" in the active locale. */
export function formatDateTime(value: DateInput, options?: Intl.DateTimeFormatOptions): string {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(getActiveLocale(), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...options,
  }).format(date);
}

const RELATIVE_UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: "week", ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
];

/**
 * Relative time in the active locale, e.g. "3 days ago" / "in 2 hours"
 * (hi: "3 दिन पहले"). `base` defaults to now.
 */
export function formatRelative(value: DateInput, base: DateInput = Date.now()): string {
  const date = toDate(value);
  const baseDate = toDate(base);
  if (!date || !baseDate) return "";

  const diffMs = date.getTime() - baseDate.getTime();
  const rtf = new Intl.RelativeTimeFormat(getActiveLocale(), { numeric: "auto" });

  for (const { unit, ms } of RELATIVE_UNITS) {
    if (Math.abs(diffMs) >= ms) {
      return rtf.format(Math.trunc(diffMs / ms), unit);
    }
  }
  return rtf.format(Math.trunc(diffMs / 1000), "second");
}

/** Locale-aware number, e.g. en-style 1,234,567.89 vs hi-style 12,34,567.89. */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(getActiveLocale(), options).format(value);
}

/** Formats a FRACTION as a percentage: 0.42 → "42%". */
export function formatPercent(value: number, options?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(getActiveLocale(), {
    style: "percent",
    maximumFractionDigits: 1,
    ...options,
  }).format(value);
}

/**
 * Currency in the active locale. Intl supplies each currency's minor-unit
 * decimals (JPY → 0, USD/INR → 2).
 */
export function formatCurrency(
  amount: number,
  currencyCode: string,
  options?: Intl.NumberFormatOptions
): string {
  if (!Number.isFinite(amount)) return "";
  try {
    return new Intl.NumberFormat(getActiveLocale(), {
      style: "currency",
      currency: currencyCode,
      ...options,
    }).format(amount);
  } catch {
    // Unknown/invalid ISO code — degrade to "CODE 1,234.56" instead of throwing.
    return `${currencyCode} ${formatNumber(amount, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}
