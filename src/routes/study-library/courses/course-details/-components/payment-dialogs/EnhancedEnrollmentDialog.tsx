import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { usePaymentStatusDialog } from "@/hooks/use-payment-status";
import { OneTimePaymentDialog } from "./OneTimePaymentDialog";
import { SubscriptionPaymentDialog } from "./SubscriptionPaymentDialog";
import { PaymentStatusPollingDialog } from "./PaymentStatusPollingDialog";
import { PaymentSuccessDialog } from "./PaymentSuccessDialog";
import { PaymentFailedDialog } from "./PaymentFailedDialog";
import { EnrollmentPendingApprovalDialog } from "./EnrollmentPendingApprovalDialog";
import { ApprovalStatusPollingDialog } from "./ApprovalStatusPollingDialog";

interface EnhancedEnrollmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageSessionId: string;
  instituteId: string;
  token: string;
  courseTitle?: string;
  inviteCode?: string;
  paymentType: 'one_time' | 'subscription' | 'donation' | 'free';
  onEnrollmentSuccess?: () => void;
  onNavigateToSlides?: () => void;
}

export const EnhancedEnrollmentDialog: React.FC<EnhancedEnrollmentDialogProps> = ({
  open,
  onOpenChange,
  packageSessionId,
  instituteId,
  token,
  courseTitle = "Course",
  inviteCode = "default",
  paymentType,
  onEnrollmentSuccess,
  onNavigateToSlides,
}) => {
  const [showPaymentStatusDialog, setShowPaymentStatusDialog] = useState(false);
  const [showPaymentSuccessDialog, setShowPaymentSuccessDialog] = useState(false);
  const [showPaymentFailedDialog, setShowPaymentFailedDialog] = useState(false);
  const [showPendingApprovalDialog, setShowPendingApprovalDialog] = useState(false);
  const [showApprovalStatusDialog, setShowApprovalStatusDialog] = useState(false);
  const [approvalRequired, setApprovalRequired] = useState(false);

  // Use payment status hook to check existing enrollment status
  const {
    dialogType,
    user_plan_status,
    learner_status,
    is_loading,
    error,
    refetch,
  } = usePaymentStatusDialog(packageSessionId);

  // Debug logging
  useEffect(() => {
    if (open) {
      console.log('EnhancedEnrollmentDialog - Status check:', {
        packageSessionId,
        dialogType,
        user_plan_status,
        learner_status,
        is_loading,
        error: error?.message,
        paymentType,
        timestamp: new Date().toISOString()
      });
    }
  }, [open, packageSessionId, dialogType, user_plan_status, learner_status, is_loading, error, paymentType]);

  // Handle payment status success
  const handlePaymentSuccess = (approvalRequired: boolean) => {
    console.log('EnhancedEnrollmentDialog - Payment success received', {
      packageSessionId,
      courseTitle,
      approvalRequired,
      paymentType
    });
    setShowPaymentStatusDialog(false);
    setApprovalRequired(approvalRequired);
    
    // Always show success dialog (for both approval required and not required cases)
    setShowPaymentSuccessDialog(true);
    
    // If approval required, start background polling
    if (approvalRequired) {
      setShowApprovalStatusDialog(true);
    }
  };

  // Handle payment status failure
  const handlePaymentFailed = () => {
    console.log('EnhancedEnrollmentDialog - Payment failed received', {
      packageSessionId,
      courseTitle,
      paymentType
    });
    setShowPaymentStatusDialog(false);
    setShowPaymentFailedDialog(true);
  };

  // Handle payment status dialog close
  const handlePaymentStatusClose = () => {
    console.log('EnhancedEnrollmentDialog - Payment status dialog closed', {
      packageSessionId,
      courseTitle,
      paymentType
    });
    setShowPaymentStatusDialog(false);
  };

  // Handle payment success dialog close
  const handlePaymentSuccessClose = () => {
    console.log('EnhancedEnrollmentDialog - Payment success dialog closed', {
      packageSessionId,
      courseTitle,
      approvalRequired,
      paymentType
    });
    setShowPaymentSuccessDialog(false);
    if (!approvalRequired && onEnrollmentSuccess) {
      console.log('EnhancedEnrollmentDialog - Calling onEnrollmentSuccess (no approval required)');
      onEnrollmentSuccess();
    }
  };

  // Handle payment failed dialog close
  const handlePaymentFailedClose = () => {
    console.log('EnhancedEnrollmentDialog - Payment failed dialog closed', {
      packageSessionId,
      courseTitle,
      paymentType
    });
    setShowPaymentFailedDialog(false);
  };

  // Handle try again
  const handleTryAgain = () => {
    console.log('EnhancedEnrollmentDialog - Try again clicked', {
      packageSessionId,
      courseTitle,
      paymentType
    });
    setShowPaymentFailedDialog(false);
    // Reopen the main enrollment dialog
    onOpenChange(true);
  };

  // Handle explore course
  const handleExploreCourse = async () => {
    console.log('EnhancedEnrollmentDialog - Explore course clicked', {
      packageSessionId,
      courseTitle,
      paymentType
    });
    if (onNavigateToSlides) {
      await onNavigateToSlides();
    }
  };

  // Handle approval success
  const handleApprovalSuccess = async () => {
    console.log('EnhancedEnrollmentDialog - Approval success received', {
      packageSessionId,
      courseTitle,
      paymentType
    });
    setShowApprovalStatusDialog(false);
    setShowPaymentSuccessDialog(false); // Close the success dialog
    
    // Enroll user immediately when approved
    if (onEnrollmentSuccess) {
      await onEnrollmentSuccess();
    }
  };

  // Handle approval status dialog close
  const handleApprovalStatusClose = () => {
    console.log('EnhancedEnrollmentDialog - Approval status dialog closed', {
      packageSessionId,
      courseTitle,
      paymentType
    });
    setShowApprovalStatusDialog(false);
  };

  // Show loading state
  if (is_loading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/60 animate-fade-in flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 max-w-sm">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-600" />
            <p className="text-gray-600">Checking enrollment status...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state (but not for 510 errors which are handled as no enrollment request)
  if (error) {
    const errorMessage = error.message || '';
    const isNoEnrollmentError = errorMessage.includes('510') || errorMessage.includes('Student has not submitted the request to enroll');
    
    if (isNoEnrollmentError) {
      console.log('EnhancedEnrollmentDialog - 510 error detected, proceeding with enrollment flow', {
        packageSessionId,
        courseTitle,
        paymentType,
        error: errorMessage
      });
      // Don't show error dialog, continue to enrollment flow below
    } else {
      return (
        <div className="fixed inset-0 z-[9999] bg-black/60 animate-fade-in flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <div className="text-center">
              <p className="text-red-600 mb-4">{error.message}</p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // Case 2: User is not enrolled but has already made request for enrollment
  if (user_plan_status === 'PAYMENT_PENDING') {
    console.log('EnhancedEnrollmentDialog - Case 2: Payment pending, showing polling dialog', {
      packageSessionId,
      courseTitle,
      paymentType,
      user_plan_status,
      learner_status
    });
    return (
      <PaymentStatusPollingDialog
        open={open}
        onOpenChange={onOpenChange}
        packageSessionId={packageSessionId}
        courseTitle={courseTitle}
        onPaymentSuccess={handlePaymentSuccess}
        onPaymentFailed={handlePaymentFailed}
        onClose={handlePaymentStatusClose}
      />
    );
  }

  // Case 2: User has paid but pending approval
  if (user_plan_status === 'PAID' && learner_status === 'PENDING_FOR_APPROVAL') {
    console.log('EnhancedEnrollmentDialog - Case 2: Payment successful, pending approval', {
      packageSessionId,
      courseTitle,
      paymentType,
      user_plan_status,
      learner_status
    });
    return (
      <EnrollmentPendingApprovalDialog
        open={open}
        onOpenChange={onOpenChange}
        courseTitle={courseTitle}
        onClose={() => onOpenChange(false)}
      />
    );
  }

  // Case 2: User is already active/enrolled
  if (learner_status === 'ACTIVE') {
    console.log('EnhancedEnrollmentDialog - Case 2: Already enrolled', {
      packageSessionId,
      courseTitle,
      paymentType,
      user_plan_status,
      learner_status
    });
    return (
      <div className="fixed inset-0 z-[9999] bg-black/60 animate-fade-in flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 max-w-sm">
          <div className="text-center">
            <p className="text-gray-600 mb-4">You are already enrolled in this course.</p>
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case 1: User is not enrolled and has not made any request for enrollment
  // Show the appropriate payment dialog based on payment type
  if (paymentType === 'one_time' || paymentType === 'one_time_payment') {
    console.log('EnhancedEnrollmentDialog - Case 1: New enrollment, showing OneTimePaymentDialog', {
      packageSessionId,
      courseTitle,
      paymentType,
      user_plan_status,
      learner_status
    });
    return (
      <>
        <OneTimePaymentDialog
          open={open}
          onOpenChange={onOpenChange}
          packageSessionId={packageSessionId}
          instituteId={instituteId}
          token={token}
          courseTitle={courseTitle}
          inviteCode={inviteCode}
          onEnrollmentSuccess={onEnrollmentSuccess}
        />
        
        {/* Payment Status Polling Dialog */}
        <PaymentStatusPollingDialog
          open={showPaymentStatusDialog}
          onOpenChange={setShowPaymentStatusDialog}
          packageSessionId={packageSessionId}
          courseTitle={courseTitle}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentFailed={handlePaymentFailed}
          onClose={handlePaymentStatusClose}
        />

        {/* Payment Success Dialog */}
        <PaymentSuccessDialog
          open={showPaymentSuccessDialog}
          onOpenChange={setShowPaymentSuccessDialog}
          courseTitle={courseTitle}
          approvalRequired={approvalRequired}
          onExploreCourse={handleExploreCourse}
          onClose={handlePaymentSuccessClose}
        />

        {/* Payment Failed Dialog */}
        <PaymentFailedDialog
          open={showPaymentFailedDialog}
          onOpenChange={setShowPaymentFailedDialog}
          courseTitle={courseTitle}
          onTryAgain={handleTryAgain}
          onClose={handlePaymentFailedClose}
        />

        {/* Approval Status Polling Dialog (Background Mode) */}
        <ApprovalStatusPollingDialog
          open={showApprovalStatusDialog}
          onOpenChange={setShowApprovalStatusDialog}
          packageSessionId={packageSessionId}
          courseTitle={courseTitle}
          onApprovalSuccess={handleApprovalSuccess}
          onClose={handleApprovalStatusClose}
          backgroundMode={true}
        />
      </>
    );
  }

  if (paymentType === 'subscription') {
    console.log('EnhancedEnrollmentDialog - Case 1: New enrollment, showing SubscriptionPaymentDialog', {
      packageSessionId,
      courseTitle,
      paymentType,
      user_plan_status,
      learner_status
    });
    return (
      <>
        <SubscriptionPaymentDialog
          open={open}
          onOpenChange={onOpenChange}
          packageSessionId={packageSessionId}
          instituteId={instituteId}
          token={token}
          courseTitle={courseTitle}
          inviteCode={inviteCode}
          onEnrollmentSuccess={onEnrollmentSuccess}
        />
        
        {/* Payment Status Polling Dialog */}
        <PaymentStatusPollingDialog
          open={showPaymentStatusDialog}
          onOpenChange={setShowPaymentStatusDialog}
          packageSessionId={packageSessionId}
          courseTitle={courseTitle}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentFailed={handlePaymentFailed}
          onClose={handlePaymentStatusClose}
        />

        {/* Payment Success Dialog */}
        <PaymentSuccessDialog
          open={showPaymentSuccessDialog}
          onOpenChange={setShowPaymentSuccessDialog}
          courseTitle={courseTitle}
          approvalRequired={approvalRequired}
          onExploreCourse={handleExploreCourse}
          onClose={handlePaymentSuccessClose}
        />

        {/* Payment Failed Dialog */}
        <PaymentFailedDialog
          open={showPaymentFailedDialog}
          onOpenChange={setShowPaymentFailedDialog}
          courseTitle={courseTitle}
          onTryAgain={handleTryAgain}
          onClose={handlePaymentFailedClose}
        />

        {/* Approval Status Polling Dialog (Background Mode) */}
        <ApprovalStatusPollingDialog
          open={showApprovalStatusDialog}
          onOpenChange={setShowApprovalStatusDialog}
          packageSessionId={packageSessionId}
          courseTitle={courseTitle}
          onApprovalSuccess={handleApprovalSuccess}
          onClose={handleApprovalStatusClose}
          backgroundMode={true}
        />
      </>
    );
  }

  // For other payment types (donation, free), use the existing flow
  // This would need to be implemented based on the existing donation and free enrollment dialogs
  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 animate-fade-in flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-sm">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Payment type {paymentType} not yet supported in enhanced flow.</p>
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
