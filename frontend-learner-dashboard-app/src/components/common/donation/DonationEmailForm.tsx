import React from "react";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { DonationSummary } from "./DonationSummary";

interface DonationEmailFormProps {
  email: string;
  validationError: string;
  amount: number;
  currency: string;
  paymentPlanName?: string;
  onEmailChange: (email: string) => void;
  onEdit: () => void;
}

export const DonationEmailForm: React.FC<DonationEmailFormProps> = ({
  email,
  validationError,
  amount,
  currency,
  paymentPlanName,
  onEmailChange,
  onEdit,
}) => {
  return (
    <>
      <DonationSummary
        amount={amount}
        currency={currency}
        paymentPlanName={paymentPlanName}
        onEdit={onEdit}
      />
      <div className="mb-2">
        <label className="block text-xs text-gray-600 mb-1" htmlFor="donation-email">Your Email</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <EnvelopeSimple size={16} />
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
        <p className="text-[11px] text-gray-400 mt-1">We'll send your receipt to this email address</p>
      </div>
    </>
  );
};
