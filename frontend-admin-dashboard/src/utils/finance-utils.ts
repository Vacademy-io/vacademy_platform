/** 
 * Formats a number into Indian Currency (Rupees) with abbreviations for Cr and L.
 * @param val The numerical value to format.
 * @returns A formatted string e.g., "₹ 2.50 Cr", "₹ 1.20 L", "₹ 50,000"
 */
export const formatCurrency = (val: number | undefined | null): string => {
    if (val === undefined || val === null) return '₹ 0';
    
    // Crore (10,000,000)
    if (Math.abs(val) >= 10000000) {
        return `₹ ${(val / 10000000).toFixed(2)} Cr`;
    }
    
    // Lakh (100,000)
    if (Math.abs(val) >= 100000) {
        return `₹ ${(val / 100000).toFixed(2)} L`;
    }
    
    // Standard Indian Locale
    return `₹ ${val.toLocaleString('en-IN')}`;
};

/**
 * Formats a raw payment-plan price to a clean fixed-2-decimal string for display.
 *
 * Backend plan prices frequently arrive with binary floating-point noise
 * (e.g. `34999.299999999996` instead of `34999.30`) — or as numeric strings
 * derived from those floats. Use this anywhere a payment plan / option price is
 * rendered (dropdowns, invite previews, sidebars) so the user never sees the
 * noise. A value that isn't a finite number (e.g. `''` or a label like `'Free'`)
 * is returned untouched so callers can render it as-is.
 */
export const formatPlanPrice = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined || value === '') return '';
    const num = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(num)) return String(value);
    return (num as number).toFixed(2);
};
