import React, { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import { MyButton } from "@/components/design-system/button";
import { LockSimple } from "phosphor-react";
import { SiStripe } from "react-icons/si";
import { EnvelopeSimple } from "phosphor-react";
import { Loader2, Heart } from "lucide-react";
import {
  fetchEnrollmentDetails,
  type EnrollmentResponse,
  type PaymentOption,
  type PaymentPlan,
  getPaymentOptions,
  getPaymentPlans,
  formatCurrency,
  getCurrencySymbol,
} from "../../-services/enrollment-api";

interface DonationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue?: () => void;
  onSkip?: () => void;
  courseTitle?: string;
  packageSessionId: string;
  instituteId: string;
  token: string;
  inviteCode?: string;
}

export const DonationDialog: React.FC<DonationDialogProps> = ({
  open,
  onOpenChange,
  onContinue,
  onSkip,
  packageSessionId,
  instituteId,
  token,
  inviteCode = "default",
}) => {
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaymentOption, setSelectedPaymentOption] = useState<PaymentOption | null>(null);
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState<PaymentPlan | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | 'other'>(0);
  const [customAmount, setCustomAmount] = useState('');
  const [step, setStep] = useState<'select' | 'summary' | 'payment'>('select');
  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState<string>('');

  // Fetch enrollment data when dialog opens
  useEffect(() => {
    if (open && packageSessionId) {
      fetchEnrollmentData();
    }
  }, [open, packageSessionId]);

  const fetchEnrollmentData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEnrollmentDetails(inviteCode, instituteId, packageSessionId, token);
      setEnrollmentData(data);
      
      // Auto-select first payment option and plan
      const paymentOptions = getPaymentOptions(data);
      if (paymentOptions.length > 0) {
        const firstOption = paymentOptions[0];
        setSelectedPaymentOption(firstOption);
        
        const plans = getPaymentPlans(firstOption);
        if (plans.length > 0) {
          const firstPlan = plans[0];
          setSelectedPaymentPlan(firstPlan);
          
          // Set initial amount to minimum amount or first suggested amount
          try {
            const metadata = JSON.parse(firstOption.payment_option_metadata_json);
            const donationData = metadata.donationData || metadata.config?.donation || {};
            const suggestedAmountsStr = donationData.suggestedAmounts || "100, 200, 300, 400, 500";
            const suggestedAmounts = suggestedAmountsStr
              .split(',')
              .map((amount: string) => parseFloat(amount.trim()))
              .filter((amount: number) => !isNaN(amount));
            const minimumAmount = parseFloat(donationData.minimumAmount) || 0;
            const initialAmount = minimumAmount > 0 ? minimumAmount : suggestedAmounts[0];
            setSelectedAmount(initialAmount);
          } catch {
            setSelectedAmount(12); // fallback
          }
        }
      }
    } catch (err) {
      setError("Failed to load donation options. Please try again.");
      console.error("Error fetching enrollment data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Parse donation metadata from payment option
  const getDonationMetadata = () => {
    if (!selectedPaymentOption?.payment_option_metadata_json) {
      return {
        suggestedAmounts: [12, 20, 30, 50],
        minimumAmount: 0
      };
    }

    try {
      const metadata = JSON.parse(selectedPaymentOption.payment_option_metadata_json);
      const donationData = metadata.donationData || metadata.config?.donation || {};
      
      const suggestedAmountsStr = donationData.suggestedAmounts || "100, 200, 300, 400, 500";
      const suggestedAmounts = suggestedAmountsStr
        .split(',')
        .map((amount: string) => parseFloat(amount.trim()))
        .filter((amount: number) => !isNaN(amount));
      
      const minimumAmount = parseFloat(donationData.minimumAmount) || 0;
      
      return {
        suggestedAmounts: suggestedAmounts.length > 0 ? suggestedAmounts : [12, 20, 30, 50],
        minimumAmount
      };
    } catch (error) {
      console.error("Error parsing donation metadata:", error);
      return {
        suggestedAmounts: [12, 20, 30, 50],
        minimumAmount: 0
      };
    }
  };

  // Get donation amounts from metadata
  const getDonationAmounts = (): number[] => {
    const metadata = getDonationMetadata();
    return metadata.suggestedAmounts;
  };

  // Get minimum amount from metadata
  const getMinimumAmount = (): number => {
    const metadata = getDonationMetadata();
    return metadata.minimumAmount;
  };

  // Get the correct currency with priority: payment plan > metadata > main response
  const getCurrency = (): string => {
    // Priority 1: Payment plan currency
    if (selectedPaymentPlan?.currency) {
      return selectedPaymentPlan.currency;
    }
    
    // Priority 2: Metadata currency
    try {
      if (selectedPaymentOption?.payment_option_metadata_json) {
        const metadata = JSON.parse(selectedPaymentOption.payment_option_metadata_json);
        if (metadata.currency) {
          return metadata.currency;
        }
      }
    } catch (error) {
      console.error("Error parsing metadata currency:", error);
    }
    
    // Priority 3: Main response currency
    return enrollmentData?.currency || 'USD';
  };

  const getAmount = () => {
    if (selectedAmount === 'other') {
      const val = parseFloat(customAmount);
      return isNaN(val) ? '' : val;
    }
    return selectedAmount;
  };

  const handleContinue = () => {
    if (step === 'select') {
      // Clear any previous validation errors
      setValidationError('');
      
      // Validate minimum amount
      const minAmount = getMinimumAmount();
      const currentAmount = selectedAmount === 'other' ? parseFloat(customAmount) : selectedAmount;
      
      if (selectedAmount === 'other') {
        if (!customAmount) {
          setValidationError('Please enter a donation amount');
          return;
        }
        if (currentAmount < minAmount) {
          setValidationError(`Minimum donation amount is ${formatCurrency(minAmount, getCurrency())}`);
          return;
        }
      }
      
      setStep('summary');
    } else if (step === 'summary') {
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
    } else if (onContinue) {
      // Final validation before completing donation
      if (!email || !email.trim()) {
        setValidationError('Please enter your email address');
        return;
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setValidationError('Please enter a valid email address');
        return;
      }
      
      onContinue();
    }
  };

  const handleEdit = () => {
    setStep('select');
  };

  // Reset step when dialog is closed
  React.useEffect(() => {
    if (!open) setStep('select');
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
              <p className="text-gray-600">Loading donation options...</p>
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
                onClick={fetchEnrollmentData}
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
            <Heart className="w-5 h-5 text-red-500" />
            Support Free Learning
          </h2>
          

          {step === 'select' ? (
            <>
              {/* <div className="flex justify-center mb-1 -space-x-6">
                <MyButton
                  buttonType={donationType === 'one-time' ? 'primary' : 'secondary'}
                  scale="medium"
                  className="h-12 min-w-[160px] text-base rounded-full z-10 shadow-lg"
                  onClick={() => setDonationType('one-time')}
                >
                  One-time
                </MyButton>
                <MyButton
                  buttonType={donationType === 'monthly' ? 'primary' : 'secondary'}
                  scale="medium"
                  className="h-12 min-w-[160px] text-base rounded-full z-20 shadow-lg"
                  onClick={() => setDonationType('monthly')}
                >
                  Monthly
                </MyButton>
              </div>

              <p className="text-xs text-gray-700 text-center mt-1 mb-1">
                Choose an amount to donate {donationType}
              </p> */}
<p className="text-sm text-gray-600 ">Choose an amount to donate</p>
              <div className="grid grid-cols-2 gap-3 justify-center mb-2">
                {getDonationAmounts().map((amount) => (
                  <div
                    key={amount}
                    className={`h-11 min-w-[90px] flex items-center justify-center rounded border cursor-pointer select-none text-sm font-medium transition-colors duration-200
                      ${selectedAmount === amount ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-800 border-gray-300 hover:bg-primary-50'}`}
                    onClick={() => {
                      setSelectedAmount(amount);
                      setValidationError(''); // Clear validation error when selecting a predefined amount
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedAmount(amount); }}
                  >
                    {formatCurrency(amount, getCurrency())}
                  </div>
                ))}
                {selectedAmount !== 'other' && (
                  <div
                    className={`h-11 w-full flex items-center justify-center rounded border cursor-pointer select-none text-sm font-medium transition-colors duration-200
                      bg-white text-gray-800 border-gray-300 hover:bg-primary-50`}
                    onClick={() => {
                      setSelectedAmount('other');
                      setValidationError(''); // Clear validation error when selecting other
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedAmount('other'); }}
                    style={{ gridColumn: 'span 2' }}
                  >
                    Other
                  </div>
                )}
                {selectedAmount === 'other' && (
                  <input
                    type="number"
                    min="0"
                                            placeholder={`${getCurrencySymbol(getCurrency())} (min ${formatCurrency(getMinimumAmount(), getCurrency())})`}
                    className="border rounded p-2 text-xs w-full mt-1 mb-1 col-span-2 h-12"
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value);
                      setValidationError(''); // Clear validation error when user types
                    }}
                    style={{ gridColumn: 'span 2' }}
                  />
                )}
              </div>
              
              {/* Validation Error Message */}
              {validationError && (
                <div className="text-red-600 text-xs text-center mt-2">
                  {validationError}
                </div>
              )}
            </>
          ) : step === 'summary' ? (
            <>
              <div className="mb-2 bg-white border border-neutral-300 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-700">Donation Summary</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(getAmount() as number, getCurrency())}</span>
                </div>
                {selectedPaymentPlan && (
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Plan:</span>
                    <span className="font-semibold text-gray-900">{selectedPaymentPlan.name}</span>
                  </div>
                )}
                <button
                  className="text-xs font-medium ml-auto block rounded border border-neutral-300 bg-white text-neutral-600 px-3 py-1 focus:outline-none transition-colors duration-200 hover:bg-primary-50/50 hover:border-primary-300"
                  onClick={handleEdit}
                  style={{ boxShadow: 'none', textDecoration: 'none' }}
                >
                  Edit
                </button>
              </div>
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
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setValidationError(''); // Clear validation error when user types
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
                  <span className="font-semibold text-gray-700">Donation Summary</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-semibold text-gray-900">
                    {selectedAmount === 'other' 
                      ? formatCurrency(parseFloat(customAmount) || 0, getCurrency())
                      : formatCurrency(selectedAmount as number, getCurrency())
                    }
                  </span>
                </div>
                {selectedPaymentPlan && (
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Plan:</span>
                    <span className="font-semibold text-gray-900">{selectedPaymentPlan.name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-semibold text-gray-900">{email}</span>
                </div>
                <button
                  className="text-xs font-medium ml-auto block rounded border border-neutral-300 bg-white text-neutral-600 px-3 py-1 focus:outline-none transition-colors duration-200 hover:bg-primary-50/50 hover:border-primary-300"
                  onClick={handleEdit}
                  style={{ boxShadow: 'none', textDecoration: 'none' }}
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
                    onClick={onContinue}
                  >
                    <LockSimple size={18} weight="bold" /> Donate Now
                  </MyButton>
                  <MyButton
                    buttonType="secondary"
                    scale="medium"
                    layoutVariant="default"
                    className="w-full h-10 text-sm border-none"
                    onClick={onSkip}
                  >
                    Skip
                  </MyButton>
                </div>
                <div className="text-xs text-gray-500 text-center mt-2 flex items-center justify-center gap-1">
                  <LockSimple size={14} className="inline-block mr-1" />
                  Secure payment powered by
                  <span className="font-semibold flex items-center gap-1 ml-1">
                    <SiStripe size={16} className="text-indigo-600" /> Stripe
                  </span>
                </div>
              </div>
            </>
          )}

          {step !== 'payment' && (
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
                Skip
              </MyButton>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
