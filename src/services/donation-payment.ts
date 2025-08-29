import axios from "axios";
import { getTokenFromStorage } from "@/lib/auth/axiosInstance";
import { TokenKey } from "@/constants/auth/tokens";

const DONATION_PAYMENT_URL = "https://backend-stage.vacademy.io/admin-core-service/payments/user-plan/user-plan-payment";

export interface DonationPaymentRequest {
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

export interface DonationPaymentResponse {
  success: boolean;
  message: string;
  payment_id?: string;
  transaction_id?: string;
}

/**
 * Process donation payment for already enrolled users
 */
export const processDonationPayment = async (
  instituteId: string,
  userPlanId: string,
  paymentData: {
    amount: number;
    email: string;
    paymentMethodId: string;
    cardLast4: string;
    customerId: string;
    description?: string;
  }
): Promise<DonationPaymentResponse> => {
  try {
    console.log('🚀 [DONATION PAYMENT] Starting donation payment process...');
    console.log('📋 [DONATION PAYMENT] Parameters:', {
      instituteId,
      userPlanId,
      amount: paymentData.amount,
      email: paymentData.email,
      paymentMethodId: paymentData.paymentMethodId,
      cardLast4: paymentData.cardLast4,
      customerId: paymentData.customerId,
      description: paymentData.description
    });

    const token = await getTokenFromStorage(TokenKey.accessToken);
    if (!token) {
      console.error('❌ [DONATION PAYMENT] No access token found');
      throw new Error("No access token found");
    }
    console.log('✅ [DONATION PAYMENT] Access token retrieved successfully');

    const payload: DonationPaymentRequest = {
      amount: paymentData.amount,
      currency: "USD", // Default currency, can be made configurable
      description: paymentData.description || "Course donation",
      charge_automatically: true,
      order_id: `donation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      institute_id: instituteId,
      email: paymentData.email,
      vendor: "STRIPE",
      vendor_id: "STRIPE",
      stripe_request: {
        payment_method_id: paymentData.paymentMethodId,
        card_last4: paymentData.cardLast4,
        customer_id: paymentData.customerId,
      },
      razorpay_request: {
        customer_id: "",
        contact: "",
        email: paymentData.email,
      },
      pay_pal_request: {},
      include_pending_items: true,
    };

    console.log('📤 [DONATION PAYMENT] API Payload prepared:', payload);
    console.log('🌐 [DONATION PAYMENT] Making API call to:', `${DONATION_PAYMENT_URL}?instituteId=${instituteId}&userPlanId=${userPlanId}`);

    console.log('🌐 [DONATION PAYMENT] Making API call with exact curl format...');
    
    const response = await axios.post(
      `${DONATION_PAYMENT_URL}?instituteId=${instituteId}&userPlanId=${userPlanId}`,
      payload,
      {
        headers: {
          accept: "*/*",
          "accept-language": "en-US,en;q=0.9",
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
          origin: "https://backend-stage.vacademy.io",
          referer: "https://backend-stage.vacademy.io/admin-core-service/swagger-ui/index.html",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
        },
      }
    );

    console.log('✅ [DONATION PAYMENT] API Response received:', response.data);
    console.log('🎉 [DONATION PAYMENT] Donation payment successful!');

    return {
      success: true,
      message: "Donation payment successful",
      payment_id: response.data?.payment_id,
      transaction_id: response.data?.transaction_id,
    };
  } catch (error) {
    console.error('❌ [DONATION PAYMENT] Donation payment failed:', error);
    
    if (error instanceof Error) {
      throw new Error(`Donation payment failed: ${error.message}`);
    } else {
      throw new Error("Donation payment failed. Please try again.");
    }
  }
};

/**
 * Get user plan ID from learner info
 */
export const getUserPlanId = async (instituteId: string): Promise<string | null> => {
  try {
    console.log('🔍 [USER PLAN] Fetching user plan ID for institute:', instituteId);
    
    const token = await getTokenFromStorage(TokenKey.accessToken);
    if (!token) {
      console.error('❌ [USER PLAN] No access token found');
      throw new Error("No access token found");
    }
    console.log('✅ [USER PLAN] Access token retrieved successfully');

    console.log('🌐 [USER PLAN] Making API call to learner info endpoint');
    
    const response = await axios.get(
      `https://backend-stage.vacademy.io/admin-core-service/learner/info/v1/details?instituteId=${instituteId}`,
      {
        headers: {
          accept: "*/*",
          "accept-language": "en-US,en;q=0.9",
          "priority": "u=1, i",
          referer: "https://backend-stage.vacademy.io/admin-core-service/swagger-ui/index.html",
          "sec-ch-ua": '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const learnerInfo = response.data;
    console.log('📋 [USER PLAN] Learner info response:', learnerInfo);
    
    if (learnerInfo && learnerInfo.length > 0) {
      // Find the first learner record with a user_plan_id
      const learnerWithPlan = learnerInfo.find(learner => learner.user_plan_id);
      
      if (learnerWithPlan) {
        console.log('✅ [USER PLAN] User plan ID found:', learnerWithPlan.user_plan_id);
        return learnerWithPlan.user_plan_id;
      } else {
        console.log('⚠️ [USER PLAN] No user plan ID found in any learner record - this means user needs to use enrollment API');
        console.log('📊 [USER PLAN] All learner records have null user_plan_id, will fallback to enrollment API');
        return null;
      }
    }

    console.log('⚠️ [USER PLAN] No learner info or user plan ID found');
    return null;
  } catch (error) {
    console.error('❌ [USER PLAN] Error fetching user plan ID:', error);
    return null;
  }
};
