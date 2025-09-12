import React, { useState } from 'react';
import { PaymentStatusPollingDialog } from '@/routes/study-library/courses/course-details/-components/payment-dialogs/PaymentStatusPollingDialog';
import { PaymentSuccessDialog } from '@/routes/study-library/courses/course-details/-components/payment-dialogs/PaymentSuccessDialog';
import { PaymentFailedDialog } from '@/routes/study-library/courses/course-details/-components/payment-dialogs/PaymentFailedDialog';
import { EnrollmentPendingApprovalDialog } from '@/routes/study-library/courses/course-details/-components/payment-dialogs/EnrollmentPendingApprovalDialog';
import { MyButton } from '@/components/design-system/button';

interface DialogState {
  showPollingPending: boolean;
  showPollingPaid: boolean;
  showPollingFailed: boolean;
  showPollingError: boolean;
  showSuccessNoApproval: boolean;
  showSuccessWithApproval: boolean;
  showFailed: boolean;
  showPendingApproval: boolean;
}

export const PaymentDialogUITest: React.FC = () => {
  const [dialogs, setDialogs] = useState<DialogState>({
    showPollingPending: false,
    showPollingPaid: false,
    showPollingFailed: false,
    showPollingError: false,
    showSuccessNoApproval: false,
    showSuccessWithApproval: false,
    showFailed: false,
    showPendingApproval: false,
  });

  const openDialog = (dialogName: keyof DialogState) => {
    setDialogs(prev => ({ ...prev, [dialogName]: true }));
  };

  const closeDialog = (dialogName: keyof DialogState) => {
    setDialogs(prev => ({ ...prev, [dialogName]: false }));
  };

  const closeAllDialogs = () => {
    setDialogs({
      showPollingPending: false,
      showPollingPaid: false,
      showPollingFailed: false,
      showPollingError: false,
      showSuccessNoApproval: false,
      showSuccessWithApproval: false,
      showFailed: false,
      showPendingApproval: false,
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Payment Dialog UI Test Suite
          </h1>
          <p className="text-gray-600 mb-6">
            Click any button below to test different payment dialog states. 
            This allows you to see all UI variations without any conditions.
          </p>
          
          <div className="flex flex-wrap gap-4 mb-6">
            <MyButton
              buttonType="primary"
              scale="medium"
              onClick={() => openDialog('showPollingPending')}
            >
              Test Payment Pending (Polling)
            </MyButton>
            
            <MyButton
              buttonType="primary"
              scale="medium"
              onClick={() => openDialog('showPollingPaid')}
            >
              Test Payment Paid (Polling)
            </MyButton>
            
            <MyButton
              buttonType="primary"
              scale="medium"
              onClick={() => openDialog('showPollingFailed')}
            >
              Test Payment Failed (Polling)
            </MyButton>
            
            <MyButton
              buttonType="primary"
              scale="medium"
              onClick={() => openDialog('showPollingError')}
            >
              Test Polling Error
            </MyButton>
            
            <MyButton
              buttonType="primary"
              scale="medium"
              onClick={() => openDialog('showSuccessNoApproval')}
            >
              Test Success (No Approval)
            </MyButton>
            
            <MyButton
              buttonType="primary"
              scale="medium"
              onClick={() => openDialog('showSuccessWithApproval')}
            >
              Test Success (With Approval)
            </MyButton>
            
            <MyButton
              buttonType="primary"
              scale="medium"
              onClick={() => openDialog('showFailed')}
            >
              Test Payment Failed
            </MyButton>
            
            <MyButton
              buttonType="primary"
              scale="medium"
              onClick={() => openDialog('showPendingApproval')}
            >
              Test Pending Approval
            </MyButton>
          </div>
          
          <MyButton
            buttonType="secondary"
            scale="medium"
            onClick={closeAllDialogs}
          >
            Close All Dialogs
          </MyButton>
        </div>

        {/* Dialog Test Results */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Dialog Test Results
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(dialogs).map(([key, isOpen]) => (
              <div
                key={key}
                className={`p-4 rounded-lg border-2 ${
                  isOpen 
                    ? 'border-green-500 bg-green-50 text-green-800' 
                    : 'border-gray-200 bg-gray-50 text-gray-600'
                }`}
              >
                <div className="font-semibold mb-1">
                  {key.replace('show', '').replace(/([A-Z])/g, ' $1').trim()}
                </div>
                <div className="text-sm">
                  {isOpen ? '✅ Open' : '❌ Closed'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Status Polling Dialog - PENDING */}
      <PaymentStatusPollingDialog
        open={dialogs.showPollingPending}
        onOpenChange={(open) => {
          if (!open) closeDialog('showPollingPending');
        }}
        packageSessionId="test-package-id"
        courseTitle="Test Course for UI Testing"
        onPaymentSuccess={() => {
          console.log('Payment success callback triggered');
          closeDialog('showPollingPending');
        }}
        onPaymentFailed={() => {
          console.log('Payment failed callback triggered');
          closeDialog('showPollingPending');
        }}
      />

      {/* Payment Status Polling Dialog - PAID */}
      <PaymentStatusPollingDialog
        open={dialogs.showPollingPaid}
        onOpenChange={(open) => {
          if (!open) closeDialog('showPollingPaid');
        }}
        packageSessionId="test-package-id"
        courseTitle="Test Course for UI Testing"
        onPaymentSuccess={() => {
          console.log('Payment success callback triggered');
          closeDialog('showPollingPaid');
        }}
        onPaymentFailed={() => {
          console.log('Payment failed callback triggered');
          closeDialog('showPollingPaid');
        }}
      />

      {/* Payment Status Polling Dialog - FAILED */}
      <PaymentStatusPollingDialog
        open={dialogs.showPollingFailed}
        onOpenChange={(open) => {
          if (!open) closeDialog('showPollingFailed');
        }}
        packageSessionId="test-package-id"
        courseTitle="Test Course for UI Testing"
        onPaymentSuccess={() => {
          console.log('Payment success callback triggered');
          closeDialog('showPollingFailed');
        }}
        onPaymentFailed={() => {
          console.log('Payment failed callback triggered');
          closeDialog('showPollingFailed');
        }}
      />

      {/* Payment Status Polling Dialog - ERROR */}
      <PaymentStatusPollingDialog
        open={dialogs.showPollingError}
        onOpenChange={(open) => {
          if (!open) closeDialog('showPollingError');
        }}
        packageSessionId="test-package-id"
        courseTitle="Test Course for UI Testing"
        onPaymentSuccess={() => {
          console.log('Payment success callback triggered');
          closeDialog('showPollingError');
        }}
        onPaymentFailed={() => {
          console.log('Payment failed callback triggered');
          closeDialog('showPollingError');
        }}
      />

      {/* Payment Success Dialog - No Approval */}
      <PaymentSuccessDialog
        open={dialogs.showSuccessNoApproval}
        onOpenChange={(open) => {
          if (!open) closeDialog('showSuccessNoApproval');
        }}
        courseTitle="Test Course for UI Testing"
        approvalRequired={false}
        onExploreCourse={() => {
          console.log('Explore course callback triggered');
          closeDialog('showSuccessNoApproval');
        }}
      />

      {/* Payment Success Dialog - With Approval */}
      <PaymentSuccessDialog
        open={dialogs.showSuccessWithApproval}
        onOpenChange={(open) => {
          if (!open) closeDialog('showSuccessWithApproval');
        }}
        courseTitle="Test Course for UI Testing"
        approvalRequired={true}
        onExploreCourse={() => {
          console.log('Explore course callback triggered');
          closeDialog('showSuccessWithApproval');
        }}
      />

      {/* Payment Failed Dialog */}
      <PaymentFailedDialog
        open={dialogs.showFailed}
        onOpenChange={(open) => {
          if (!open) closeDialog('showFailed');
        }}
        courseTitle="Test Course for UI Testing"
        onTryAgain={() => {
          console.log('Try again callback triggered');
          closeDialog('showFailed');
        }}
      />

      {/* Enrollment Pending Approval Dialog */}
      <EnrollmentPendingApprovalDialog
        open={dialogs.showPendingApproval}
        onOpenChange={(open) => {
          if (!open) closeDialog('showPendingApproval');
        }}
        courseTitle="Test Course for UI Testing"
      />
    </div>
  );
};
