// Payment vendor types
export type PaymentVendor = "STRIPE" | "EWAY" | "RAZORPAY" | "PAYPAL" | "CASHFREE";

interface InviteDataWithPayment {
  vendor: PaymentVendor;
}

/**
 * Hook to get payment vendor from invite data
 * This determines which payment gateway to use based on the invite data
 *
 * @param inviteData - The invite data from the API
 * @returns The payment vendor to use (STRIPE, EWAY, RAZORPAY, or PAYPAL)
 */
export const getPaymentVendor = (
  inviteData: InviteDataWithPayment
): PaymentVendor => {
  // Check if vendor is specified in payment option metadata

  if (!inviteData?.vendor) {
    console.warn("No payment option found in invite data");
    return "STRIPE"; // Default to Stripe
  }
  if (inviteData.vendor) {
    return inviteData.vendor.toUpperCase() as PaymentVendor;
  }

  // Default to Stripe if no vendor is specified
  console.warn("No vendor specified in payment option, defaulting to STRIPE");
  return "STRIPE";
};
