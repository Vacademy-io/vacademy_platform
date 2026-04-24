// Payment vendor types
export type PaymentVendor = "STRIPE" | "EWAY" | "RAZORPAY" | "PAYPAL" | "CASHFREE" | "FREE";

interface InviteDataWithPayment {
  vendor: PaymentVendor | null;
  package_session_to_payment_options?: any[];
}

/**
 * Hook to get payment vendor from invite data
 * This determines which payment gateway to use based on the invite data
 *
 * @param inviteData - The invite data from the API
 * @returns The payment vendor to use (STRIPE, EWAY, RAZORPAY, PAYPAL, CASHFREE, or FREE)
 */
export const getPaymentVendor = (
  inviteData: InviteDataWithPayment
): PaymentVendor => {
  // If the payment plan type itself is FREE, no gateway is needed
  const paymentOptionType =
    inviteData?.package_session_to_payment_options?.[0]?.payment_option?.type?.toUpperCase();

  if (paymentOptionType === "FREE") {
    return "FREE";
  }

  if (!inviteData?.vendor) {
    // No vendor means FREE invite — no payment gateway needed
    return "FREE";
  }

  return inviteData.vendor.toUpperCase() as PaymentVendor;
};
