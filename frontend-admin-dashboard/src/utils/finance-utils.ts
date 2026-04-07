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
