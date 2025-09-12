import { useQuery } from '@tanstack/react-query';
import { handleGetUserPlanStatus, type UserPlanStatusResponse } from '@/services/payment-status-api';
import { getTokenFromStorage } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { useState, useEffect } from 'react';

// Payment status types for better type safety
export type UserPlanStatus = 'FAILED' | 'PAID' | 'PAYMENT_PENDING' | 'UNKNOWN';
export type LearnerStatus = 'INVITED' | 'PENDING_FOR_APPROVAL' | 'ACTIVE' | 'UNKNOWN';

// Enhanced response type with parsed statuses
export interface PaymentStatusData {
  user_plan_status: UserPlanStatus;
  learner_status: LearnerStatus;
  raw_response: UserPlanStatusResponse;
  is_loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Custom hook to manage payment status for a package session
 * @param packageSessionId - The package session ID to check status for
 * @returns PaymentStatusData object with status information and utilities
 */
export const usePaymentStatus = (packageSessionId: string | null): PaymentStatusData => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isTokenLoading, setIsTokenLoading] = useState(true);

  // Get access token on mount
  useEffect(() => {
    const getToken = async () => {
      console.log('usePaymentStatus - Getting access token', {
        packageSessionId,
        timestamp: new Date().toISOString()
      });
      
      try {
        const token = await getTokenFromStorage(TokenKey.accessToken);
        console.log('usePaymentStatus - Access token retrieved', {
          packageSessionId,
          hasToken: !!token,
          timestamp: new Date().toISOString()
        });
        setAccessToken(token);
      } catch (error) {
        console.error('usePaymentStatus - Error getting access token:', {
          packageSessionId,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
        setAccessToken(null);
      } finally {
        setIsTokenLoading(false);
      }
    };

    getToken();
  }, [packageSessionId]);

  // Parse status strings to typed enums
  const parseUserPlanStatus = (status: string): UserPlanStatus => {
    const normalizedStatus = status?.toUpperCase()?.trim();
    switch (normalizedStatus) {
      case 'FAILED':
        return 'FAILED';
      case 'PAID':
      case 'ACTIVE':
        return 'PAID';
      case 'PAYMENT_PENDING':
      case 'PENDING_FOR_PAYMENT':
        return 'PAYMENT_PENDING';
      default:
        console.warn('usePaymentStatus - Unknown user plan status:', {
          originalStatus: status,
          normalizedStatus,
          packageSessionId
        });
        return 'UNKNOWN';
    }
  };

  const parseLearnerStatus = (status: string): LearnerStatus => {
    const normalizedStatus = status?.toUpperCase()?.trim();
    switch (normalizedStatus) {
      case 'INVITED':
        return 'INVITED';
      case 'PENDING_FOR_APPROVAL':
      case 'PENDING_APPROVAL':
        return 'PENDING_FOR_APPROVAL';
      case 'ACTIVE':
        return 'ACTIVE';
      default:
        console.warn('usePaymentStatus - Unknown learner status:', {
          originalStatus: status,
          normalizedStatus,
          packageSessionId
        });
        return 'UNKNOWN';
    }
  };

  // React Query for fetching payment status
  const {
    data: rawData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    ...handleGetUserPlanStatus({
      packageSessionId: packageSessionId || '',
      accessToken: accessToken || '',
    }),
    enabled: !!packageSessionId && !!accessToken && !isTokenLoading,
    retry: (failureCount, error) => {
      // Don't retry for 510 status code (no enrollment request)
      if (error?.message?.includes('510')) {
        console.log('usePaymentStatus - Not retrying 510 error (no enrollment request)', {
          packageSessionId,
          error: error.message
        });
        return false;
      }
      return failureCount < 2;
    },
  });

  // Parse the response data
  const parsedData = rawData ? {
    user_plan_status: parseUserPlanStatus(rawData.user_plan_status),
    learner_status: parseLearnerStatus(rawData.learner_status),
    raw_response: rawData,
  } : null;

  // Log status changes
  useEffect(() => {
    if (parsedData) {
      console.log('usePaymentStatus - Status parsed', {
        packageSessionId,
        rawData,
        parsedData,
        timestamp: new Date().toISOString()
      });
    }
  }, [parsedData, packageSessionId]);

  return {
    user_plan_status: parsedData?.user_plan_status || 'UNKNOWN',
    learner_status: parsedData?.learner_status || 'UNKNOWN',
    raw_response: parsedData?.raw_response || {
      user_plan_status: '',
      learner_status: '',
    },
    is_loading: isLoading || isTokenLoading,
    error: error as Error | null,
    refetch,
  };
};

/**
 * Hook to determine which dialog should be shown based on payment status
 * @param packageSessionId - The package session ID
 * @returns Object with dialog type and additional status information
 */
export const usePaymentStatusDialog = (packageSessionId: string | null) => {
  const paymentStatus = usePaymentStatus(packageSessionId);

  // Determine which dialog to show based on status
  const getDialogType = (): 'enrollment' | 'payment_required' | 'pending_approval' | 'already_enrolled' | 'error' | 'loading' => {
    if (paymentStatus.is_loading) return 'loading';
    
    // Handle 510 error as "no enrollment request" - should show enrollment dialog
    if (paymentStatus.error) {
      const errorMessage = paymentStatus.error.message || '';
      if (errorMessage.includes('510') || errorMessage.includes('Student has not submitted the request to enroll')) {
        console.log('usePaymentStatusDialog - 510 error detected, treating as no enrollment request', {
          packageSessionId,
          error: errorMessage
        });
        return 'enrollment';
      }
      return 'error';
    }
    
    const { user_plan_status, learner_status } = paymentStatus;
    
    // User is already active/enrolled
    if (learner_status === 'ACTIVE') {
      console.log('usePaymentStatusDialog - Dialog type: already_enrolled', {
        user_plan_status,
        learner_status
      });
      return 'already_enrolled';
    }
    
    // User has pending approval
    if (learner_status === 'PENDING_FOR_APPROVAL') {
      console.log('usePaymentStatusDialog - Dialog type: pending_approval', {
        user_plan_status,
        learner_status
      });
      return 'pending_approval';
    }
    
    // User plan is paid but not active - show payment completion dialog
    if (user_plan_status === 'PAID' && learner_status === 'INVITED') {
      console.log('usePaymentStatusDialog - Dialog type: payment_required (PAID + INVITED)', {
        user_plan_status,
        learner_status
      });
      return 'payment_required';
    }
    
    // User plan is payment pending - show payment pending dialog
    if (user_plan_status === 'PAYMENT_PENDING') {
      console.log('usePaymentStatusDialog - Dialog type: payment_required (PAYMENT_PENDING)', {
        user_plan_status,
        learner_status
      });
      return 'payment_required';
    }
    
    // User plan failed or unknown - show enrollment dialog
    if (user_plan_status === 'FAILED' || user_plan_status === 'UNKNOWN') {
      console.log('usePaymentStatusDialog - Dialog type: enrollment (FAILED/UNKNOWN)', {
        user_plan_status,
        learner_status
      });
      return 'enrollment';
    }
    
    // Default to enrollment for other cases
    console.log('usePaymentStatusDialog - Dialog type: enrollment (default)', {
      user_plan_status,
      learner_status
    });
    return 'enrollment';
  };

  return {
    ...paymentStatus,
    dialogType: getDialogType(),
    shouldShowEnrollmentDialog: getDialogType() === 'enrollment',
    shouldShowPaymentDialog: getDialogType() === 'payment_required',
    shouldShowPendingDialog: getDialogType() === 'pending_approval',
    isAlreadyEnrolled: getDialogType() === 'already_enrolled',
  };
};
