import { CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { MyButton } from "@/components/design-system/button";

interface DonationSuccessStepProps {
  amount: number;
  status: 'success' | 'failure' | null;
  error?: string;
  onClose: () => void;
  onRetry: () => void;
}

export const DonationSuccessStep = ({ 
  amount, 
  status, 
  error, 
  onClose, 
  onRetry 
}: DonationSuccessStepProps) => {
  const isSuccess = status === 'success';
  const isFailure = status === 'failure';

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
              Your donation of <span className="font-semibold text-green-600">${amount}</span> is being processed.
            </p>
            <p className="text-gray-500">
              Thank you for supporting free learning and making education accessible to everyone!
            </p>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-bold text-gray-900">Payment Failed</h2>
            <p className="text-gray-600 text-lg">
              We couldn't process your donation of <span className="font-semibold text-red-600">${amount}</span>.
            </p>
            {error && (
              <p className="text-red-500 text-sm bg-red-50 p-3 rounded-md">
                {error}
              </p>
            )}
            <p className="text-gray-500">
              Please try again or contact support if the problem persists.
            </p>
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
        
        <MyButton
          onClick={onClose}
          className="w-full"
          scale="large"
          buttonType={isSuccess ? "primary" : "secondary"}
          layoutVariant="default"
        >
          {isSuccess ? 'Close' : 'Cancel'}
        </MyButton>
      </div>
    </div>
  );
};
