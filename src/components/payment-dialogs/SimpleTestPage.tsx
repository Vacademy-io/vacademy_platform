import React from 'react';
import { PaymentDialogUITest } from './PaymentDialogUITest';

// Simple test page component that can be imported anywhere
export const SimplePaymentDialogTest = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <PaymentDialogUITest />
    </div>
  );
};

// Default export for easy importing
export default SimplePaymentDialogTest;
