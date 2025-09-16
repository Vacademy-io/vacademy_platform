import React, { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import { MyButton } from "@/components/design-system/button";
import { Loader2 } from "lucide-react";
import { fetchPaymentOptions, PaymentOption } from "../-services/payment-options-api";
import {
  DonationHeader,
  DonationAmountStep,
  DonationEmailStep,
  DonationPaymentStep,
  DonationSuccessStep
} from "../-components/donation";

interface CoursesDonationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instituteId: string;
}

export const CoursesDonationDialog: React.FC<CoursesDonationDialogProps> = ({
  open,
  onOpenChange,
  instituteId,
}) => {
  const [step, setStep] = useState<'select' | 'email' | 'payment' | 'success'>('select');
  const [selectedAmount, setSelectedAmount] = useState<number | 'other'>(0);
  const [customAmount, setCustomAmount] = useState('');
  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'failure' | null>(null);
  const [paymentError, setPaymentError] = useState<string>('');

  const getCurrentAmount = (): number => {
    if (selectedAmount === 'other') {
      return parseFloat(customAmount) || 0;
    }
    return selectedAmount;
  };

  const handleAmountSelect = (amount: number | 'other') => {
    setSelectedAmount(amount);
    if (amount !== 'other') {
      setCustomAmount('');
    }
    setValidationError('');
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount('other');
    setValidationError('');
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setValidationError('');
  };

  const handleContinue = () => {
    if (step === 'select') {
      const amount = getCurrentAmount();
      
      // Require user to select or enter an amount
      if (amount <= 0) {
        setValidationError('Please select or enter a donation amount');
        return;
      }
      
      setStep('email');
    } else if (step === 'email') {
      // Validate email
      if (!email || !email.includes('@')) {
        setValidationError('Please enter a valid email address');
        return;
      }
      
      setStep('payment');
    }
  };

  const handleBack = () => {
    if (step === 'email') {
      setStep('select');
    } else if (step === 'payment') {
      setStep('email');
    }
  };

  const handlePaymentSuccess = () => {
    setPaymentStatus('success');
    setPaymentError('');
    setStep('success');
  };

  const handlePaymentError = (error: string) => {
    setPaymentStatus('failure');
    setPaymentError(error);
    setStep('success'); // Show the result dialog (which will show failure UI)
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  useEffect(() => {
    if (open) {
      setIsInitializing(true);
      setLoading(true);
      
      // Fetch payment options
      fetchPaymentOptions(instituteId).then((options) => {
        setPaymentOptions(options);
        setLoading(false);
      }).catch((error) => {
        setLoading(false);
      });
      
      setTimeout(() => {
        setStep('select');
        setSelectedAmount(0);
        setCustomAmount('');
        setEmail('');
        setValidationError('');
        setPaymentStatus(null);
        setPaymentError('');
        setIsInitializing(false);
      }, 100);
    }
  }, [open, instituteId]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[9999] bg-black/60" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[9999] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl focus:outline-none">
          <button
            className="absolute right-2 top-2 text-gray-400 hover:text-gray-700 focus:outline-none"
            onClick={handleClose}
            aria-label="Close"
          >
            <Cross2Icon className="h-4 w-4" />
          </button>

          {isInitializing ? (
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
              </div>
              <h2 className="text-xl font-semibold text-gray-700">Loading...</h2>
            </div>
          ) : step === 'success' ? (
            <DonationSuccessStep
              amount={getCurrentAmount()}
              status={paymentStatus}
              error={paymentError}
              onClose={handleClose}
              onRetry={() => setStep('payment')}
            />
          ) : (
            <>
              <DonationHeader step={step} />

              {step === 'select' && (
                <DonationAmountStep
                  paymentOptions={paymentOptions}
                  loading={loading}
                  selectedAmount={selectedAmount}
                  customAmount={customAmount}
                  validationError={validationError}
                  onAmountSelect={handleAmountSelect}
                  onCustomAmountChange={handleCustomAmountChange}
                />
              )}

              {step === 'email' && (
                <DonationEmailStep
                  amount={getCurrentAmount()}
                  email={email}
                  validationError={validationError}
                  onEmailChange={handleEmailChange}
                  onBack={handleBack}
                />
              )}

              {step === 'payment' && (
                <DonationPaymentStep
                  amount={getCurrentAmount()}
                  email={email}
                  instituteId={instituteId}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  onBack={handleBack}
                />
              )}

              {(step === 'select' || step === 'email') && (
                <div className="flex flex-col gap-2 w-full mt-3">
                  <MyButton
                    buttonType="primary"
                    scale="medium"
                    layoutVariant="default"
                    className="w-full h-11 text-base"
                    onClick={handleContinue}
                    disabled={false}
                  >
                    Continue
                  </MyButton>
                </div>
              )}
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};