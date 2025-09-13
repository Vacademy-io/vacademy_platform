import React, { useState, useEffect, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import { Loader2, Clock, CheckCircle } from "lucide-react";
import { MyButton } from "@/components/design-system/button";
import { fetchUserPlanStatus } from "@/services/payment-status-api";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";

interface ApprovalStatusPollingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageSessionId: string;
  courseTitle: string;
  onApprovalSuccess?: () => void;
  onClose?: () => void;
  backgroundMode?: boolean; // If true, runs in background without showing UI
}

type LearnerStatus = 'PENDING_FOR_APPROVAL' | 'ACTIVE' | 'UNKNOWN';

interface ApprovalStatusResponse {
  user_plan_status: string;
  learner_status: string;
  approval_required?: boolean;
}

export const ApprovalStatusPollingDialog: React.FC<ApprovalStatusPollingDialogProps> = ({
  open,
  onOpenChange,
  packageSessionId,
  courseTitle,
  onApprovalSuccess,
  onClose,
  backgroundMode = false,
}) => {
  const [learnerStatus, setLearnerStatus] = useState<LearnerStatus>('PENDING_FOR_APPROVAL');
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Get access token on mount
  useEffect(() => {
    const getToken = async () => {
      try {
        const token = await getTokenFromStorage(TokenKey.accessToken);
        setAccessToken(token);
      } catch (error) {
        console.error('Error getting access token:', error);
        setError('Failed to authenticate. Please try again.');
      }
    };

    if (open) {
      getToken();
    }
  }, [open]);

  // Parse learner status
  const parseLearnerStatus = (status: string): LearnerStatus => {
    const normalizedStatus = status?.toUpperCase()?.trim();
    switch (normalizedStatus) {
      case 'PENDING_FOR_APPROVAL':
      case 'PENDING_APPROVAL':
        return 'PENDING_FOR_APPROVAL';
      case 'ACTIVE':
        return 'ACTIVE';
      default:
        console.warn('ApprovalStatusPollingDialog - Unknown learner status:', {
          originalStatus: status,
          normalizedStatus,
          packageSessionId
        });
        return 'UNKNOWN';
    }
  };

  // Polling function
  const checkApprovalStatus = useCallback(async () => {
    if (!packageSessionId || !accessToken) {
      console.log('ApprovalStatusPollingDialog - Skipping status check: missing packageSessionId or accessToken', {
        packageSessionId: !!packageSessionId,
        accessToken: !!accessToken
      });
      return;
    }

    console.log('ApprovalStatusPollingDialog - Checking approval status', {
      packageSessionId,
      currentStatus: learnerStatus,
      isPolling
    });

    try {
      const response: ApprovalStatusResponse = await fetchUserPlanStatus(packageSessionId, accessToken);
      const newLearnerStatus = parseLearnerStatus(response.learner_status);
      
      console.log('ApprovalStatusPollingDialog - Approval status response', {
        rawResponse: response,
        parsedLearnerStatus: newLearnerStatus,
        previousStatus: learnerStatus
      });
      
      setLearnerStatus(newLearnerStatus);
      setError(null);

      // Stop polling if status is no longer pending approval
      if (newLearnerStatus !== 'PENDING_FOR_APPROVAL') {
        console.log('ApprovalStatusPollingDialog - Approval status changed, stopping polling', {
          newLearnerStatus,
          previousStatus: learnerStatus
        });
        setIsPolling(false);
        
        if (newLearnerStatus === 'ACTIVE') {
          console.log('ApprovalStatusPollingDialog - Approval successful, calling onApprovalSuccess');
          onApprovalSuccess?.();
        }
      } else {
        console.log('ApprovalStatusPollingDialog - Approval still pending, continuing to poll');
      }
    } catch (err) {
      console.error('ApprovalStatusPollingDialog - Error checking approval status:', err);
      setError('Failed to check approval status. Please try again.');
      setIsPolling(false);
    }
  }, [packageSessionId, accessToken, onApprovalSuccess, learnerStatus, isPolling]);

  // Start polling when dialog opens
  useEffect(() => {
    if (open && accessToken) {
      console.log('ApprovalStatusPollingDialog - Starting approval status polling', {
        packageSessionId,
        courseTitle,
        accessToken: !!accessToken
      });
      
      setIsPolling(true);
      setLearnerStatus('PENDING_FOR_APPROVAL');
      setError(null);
      
      // Initial check
      checkApprovalStatus();
      
      // Set up polling interval (every 10 seconds for approval status)
      const intervalId = setInterval(checkApprovalStatus, 10000);
      console.log('ApprovalStatusPollingDialog - Polling interval set up', { intervalId });
      
      return () => {
        console.log('ApprovalStatusPollingDialog - Cleaning up polling interval', { intervalId });
        clearInterval(intervalId);
        setIsPolling(false);
      };
    }
  }, [open, accessToken, checkApprovalStatus, packageSessionId, courseTitle]);

  // Handle dialog close
  const handleClose = () => {
    console.log('ApprovalStatusPollingDialog - Dialog closing', {
      packageSessionId,
      currentStatus: learnerStatus,
      isPolling
    });
    setIsPolling(false);
    onOpenChange(false);
    onClose?.();
  };

  // If in background mode, don't render UI
  if (backgroundMode) {
    return null;
  }

  // Render content based on status
  const renderContent = () => {
    if (error) {
      return (
        <div className="text-center py-8">
          {/* Error Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center shadow-lg">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-gray-900">
              Error Checking Approval Status
            </h3>
            <p className="text-gray-600 text-lg">
              We encountered an issue while checking your approval status.
            </p>
          </div>

          {/* Error Details */}
          <div className="mt-8 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <XCircle className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-sm font-semibold text-red-900 mb-2">
                  Error Details
                </h4>
                <p className="text-sm text-red-800 mb-3">
                  {error}
                </p>
                <p className="text-sm text-red-700">
                  Please try again or contact support if the issue persists.
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-8">
            <MyButton
              buttonType="primary"
              scale="large"
              onClick={checkApprovalStatus}
              className="w-full h-12 text-base font-semibold"
            >
              Try Again
            </MyButton>
          </div>
        </div>
      );
    }

    if (learnerStatus === 'PENDING_FOR_APPROVAL') {
      return (
        <div className="text-center py-8">
          {/* Animated Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-100 to-orange-200 rounded-full flex items-center justify-center shadow-lg">
                <Clock className="w-10 h-10 text-yellow-600" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                <Loader2 className="w-3 h-3 text-white animate-spin" />
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-gray-900">
              Waiting for Admin Approval
            </h3>
            <p className="text-gray-600 text-lg">
              Your payment was successful and your enrollment request is being reviewed by an administrator.
            </p>
          </div>

          {/* Status Card */}
          <div className="mt-8 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                  <Clock className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-sm font-semibold text-yellow-900 mb-2">
                  What happens next?
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-yellow-700">
                    <div className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></div>
                    <span>Administrator will review your enrollment request</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-yellow-700">
                    <div className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></div>
                    <span>You will be automatically enrolled once approved</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-yellow-700">
                    <div className="w-1.5 h-1.5 bg-yellow-600 rounded-full"></div>
                    <span>Course access will be granted immediately</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="mt-6">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span>Checking for approval updates...</span>
            </div>
          </div>
        </div>
      );
    }

    if (learnerStatus === 'ACTIVE') {
      return (
        <div className="text-center py-8">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center shadow-lg">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-gray-900">
              Approval Successful!
            </h3>
            <p className="text-gray-600 text-lg">
              Your enrollment has been approved and you now have access to the course.
            </p>
          </div>
          
          <div className="mt-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-sm font-semibold text-green-900 mb-1">
                  Ready to Learn!
                </h4>
                <p className="text-sm text-green-800">
                  You can now access the course content and start learning.
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-8">
            <MyButton
              buttonType="primary"
              scale="large"
              onClick={handleClose}
              className="w-full h-12 text-base font-semibold"
            >
              Start Learning
            </MyButton>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[9999] bg-black/60 animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[9999] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl focus:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Approval Status</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Checking approval status for your enrollment
          </DialogPrimitive.Description>
          
          <button
            className="absolute right-2 top-2 text-gray-400 hover:text-gray-700 focus:outline-none"
            onClick={handleClose}
            aria-label="Close"
          >
            <Cross2Icon className="h-4 w-4" />
          </button>
          
          {renderContent()}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
