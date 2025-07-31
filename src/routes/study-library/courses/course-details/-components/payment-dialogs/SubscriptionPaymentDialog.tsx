import React, { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import { MyButton } from "@/components/design-system/button";
import { Lock } from "lucide-react";
import { SiStripe } from "react-icons/si";
import { EnvelopeSimple } from "phosphor-react";
import { Loader2, CreditCard } from "lucide-react";
import {
  formatCurrency,
  getCurrencySymbol,
} from "../../-services/enrollment-api";
import {
  usePaymentDialog,
  getCurrencyWithPriority,
  type PaymentDialogProps,
} from "./payment-utils";

export const SubscriptionPaymentDialog: React.FC<PaymentDialogProps> = ({
  open,
  onOpenChange,
  onContinue,
  onSkip,
  packageSessionId,
  instituteId,
  token,
  inviteCode = "default",
}) => {
  // Use the shared payment dialog hook
  const {
    enrollmentData,
    paymentGatewayData,
    loading,
    error,
    selectedPaymentOption,
    selectedPaymentPlan,
    handlePayment,
    retryFetch,
  } = usePaymentDialog({
    open,
    packageSessionId,
    instituteId,
    token,
    inviteCode,
  });

  const [step, setStep] = useState<'summary' | 'payment'>('summary');
  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState<string>('');

  const getCurrency = (): string => {
    return getCurrencyWithPriority(selectedPaymentPlan, selectedPaymentOption, enrollmentData);
  };

  const handleContinue = () => {
    if (step === 'summary') {
      // Validate email before proceeding to payment
      if (!email || !email.trim()) {
        setValidationError('Please enter your email address');
        return;
      }
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setValidationError('Please enter a valid email address');
        return;
      }
      
      setStep('payment');
    } else if (step === 'payment') {
      handlePaymentAndEnrollment();
    }
  };

  const handlePaymentAndEnrollment = async () => {
    if (!selectedPaymentPlan) {
      console.error('No payment plan selected');
      return;
    }

    try {
      await handlePayment({
        email,
        amount: selectedPaymentPlan.actual_price,
        currency: getCurrency(),
        description: `Subscription for ${selectedPaymentPlan.name}`,
        paymentType: 'subscription'
      });
      
      // Success - call the onContinue callback
      if (onContinue) {
        onContinue();
      }
    } catch (error) {
      console.error('❌ Error during subscription payment:', error);
    }
  };

  const handleEdit = () => {
    setStep('summary');
  };

  // Reset step when dialog is closed
  React.useEffect(() => {
    if (!open) setStep('summary');
  }, [open]);

  // Show loading state
  if (loading) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[9999] bg-black/60 animate-fade-in" />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-1/2 z-[9999] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl focus:outline-none flex flex-col gap-4"
          >
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-600" />
              <p className="text-gray-600">Loading subscription options...</p>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  // Show error state
  if (error) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[9999] bg-black/60 animate-fade-in" />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-1/2 z-[9999] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl focus:outline-none flex flex-col gap-4"
          >
            <div className="text-center py-6">
              <p className="text-red-600 mb-4">{error}</p>
              <MyButton
                buttonType="primary"
                scale="medium"
                onClick={retryFetch}
              >
                Try Again
              </MyButton>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[9999] bg-black/60 animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[9999] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl focus:outline-none flex flex-col gap-4"
        >
          <button
            className="absolute right-2 top-2 text-gray-400 hover:text-gray-700 focus:outline-none"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <Cross2Icon className="h-4 w-4" />
          </button>
          
          <h2 className="text-lg font-bold text-center text-primary-700 mb-1 flex items-center justify-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-500" />
            Subscription Payment
          </h2>

          {step === 'summary' ? (
            <>
              {selectedPaymentPlan && (
                <div className="mb-2 bg-white border border-neutral-300 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-700">Subscription Summary</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Plan:</span>
                    <span className="font-semibold text-gray-900">{selectedPaymentPlan.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Price:</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(selectedPaymentPlan.actual_price, getCurrency())}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Validity:</span>
                    <span className="font-semibold text-gray-900">
                      {selectedPaymentPlan.validity_in_days} days
                    </span>
                  </div>
                </div>
              )}
              
              <div className="mb-2">
                <label className="block text-xs text-gray-600 mb-1" htmlFor="subscription-email">Your Email</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <EnvelopeSimple size={16} />
                  </span>
                  <input
                    id="subscription-email"
                    type="email"
                    className={`border rounded pl-9 p-2 text-xs w-full h-10 ${
                      validationError ? 'border-red-500 bg-red-50' : ''
                    }`}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setValidationError('');
                    }}
                    placeholder={validationError ? validationError : "you@example.com"}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">We'll send your receipt to this email address</p>
              </div>
            </>
          ) : (
            <>
              <div className="mb-2 bg-white border border-neutral-300 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-700">Payment Summary</span>
                </div>
                {selectedPaymentPlan && (
                  <>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Plan:</span>
                      <span className="font-semibold text-gray-900">{selectedPaymentPlan.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(selectedPaymentPlan.actual_price, getCurrency())}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Email:</span>
                      <span className="font-semibold text-gray-900">{email}</span>
                    </div>
                  </>
                )}
                <button
                  className="text-xs font-medium ml-auto block rounded border border-neutral-300 bg-white text-neutral-600 px-3 py-1 focus:outline-none transition-colors duration-200 hover:bg-primary-50/50 hover:border-primary-300"
                  onClick={handleEdit}
                >
                  Edit
                </button>
              </div>
              
              <div className="mb-2">
                <label className="block text-xs text-gray-600 mb-1" htmlFor="card-number">Card Details</label>
                <div className="relative mb-2">
                  <input
                    id="card-number"
                    type="text"
                    className="border rounded p-2 text-xs w-full h-10 pr-20"
                    placeholder="Card number"
                    autoComplete="cc-number"
                  />
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary-600 hover:underline px-2 py-1 bg-white"
                    type="button"
                    onClick={() => {/* autofill logic here */}}
                    tabIndex={0}
                  >
                    Autofill
                  </button>
                </div>
                
                <div className="flex flex-col gap-2 w-full mt-3">
                  <MyButton
                    buttonType="primary"
                    scale="medium"
                    layoutVariant="default"
                    className="w-full h-11 text-base flex items-center justify-center gap-2"
                    onClick={handlePaymentAndEnrollment}
                  >
                    <Lock size={18} /> Subscribe Now
                  </MyButton>
                  <MyButton
                    buttonType="secondary"
                    scale="medium"
                    layoutVariant="default"
                    className="w-full h-10 text-sm border-none"
                    onClick={onSkip}
                  >
                    Cancel
                  </MyButton>
                </div>
                
                <div className="text-xs text-gray-500 text-center mt-2 flex items-center justify-center gap-1">
                  <Lock size={14} className="inline-block mr-1" />
                  Secure payment powered by
                  <span className="font-semibold flex items-center gap-1 ml-1">
                    <SiStripe size={16} className="text-indigo-600" /> 
                    {paymentGatewayData?.vendor || 'Stripe'}
                  </span>
                </div>
              </div>
            </>
          )}

          {step === 'summary' && (
            <div className="flex flex-col gap-2 w-full mt-3">
              <MyButton
                buttonType="primary"
                scale="medium"
                layoutVariant="default"
                className="w-full h-11 text-base"
                onClick={handleContinue}
              >
                Continue
              </MyButton>
              <MyButton
                buttonType="secondary"
                scale="medium"
                layoutVariant="default"
                className="w-full h-10 text-sm border-none"
                onClick={onSkip}
              >
                Cancel
              </MyButton>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}; 