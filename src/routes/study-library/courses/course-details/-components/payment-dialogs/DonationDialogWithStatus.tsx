import React, { useState, useRef } from "react";
import { DonationDialog } from "./DonationDialog";
import { 
  PaymentFlowManager, 
  type PaymentFlowManagerRef 
} from "./PaymentFlowManager";
import type { PaymentDialogProps } from "./payment-utils";

/**
 * Enhanced DonationDialog with Payment Status Flow
 * This component demonstrates how to integrate the new payment status dialogs
 * with the existing DonationDialog component.
 */
export const DonationDialogWithStatus: React.FC<PaymentDialogProps & {
  courseName?: string;
  onExploreCourse?: () => void;
}> = (props) => {
  const [showDonationDialog, setShowDonationDialog] = useState(props.open);
  const paymentFlowRef = useRef<PaymentFlowManagerRef>(null);

  // Handle when donation is successful
  const handleDonationSuccess = () => {
    // Close the donation dialog
    setShowDonationDialog(false);
    
    // Here you would normally get the payment response from the donation dialog
    // For demonstration, we'll simulate a response
    const mockPaymentResponse = {
      id: "txn_" + Date.now(),
      amount: 50, // This would come from the actual payment
      currency: "USD",
      status: "success", // Could be "pending", "success", or "failed"
      course_name: props.courseName,
    };

    // Get the selected payment option (would come from the donation dialog state)
    const mockPaymentOption = {
      id: "mock-option-id",
      name: "Donation Option",
      status: "ACTIVE",
      source: "MANUAL",
      source_id: "donation",
      tag: "donation",
      type: "DONATION",
      require_approval: false, // This determines if approval is needed
      payment_plans: [],
      payment_option_metadata_json: "{}",
    };

    // Trigger the payment status flow
    paymentFlowRef.current?.handlePaymentSuccess(mockPaymentResponse, mockPaymentOption);
  };

  // Handle when main dialog open state changes
  const handleOpenChange = (open: boolean) => {
    setShowDonationDialog(open);
    props.onOpenChange(open);
  };

  return (
    <>
      {/* Original Donation Dialog */}
      <DonationDialog
        {...props}
        open={showDonationDialog}
        onOpenChange={handleOpenChange}
        onContinue={handleDonationSuccess} // Called when payment is successful
      />

      {/* Payment Status Flow Manager */}
      <PaymentFlowManager
        ref={paymentFlowRef}
        courseName={props.courseName}
        onPaymentComplete={() => {
          console.log("Payment completed!");
        }}
        onExploreCourse={props.onExploreCourse}
      />
    </>
  );
};

// Usage example in comments:
/*
// How to use the enhanced donation dialog:

import { DonationDialogWithStatus } from './DonationDialogWithStatus';

function MyComponent() {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <DonationDialogWithStatus
      open={showDialog}
      onOpenChange={setShowDialog}
      packageSessionId="your-package-id"
      instituteId="your-institute-id"
      token="your-auth-token"
      courseName="Introduction to React"
      onExploreCourse={() => {
        // Navigate to course content
        console.log("Navigating to course...");
      }}
    />
  );
}
*/
