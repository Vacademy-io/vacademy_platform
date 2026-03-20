// Payment vendor types
export type PaymentVendor = "STRIPE" | "EWAY" | "RAZORPAY" | "PAYPAL" | "CASHFREE" | "FREE";

interface InviteDataWithPayment {
  vendor: PaymentVendor | null;
}

/**
 * Hook to get payment vendor from invite data
 * This determines which payment gateway to use based on the invite data
 *
 * @param inviteData - The invite data from the API
 * @returns The payment vendor to use (STRIPE, EWAY, RAZORPAY, PAYPAL, or FREE)
 */
export const getPaymentVendor = (
  inviteData: InviteDataWithPayment
): PaymentVendor => {
  if (!inviteData?.vendor) {
    // No vendor means FREE invite — no payment gateway needed
    return "FREE";
  }
  return inviteData.vendor.toUpperCase() as PaymentVendor;
};
