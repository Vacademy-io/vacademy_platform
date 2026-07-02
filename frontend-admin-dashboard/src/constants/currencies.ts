/**
 * Canonical list of currencies the platform can charge in.
 *
 * This is the single source of truth for the admin dashboard. Anything that needs a
 * currency dropdown, a currency symbol, or the set of selectable payment currencies
 * should import from here instead of redefining its own list — that is what kept the
 * old `payments.ts` / `Payment/utils` / invoice lists drifting out of sync.
 *
 * `decimals` mirrors the backend `CurrencyRegistry` minor-unit exponent (0 = no minor
 * unit, e.g. JPY). Gateways charge in minor units, so this must match the backend.
 *
 * NOTE: this is the set of currencies a payment can be *taken* in. The marketing
 * pricing page (`config/pricing.ts` + `types/pricing.ts`) is a separate, narrower set
 * because each plan there must have an explicit published price per currency.
 */
export interface Currency {
    code: string;
    name: string;
    symbol: string;
    /** Minor-unit decimal places — keep in sync with backend CurrencyRegistry. */
    decimals: number;
}

export const CURRENCIES: Currency[] = [
    { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
    { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
    { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 },
    { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimals: 2 },
    { code: 'SAR', name: 'Saudi Riyal', symbol: 'SR', decimals: 2 },
    { code: 'QAR', name: 'Qatari Riyal', symbol: 'QR', decimals: 2 },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2 },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2 },
    { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimals: 2 },
    { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2 },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0 },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2 },
    { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2 },
];

/** All selectable currency codes, e.g. for typing a `currency` field. */
export type PaymentCurrencyCode = (typeof CURRENCIES)[number]['code'];

/** Shape consumed by the legacy currency dropdowns (`{ code, name, symbol }`). */
export const currencyOptions = CURRENCIES.map(({ code, name, symbol }) => ({ code, name, symbol }));

/** Map of currency code → symbol. */
export const currencySymbols: Record<string, string> = CURRENCIES.reduce(
    (acc, { code, symbol }) => {
        acc[code] = symbol;
        return acc;
    },
    {} as Record<string, string>
);

/** Returns the symbol for a code, falling back to the code itself for unknown currencies. */
export const getCurrencySymbol = (currencyCode: string): string => {
    return currencySymbols[currencyCode] || currencyCode;
};

/** Minor-unit decimal places for a code (defaults to 2 for unknown currencies). */
export const getCurrencyDecimals = (currencyCode: string): number => {
    return CURRENCIES.find((c) => c.code === currencyCode)?.decimals ?? 2;
};
