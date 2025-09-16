import { CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { MyButton } from "@/components/design-system/button";
import { formatCurrency } from "@/utils/currency";

interface DonationSuccessStepProps {
  amount: number;
  currency: string;
  status: 'success' | 'failure' | null;
  error?: string;
  onClose: () => void;
  onRetry: () => void;
}

export const DonationSuccessStep = ({ 
  amount, 
  currency,
  status, 
  error, 
  onClose, 
  onRetry 
}: DonationSuccessStepProps) => {
  const isSuccess = status === 'success';
  const isFailure = status === 'failure';

  // Clean up error message for better user experience
  const cleanErrorMessage = (errorMsg: string): string => {
    if (!errorMsg) return errorMsg;
    
    // Remove request IDs and technical codes for better UX
    return errorMsg
      .replace(/; request-id: [a-zA-Z0-9_]+/g, '')
      .replace(/; code: [a-zA-Z0-9_]+/g, '')
      .replace(/Error processing donation payment: /g, '')
      .replace(/Stripe payment failed: /g, '')
      .trim();
  };

  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
          isSuccess ? 'bg-green-100' : 'bg-red-100'
        }`}>
          {isSuccess ? (
            <CheckCircle className="w-12 h-12 text-green-500" />
          ) : (
            <XCircle className="w-12 h-12 text-red-500" />
          )}
        </div>
      </div>
      
      <div className="space-y-3">
        {isSuccess ? (
          <>
            <h2 className="text-3xl font-bold text-gray-900">Thank You!</h2>
            <p className="text-gray-600 text-lg">
              Your donation of <span className="font-semibold text-green-600">{formatCurrency(amount, currency)}</span> is being processed.
            </p>
            <p className="text-gray-500">
              Thank you for supporting free learning and making education accessible to everyone!
            </p>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-bold text-gray-900">Payment Failed</h2>
            <p className="text-gray-600 text-lg">
              We couldn't process your donation of <span className="font-semibold text-red-600">{formatCurrency(amount, currency)}</span>.
            </p>
            {error && (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className="text-sm font-semibold text-red-800 mb-2">
                      Payment Issue
                    </h4>
                    <p className="text-sm text-red-700 leading-relaxed">
                      {cleanErrorMessage(error)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      <div className="flex flex-col gap-3">
        {isFailure && (
          <MyButton
            onClick={onRetry}
            className="w-full"
            scale="large"
            buttonType="primary"
            layoutVariant="default"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </MyButton>
        )}
      </div>
    </div>
  );
};
