import React, { useRef, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { LockSimple } from "@phosphor-icons/react";
import { SiStripe } from "react-icons/si";
import { MyButton } from "@/components/design-system/button";
import { DonationSummary } from "./DonationSummary";

interface DonationPaymentFormProps {
  email: string;
  amount: number;
  currency: string;
  paymentPlanName?: string;
  cardElementError: string;
  cardElementReady: boolean;
  isApiLoading: boolean;
  paymentGatewayData?: any;
  cardElementRef: React.RefObject<HTMLDivElement>;
  onEdit: () => void;
  onPayment: () => void;
  onSkip: () => void;
}

export const DonationPaymentForm: React.FC<DonationPaymentFormProps> = ({
  email,
  amount,
  currency,
  paymentPlanName,
  cardElementError,
  cardElementReady,
  isApiLoading,
  paymentGatewayData,
  cardElementRef,
  onEdit,
  onPayment,
  onSkip,
}) => {

  return (
    <>
      <DonationSummary
        amount={amount}
        currency={currency}
        paymentPlanName={paymentPlanName}
        email={email}
        showEmail={true}
        onEdit={onEdit}
      />
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs text-gray-600">Card Details</label>
        </div>
        
        <div className={`border rounded p-3 text-sm w-full min-h-[48px] ${
          cardElementError ? 'border-red-500 bg-red-50' : 'border-gray-300'
        }`}>
          {!cardElementReady && (
            <div className="flex items-center justify-center h-full text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Loading payment form...
            </div>
          )}
          <div ref={cardElementRef} className="w-full h-full" />
        </div>
        
        {cardElementError && (
          <div className="text-red-600 text-xs mb-2 mt-1">
            {cardElementError}
          </div>
        )}
        
        <div className="flex flex-col gap-2 w-full mt-3">
          <MyButton
            buttonType="primary"
            scale="medium"
            layoutVariant="default"
            className="w-full h-11 text-base flex items-center justify-center gap-2"
            onClick={onPayment}
            disabled={isApiLoading}
          >
            {isApiLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <LockSimple size={18} weight="bold" />
                Donate Now
              </>
            )}
          </MyButton>
          <MyButton
            buttonType="secondary"
            scale="medium"
            layoutVariant="default"
            className="w-full h-10 text-sm border-none"
            onClick={onSkip}
            disabled={isApiLoading}
          >
            {isApiLoading ? 'Processing...' : 'Skip'}
          </MyButton>
        </div>
        <div className="text-xs text-gray-500 text-center mt-2 flex items-center justify-center gap-1">
          <LockSimple size={14} className="inline-block mr-1" />
          Secure payment powered by
          <span className="font-semibold flex items-center gap-1 ml-1">
            <SiStripe size={16} className="text-indigo-600" /> 
            {paymentGatewayData?.vendor || 'Stripe'}
          </span>
        </div>
      </div>
    </>
  );
};
