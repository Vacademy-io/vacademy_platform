import { Heart } from "lucide-react";

interface DonationHeaderProps {
  step: string;
}

export const DonationHeader = ({ step }: DonationHeaderProps) => {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-center gap-2 mb-3">
        <Heart className="w-6 h-6 text-red-500" />
        <h2 className="text-xl font-bold text-gray-900">
          Support Free Learning
        </h2>
      </div>
      {step === 'select' && (
        <p className="text-sm text-gray-600 mb-4">
          Choose an amount to donate
        </p>
      )}
    </div>
  );
};
