import React, { useState } from "react";
import { 
  PaymentPendingDialog, 
  PaymentConfirmationDialog,
  parsePaymentResponse,
  getPaymentDialogType,
  type PaymentResponse,
} from "./index";
import type { PaymentOption } from "../../-services/enrollment-api";

export interface PaymentFlowManagerProps {
  // Course details
  courseName?: string;
  
  // Callbacks
  onPaymentComplete?: () => void;
  onExploreCourse?: () => void;
}

export interface PaymentFlowManagerRef {
  handlePaymentSuccess: (response: unknown, selectedPaymentOption: PaymentOption | null) => void;
}

/**
 * PaymentFlowManager - Manages the flow between payment dialogs and post-payment status dialogs
 * This component demonstrates how to integrate the new payment status dialogs with existing payment flows
 */
export const PaymentFlowManager = React.forwardRef<PaymentFlowManagerRef, PaymentFlowManagerProps>(({
  courseName,
  onPaymentComplete,
  onExploreCourse,
}, ref) => {
  const [paymentResponse, setPaymentResponse] = useState<PaymentResponse | null>(null);
  const [showPaymentStatus, setShowPaymentStatus] = useState(false);

  /**
   * Handle successful payment completion
   * This function should be called when a payment dialog completes successfully
   */
  const handlePaymentSuccess = (response: unknown, selectedPaymentOption: PaymentOption | null) => {
    // Parse the payment response to determine status and approval requirement
    const parsedResponse = parsePaymentResponse(response, selectedPaymentOption);
    
    // Add course name if available
    if (courseName) {
      parsedResponse.courseName = courseName;
    }
    
    setPaymentResponse(parsedResponse);
    setShowPaymentStatus(true);
    
    // Notify parent component
    if (onPaymentComplete) {
      onPaymentComplete();
    }
  };

  // Expose the handlePaymentSuccess function via ref
  React.useImperativeHandle(ref, () => ({
    handlePaymentSuccess
  }));

  /**
   * Handle closing of payment status dialogs
   */
  const handleStatusDialogClose = () => {
    setShowPaymentStatus(false);
    setPaymentResponse(null);
  };

  /**
   * Handle explore course action
   */
  const handleExploreCourse = () => {
    handleStatusDialogClose();
    if (onExploreCourse) {
      onExploreCourse();
    }
  };

  // Determine which status dialog to show
  const dialogType = paymentResponse ? getPaymentDialogType(paymentResponse) : 'confirmation';

  return (
    <>
      {/* Payment Status Dialogs */}
      {showPaymentStatus && paymentResponse && (
        <>
          {/* Payment Pending Dialog */}
          <PaymentPendingDialog
            open={showPaymentStatus && dialogType === 'pending'}
            onOpenChange={handleStatusDialogClose}
            paymentData={{
              amount: paymentResponse.amount || 0,
              currency: paymentResponse.currency || 'USD',
              courseName: paymentResponse.courseName,
              planName: paymentResponse.planName,
              transactionId: paymentResponse.transactionId,
            }}
          />

          {/* Payment Confirmation Dialog */}
          <PaymentConfirmationDialog
            open={showPaymentStatus && dialogType === 'confirmation'}
            onOpenChange={handleStatusDialogClose}
            requireApproval={paymentResponse.requireApproval}
            paymentData={{
              amount: paymentResponse.amount || 0,
              currency: paymentResponse.currency || 'USD',
              courseName: paymentResponse.courseName,
              planName: paymentResponse.planName,
              transactionId: paymentResponse.transactionId,
            }}
            onExploreCourse={handleExploreCourse}
          />
        </>
      )}
    </>
  );
});
