/**
 * Single source of truth for how each payment gateway is BRANDED across the admin app — its display
 * name, letter mark, and badge colour. It lives alongside the Institute Settings → Payment Gateways
 * screen (where gateways are actually enabled/configured) so both the settings list and the payments
 * screens render the same logo/label for a vendor. Add a gateway once here and it flows through
 * everywhere.
 *
 * There are no licensed logo image assets, so — like the design mockups — a gateway "logo" is a
 * brand-tinted badge carrying its initial; offline / manual collection gets a cash glyph instead.
 */

export interface GatewayBranding {
    label: string;
    /** Single-letter brandmark. Empty string ⇒ render the offline/cash glyph. */
    mark: string;
    /** Tailwind classes for the badge (border + bg + text), mirroring the settings vendor badges. */
    badgeClass: string;
}

/** Keyed by the canonical uppercase vendor code (see `PaymentVendor`, plus common extras). */
export const GATEWAY_BRANDING: Record<string, GatewayBranding> = {
    RAZORPAY: {
        label: 'Razorpay',
        mark: 'R',
        badgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
    },
    STRIPE: {
        label: 'Stripe',
        mark: 'S',
        badgeClass: 'border-violet-200 bg-violet-50 text-violet-700',
    },
    PHONEPE: {
        label: 'PhonePe',
        mark: 'P',
        badgeClass: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    },
    CASHFREE: {
        label: 'Cashfree',
        mark: 'C',
        badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    EWAY: { label: 'Eway', mark: 'E', badgeClass: 'border-amber-200 bg-amber-50 text-amber-700' },
    PAYU: { label: 'PayU', mark: 'P', badgeClass: 'border-lime-200 bg-lime-50 text-lime-700' },
    PAYPAL: { label: 'PayPal', mark: 'P', badgeClass: 'border-sky-200 bg-sky-50 text-sky-700' },
    PAYTM: { label: 'Paytm', mark: 'P', badgeClass: 'border-cyan-200 bg-cyan-50 text-cyan-700' },
};

export const OFFLINE_BRANDING: GatewayBranding = {
    label: 'Offline',
    mark: '',
    badgeClass: 'border-slate-200 bg-slate-50 text-slate-600',
};

/** Vendor codes that mean money collected outside a gateway (rendered with the cash glyph). */
const OFFLINE_VENDORS = new Set([
    'MANUAL',
    'CASH',
    'OFFLINE',
    'CHEQUE',
    'CHECK',
    'BANK',
    'BANK_TRANSFER',
    'NEFT',
    'RTGS',
    'DD',
]);

export const normalizeVendor = (vendor?: string | null): string =>
    (vendor || '')
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, '_');

/**
 * Resolve the branding for a free-form `payment_log.vendor` string. Unknown gateways get a neutral
 * badge with their first initial so a newly-added-in-settings vendor still renders sensibly.
 */
export const resolveGatewayBranding = (vendor?: string | null): GatewayBranding => {
    const key = normalizeVendor(vendor);
    if (!key) return { ...OFFLINE_BRANDING, label: 'Other' };
    if (GATEWAY_BRANDING[key]) return GATEWAY_BRANDING[key]!;
    if (OFFLINE_VENDORS.has(key)) return OFFLINE_BRANDING;
    return {
        label: (vendor || '').trim() || 'Other',
        mark: key[0] || '?',
        badgeClass: 'border-slate-200 bg-slate-50 text-slate-600',
    };
};
