import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS, SAVE_INSTITUTE_SETTING } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

// ─── Types ───────────────────────────────────────────────────────────────────

/** A single named tax component, e.g. { label: "CGST", rate: 9 }. */
export interface TaxComponent {
    label: string;
    rate: number;
}

/**
 * The operating country for invoicing: which country, the institute's own tax
 * registration number (GSTIN / VAT no.) and the tax components that apply there.
 * Injected into invoice templates via {{country}}, {{tax_registration_number}}
 * and {{tax_components}}.
 */
export interface InvoiceCountryConfig {
    /** Lowercase ISO 3166-1 alpha-2 code, e.g. "in". */
    code: string;
    /** Human-readable country name, e.g. "India". */
    name: string;
    /** Institute's own tax registration number (GSTIN / VAT no.). */
    taxRegistrationNumber: string;
    /** HSN/SAC code (SAC for services such as courses). Injectable via {{hsn_code}}. */
    hsnSacCode: string;
    /** Default tax components, applied when a package type has no specific override. */
    taxComponents: TaxComponent[];
    /**
     * Per-package-type tax components, keyed by package type (COURSE, PRODUCT,
     * SERVICE, …). At invoice time each line item uses its type's components,
     * falling back to {@link taxComponents}.
     */
    taxComponentsByPackageType: Record<string, TaxComponent[]>;
}

/**
 * Where the generated invoice PDF is delivered after a successful payment.
 * - `INVOICE_EMAIL` (default): PDF goes in the dedicated invoice email; the payment-confirmation
 *   email is sent separately with no PDF (legacy behaviour — two emails).
 * - `PAYMENT_CONFIRMATION_EMAIL`: PDF is attached to the payment-confirmation email and the
 *   separate invoice email is suppressed, so the learner receives a single email.
 */
export type InvoicePdfPlacement = 'INVOICE_EMAIL' | 'PAYMENT_CONFIRMATION_EMAIL';

/** Package types that can have their own tax components (matches backend package_type). */
export const PACKAGE_TYPES = [
    'COURSE',
    'PRODUCT',
    'SERVICE',
    'MEMBERSHIP',
    'DELIVERY_CHARGE',
    'SECURITY_DEPOSIT',
] as const;

export interface InvoiceSettingsData {
    /** Whether listed prices already include tax. */
    taxIncluded: boolean;
    /** Default tax rate as a percentage (e.g. 18 for 18%). */
    taxRate: number;
    /** Label shown for the tax line, e.g. "GST", "VAT". */
    taxLabel: string;
    /** ISO currency code, e.g. "INR". */
    currency: string;
    /** Whether the invoice email is sent to the learner automatically. */
    sendInvoiceEmail: boolean;
    /** Which email carries the invoice PDF after a successful payment. */
    invoicePdfPlacement: InvoicePdfPlacement;
    /**
     * Generate an invoice when an admin enrolls learners manually / in bulk
     * (no payment gateway). Read by BulkAssignmentService.
     */
    generateInvoiceOnManualEnroll: boolean;
    country: InvoiceCountryConfig;
}

export const SETTING_KEY = 'INVOICE_SETTING';

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettingsData = {
    taxIncluded: false,
    taxRate: 0,
    taxLabel: 'Tax',
    currency: 'INR',
    sendInvoiceEmail: false,
    invoicePdfPlacement: 'INVOICE_EMAIL',
    generateInvoiceOnManualEnroll: false,
    country: {
        code: '',
        name: '',
        taxRegistrationNumber: '',
        hsnSacCode: '',
        taxComponents: [],
        taxComponentsByPackageType: {},
    },
};

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Currencies the invoice generator knows how to render a symbol for. */
export const CURRENCY_OPTIONS: Array<{ code: string; label: string; symbol: string }> = [
    { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
    { code: 'USD', label: 'US Dollar', symbol: '$' },
    { code: 'EUR', label: 'Euro', symbol: '€' },
    { code: 'GBP', label: 'British Pound', symbol: '£' },
    { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
    { code: 'AUD', label: 'Australian Dollar', symbol: '$' },
    { code: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
    { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$' },
    { code: 'AED', label: 'UAE Dirham', symbol: 'د.إ' },
];

/**
 * Suggested tax components per country (applied when a country is picked and no
 * components have been configured yet). The admin can edit/add/remove freely.
 */
export const COUNTRY_TAX_PRESETS: Record<string, TaxComponent[]> = {
    in: [
        { label: 'CGST', rate: 9 },
        { label: 'SGST', rate: 9 },
    ],
    gb: [{ label: 'VAT', rate: 20 }],
    ae: [{ label: 'VAT', rate: 5 }],
    au: [{ label: 'GST', rate: 10 }],
    sg: [{ label: 'GST', rate: 9 }],
    us: [{ label: 'Sales Tax', rate: 0 }],
    ca: [{ label: 'GST', rate: 5 }],
    de: [{ label: 'VAT', rate: 19 }],
    fr: [{ label: 'VAT', rate: 20 }],
};

/** Suggested currency per country (applied alongside the tax preset). */
export const COUNTRY_DEFAULT_CURRENCY: Record<string, string> = {
    in: 'INR',
    us: 'USD',
    gb: 'GBP',
    ae: 'AED',
    au: 'AUD',
    sg: 'SGD',
    ca: 'CAD',
    de: 'EUR',
    fr: 'EUR',
};

// ─── API ─────────────────────────────────────────────────────────────────────

/** Sanitize a raw component array into clean { label, rate } entries. */
const normalizeComponents = (arr: unknown): TaxComponent[] =>
    Array.isArray(arr)
        ? arr.map((c) => ({
              label: (c as TaxComponent)?.label ?? '',
              rate: Number((c as TaxComponent)?.rate ?? 0) || 0,
          }))
        : [];

/** Normalize whatever shape the API returns into a complete InvoiceSettingsData. */
const normalize = (raw: Partial<InvoiceSettingsData> | null | undefined): InvoiceSettingsData => {
    const base = raw ?? {};
    const country = (base.country ?? {}) as Partial<InvoiceCountryConfig>;
    const byType: Record<string, TaxComponent[]> = {};
    if (country.taxComponentsByPackageType && typeof country.taxComponentsByPackageType === 'object') {
        for (const [type, comps] of Object.entries(country.taxComponentsByPackageType)) {
            byType[type] = normalizeComponents(comps);
        }
    }
    return {
        taxIncluded: base.taxIncluded ?? DEFAULT_INVOICE_SETTINGS.taxIncluded,
        taxRate: Number(base.taxRate ?? DEFAULT_INVOICE_SETTINGS.taxRate) || 0,
        taxLabel: base.taxLabel ?? DEFAULT_INVOICE_SETTINGS.taxLabel,
        currency: base.currency ?? DEFAULT_INVOICE_SETTINGS.currency,
        sendInvoiceEmail: base.sendInvoiceEmail ?? DEFAULT_INVOICE_SETTINGS.sendInvoiceEmail,
        invoicePdfPlacement:
            base.invoicePdfPlacement === 'PAYMENT_CONFIRMATION_EMAIL'
                ? 'PAYMENT_CONFIRMATION_EMAIL'
                : DEFAULT_INVOICE_SETTINGS.invoicePdfPlacement,
        generateInvoiceOnManualEnroll:
            base.generateInvoiceOnManualEnroll ?? DEFAULT_INVOICE_SETTINGS.generateInvoiceOnManualEnroll,
        country: {
            code: country.code ?? '',
            name: country.name ?? '',
            taxRegistrationNumber: country.taxRegistrationNumber ?? '',
            hsnSacCode: country.hsnSacCode ?? '',
            taxComponents: normalizeComponents(country.taxComponents),
            taxComponentsByPackageType: byType,
        },
    };
};

export const fetchInvoiceSettings = async (): Promise<InvoiceSettingsData> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_INSITITUTE_SETTINGS,
        params: { instituteId, settingKey: SETTING_KEY },
    });
    return normalize(response.data?.data);
};

export const saveInvoiceSettings = async (data: InvoiceSettingsData): Promise<void> => {
    const instituteId = getCurrentInstituteId();
    await authenticatedAxiosInstance.post(
        SAVE_INSTITUTE_SETTING,
        { setting_name: 'Invoice Setting', setting_data: data },
        { params: { instituteId, settingKey: SETTING_KEY } }
    );
};
