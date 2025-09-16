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
    return_url?: string;
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
  response_data?: {
    amount: number;
    created: number;
    clientSecret: string;
    currency: string;
    receiptUrl: string;
    transactionId: string;
    paymentStatus: string;
    status: string;
  };
  order_id?: string;
  status?: string | null;
  message?: string | null;
  success?: boolean;
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
    throw error;
  }
};

export const createDonationRequest = (
  amount: number,
  email: string,
  paymentMethodId: string,
  cardLast4: string,
  customerId: string = "",
  returnUrl?: string
): Omit<DonationRequest, 'institute_id'> => {
  const request = {
    amount: amount, // Send amount in dollars
    currency: "USD",
    description: `Donation of $${amount}`,
    charge_automatically: true,
    order_id: `donation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    email: email,
    vendor: "STRIPE",
    vendor_id: paymentMethodId,
    stripe_request: {
      payment_method_id: paymentMethodId,
      card_last4: cardLast4,
      customer_id: customerId,
      return_url: returnUrl || "",
    },
    razorpay_request: {
      customer_id: "",
      contact: "",
      email: email,
    },
    pay_pal_request: {},
    include_pending_items: true,
  };
  
  return request;
};
