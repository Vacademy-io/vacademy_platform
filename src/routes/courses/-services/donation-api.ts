interface DonationRequest {
  amount: number;
  currency: string;
  description: string;
  charge_automatically: boolean;
  order_id: string;
  institute_id: string;
  email: string;
  vendor: string;
  vendor_id: string;
  stripe_request: {
    payment_method_id: string;
    card_last4: string;
    customer_id: string;
  };
  razorpay_request: {
    customer_id: string;
    contact: string;
    email: string;
  };
  pay_pal_request: Record<string, any>;
  include_pending_items: boolean;
}

interface DonationResponse {
  success?: boolean;
  status?: string;
  message?: string;
  [key: string]: any;
}

export const processDonationPayment = async (
  instituteId: string,
  donationData: Omit<DonationRequest, 'institute_id'>
): Promise<DonationResponse> => {
  try {
    const response = await fetch(
      `https://backend-stage.vacademy.io/admin-core-service/open/payments/pay?instituteId=${instituteId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "accept": "*/*",
        },
        body: JSON.stringify({
          ...donationData,
          institute_id: instituteId,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Payment failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Donation payment error:", error);
    throw error;
  }
};

export const createDonationRequest = (
  amount: number,
  email: string,
  paymentMethodId: string,
  cardLast4: string,
  customerId: string = ""
): Omit<DonationRequest, 'institute_id'> => {
  return {
    amount: amount * 100, // Convert to cents
    currency: "USD",
    description: `Donation of $${amount}`,
    charge_automatically: true,
    order_id: `donation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    email: email,
    vendor: "stripe",
    vendor_id: paymentMethodId,
    stripe_request: {
      payment_method_id: paymentMethodId,
      card_last4: cardLast4,
      customer_id: customerId,
    },
    razorpay_request: {
      customer_id: "",
      contact: "",
      email: email,
    },
    pay_pal_request: {},
    include_pending_items: true,
  };
};
