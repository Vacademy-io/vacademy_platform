import { Mail } from "lucide-react";

interface DonationEmailStepProps {
  amount: number;
  email: string;
  validationError: string;
  onEmailChange: (email: string) => void;
  onBack: () => void;
}

export const DonationEmailStep = ({
  amount,
  email,
  validationError,
  onEmailChange,
  onBack
}: DonationEmailStepProps) => {
  return (
    <>
      <div className="mb-2 bg-white border border-neutral-300 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-gray-700">Donation Summary</span>
        </div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-600">Amount:</span>
          <span className="font-semibold text-gray-900">${amount}</span>
        </div>
        <button
          className="text-xs font-medium ml-auto block rounded border border-neutral-300 bg-white text-neutral-600 px-3 py-1 focus:outline-none transition-colors duration-200 hover:bg-blue-50/50 hover:border-blue-300"
          onClick={onBack}
          style={{ boxShadow: 'none', textDecoration: 'none' }}
        >
          Edit
        </button>
      </div>
      
      <div className="mb-2">
        <label className="block text-xs text-gray-600 mb-1" htmlFor="donation-email">
          Your Email
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Mail size={16} />
          </span>
          <input
            id="donation-email"
            type="email"
            className={`border rounded pl-9 p-2 text-xs w-full h-10 ${
              validationError ? 'border-red-500 bg-red-50' : ''
            }`}
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder={validationError ? validationError : "you@example.com"}
          />
        </div>
        <p className="text-[11px] text-gray-400 mt-1">
          We'll send your receipt to this email address
        </p>
      </div>
    </>
  );
};
