import { useState, useEffect } from "react";
import {
  fetchPaymentGatewayDetails,
  fetchEnrollmentDetails,
  handlePaymentForEnrollment,
  getPaymentOptions,
  getPaymentPlans,
  type EnrollmentResponse,
  type PaymentGatewayDetails,
  type PaymentOption,
  type PaymentPlan,
} from "../../-services/enrollment-api";

export interface PaymentDialogState {
  enrollmentData: EnrollmentResponse | null;
  paymentGatewayData: PaymentGatewayDetails | null;
  loading: boolean;
  error: string | null;
  selectedPaymentOption: PaymentOption | null;
  selectedPaymentPlan: PaymentPlan | null;
}

export interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue?: () => void;
  onSkip?: () => void;
  packageSessionId: string;
  instituteId: string;
  token: string;
  inviteCode?: string;
}

/**
 * Custom hook for managing payment dialog state and data fetching
 */
export const usePaymentDialog = (props: {
  open: boolean;
  packageSessionId: string;
  instituteId: string;
  token: string;
  inviteCode?: string;
}) => {
  const { open, packageSessionId, instituteId, token, inviteCode = "default" } = props;
  
  const [state, setState] = useState<PaymentDialogState>({
    enrollmentData: null,
    paymentGatewayData: null,
    loading: false,
    error: null,
    selectedPaymentOption: null,
    selectedPaymentPlan: null,
  });

  const fetchPaymentGatewayAndEnrollmentData = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Step 1: Fetch payment gateway details first
      const gatewayData = await fetchPaymentGatewayDetails(instituteId, 'STRIPE', token);

      // Step 2: Fetch enrollment details
      const enrollmentData = await fetchEnrollmentDetails(inviteCode, instituteId, packageSessionId, token);
      
      // Validate enrollment data
      if (!enrollmentData || !enrollmentData.id) {
        throw new Error('Invalid enrollment data received from server');
      }
      
      // Auto-select first payment option and plan
      const paymentOptions = getPaymentOptions(enrollmentData);
      let selectedPaymentOption: PaymentOption | null = null;
      let selectedPaymentPlan: PaymentPlan | null = null;
      
      if (paymentOptions.length > 0) {
        selectedPaymentOption = paymentOptions[0];
        const plans = getPaymentPlans(selectedPaymentOption);
        if (plans.length > 0) {
          selectedPaymentPlan = plans[0];
        }
      }

      // Validate that we have the required payment configuration
      if (!selectedPaymentOption || !selectedPaymentPlan) {
        throw new Error('No payment options available for this enrollment');
      }

      setState(prev => ({
        ...prev,
        enrollmentData,
        paymentGatewayData: gatewayData,
        selectedPaymentOption,
        selectedPaymentPlan,
        loading: false,
      }));
    } catch (err) {
      // Provide more specific error messages
      let errorMessage = "Failed to load payment options. Please try again.";
      
      if (err instanceof Error) {
        if (err.message.includes('Invalid enrollment data')) {
          errorMessage = "Invalid enrollment data received. Please refresh the page and try again.";
        } else if (err.message.includes('No payment options available')) {
          errorMessage = "No payment options available for this enrollment. Please contact support.";
        } else if (err.message.includes('Payment gateway configuration is missing')) {
          errorMessage = "Payment gateway configuration error. Please contact support.";
        } else if (err.message.includes('401') || err.message.includes('Unauthorized')) {
          errorMessage = "Authentication error. Please log in again and try again.";
        } else if (err.message.includes('403') || err.message.includes('forbidden')) {
          errorMessage = "Access denied. Please check your permissions and try again.";
        } else if (err.message.includes('510') || err.message.includes('Payment Gateway Error')) {
          errorMessage = "Payment gateway configuration error. Please contact support.";
        } else if (err.message.includes('511') || err.message.includes('Network authentication required')) {
          errorMessage = "Authentication required. Please log in again and try again.";
        } else {
          errorMessage = err.message;
        }
      }
      
      setState(prev => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));
    }
  };

  // Fetch data when dialog opens
  useEffect(() => {
    if (open && packageSessionId && instituteId) {
      fetchPaymentGatewayAndEnrollmentData();
    }
  }, [open, packageSessionId, instituteId]);

  const handlePayment = async (params: {
    email: string;
    amount: number;
    currency: string;
    description: string;
    paymentType: 'donation' | 'subscription' | 'one-time' | 'free';
    paymentMethod: any; // Stripe payment method object
    token: string;
    userData?: {
      email: string;
      username: string;
      full_name: string;
      mobile_number: string;
      date_of_birth: string;
      gender: string;
      address_line: string;
      city: string;
      region: string;
      pin_code: string;
      profile_pic_file_id: string;
      country: string;
    };
  }) => {
    const { email, amount, currency, description, paymentType, paymentMethod } = params;
    
    if (!state.enrollmentData || !state.paymentGatewayData || !state.selectedPaymentPlan || !state.selectedPaymentOption) {
      throw new Error('Payment configuration is incomplete. Please try again.');
    }

    // Note: Token refresh is now handled automatically by authenticatedAxiosInstance
    // No need to manually check or refresh tokens

    return await handlePaymentForEnrollment({
      email,
      instituteId,
      packageSessionId,
      enrollmentData: state.enrollmentData,
      paymentGatewayData: state.paymentGatewayData,
      selectedPaymentPlan: state.selectedPaymentPlan,
      selectedPaymentOption: state.selectedPaymentOption,
      amount,
      currency,
      description,
      paymentType,
      paymentMethod,
      token: params.token, // Use the token from params since we're not modifying it anymore
      userData: params.userData, // Pass user data if provided
    });
  };

  const retryFetch = () => {
    fetchPaymentGatewayAndEnrollmentData();
  };

  return {
    ...state,
    handlePayment,
    retryFetch,
  };
};

/**
 * Helper function to get currency with priority: payment plan > metadata > main response
 */
export const getCurrencyWithPriority = (
  selectedPaymentPlan: PaymentPlan | null,
  selectedPaymentOption: PaymentOption | null,
  enrollmentData: EnrollmentResponse | null
): string => {
  // Priority 1: Payment plan currency
  if (selectedPaymentPlan?.currency) {
    return selectedPaymentPlan.currency;
  }
  
  // Priority 2: Metadata currency
  try {
    if (selectedPaymentOption?.payment_option_metadata_json) {
      const metadata = JSON.parse(selectedPaymentOption.payment_option_metadata_json);
      if (metadata.currency) {
        return metadata.currency;
      }
    }
  } catch (error) {
    console.error("Error parsing metadata currency:", error);
  }
  
  // Priority 3: Main response currency
  return enrollmentData?.currency || 'USD';
};

/**
 * Helper function to parse payment option metadata
 */
export const parsePaymentOptionMetadata = (paymentOption: PaymentOption | null) => {
  if (!paymentOption?.payment_option_metadata_json) {
    return null;
  }

  try {
    return JSON.parse(paymentOption.payment_option_metadata_json);
  } catch (error) {
    return null;
  }
}; 