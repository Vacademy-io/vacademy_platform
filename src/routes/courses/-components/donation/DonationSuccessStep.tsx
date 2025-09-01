import { CheckCircle } from "lucide-react";
import { MyButton } from "@/components/design-system/button";

interface DonationSuccessStepProps {
  amount: number;
  onClose: () => void;
}

export const DonationSuccessStep = ({ amount, onClose }: DonationSuccessStepProps) => {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-12 h-12 text-green-500" />
        </div>
      </div>
      <div className="space-y-3">
        <h2 className="text-3xl font-bold text-gray-900">Thank You!</h2>
        <p className="text-gray-600 text-lg">
          Your donation request for <span className="font-semibold text-green-600">${amount}</span> has been created.
        </p>
        <p className="text-gray-500">
          Thank you for supporting free learning and making education accessible to everyone!
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
          <p className="text-sm text-blue-800">
            <strong>Next Step:</strong> Complete your payment
          </p>
          <p className="text-xs text-blue-600 mt-1">
            We've sent a secure payment link to your email address. Please check your inbox and click the link to complete your donation.
          </p>
        </div>
      </div>
      <MyButton
        onClick={onClose}
        className="w-full"
        scale="large"
        buttonType="primary"
        layoutVariant="default"
      >
        Close
      </MyButton>
    </div>
  );
};
