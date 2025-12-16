import React, { useState, useEffect, useRef, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import { MyButton } from "@/components/design-system/button";
import { Lock } from "lucide-react";
import { SiStripe } from "react-icons/si";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { Loader2, CreditCard } from "lucide-react";
import {
  formatCurrency,
  getCurrencySymbol,
  handlePaymentForEnrollment,
  fetchPaymentGatewayDetails,
  createStripePaymentMethodWithElements,
  validateAndSanitizeEmail,
} from "../../-services/enrollment-api";
import {
  usePaymentDialog,
  getCurrencyWithPriority,
  type PaymentDialogProps,
} from "./payment-utils";
import { EnrollmentSuccessDialog } from "./EnrollmentSuccessDialog";
import { EnrollmentPendingDialog } from "./EnrollmentPendingDialog";

// TypeScript declarations for Stripe
declare global {
  interface Window {
    Stripe?: (publishableKey: string) => any;
  }
}

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
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showPendingDialog, setShowPendingDialog] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  // Stripe Elements state
  const [stripe, setStripe] = useState<any>(null);
  const [stripeElements, setStripeElements] = useState<any>(null);
  const [cardElement, setCardElement] = useState<any>(null);
  const [cardElementError, setCardElementError] = useState<string>('');
  const [cardElementReady, setCardElementReady] = useState<boolean>(false);
  const cardElementRef = useRef<HTMLDivElement>(null);

  const getCurrency = (): string => {
    return getCurrencyWithPriority(selectedPaymentPlan, selectedPaymentOption, enrollmentData);
  };

  // Simple loadStripe function
  const loadStripe = useCallback(async (publishableKey: string) => {
    try {
      // Check if Stripe is already loaded
      if (window.Stripe) {
        return window.Stripe(publishableKey);
      }

      // Load Stripe.js script
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      
      return new Promise((resolve, reject) => {
        script.onload = () => {
          if (window.Stripe) {
            const stripe = window.Stripe(publishableKey);
            resolve(stripe);
          } else {
            reject(new Error('Stripe failed to load'));
          }
        };
        script.onerror = () => {
          reject(new Error('Failed to load Stripe script'));
        };
        document.head.appendChild(script);
      });
    } catch (error) {
      throw error;
    }
  }, []);

  // Initialize Stripe Elements when payment gateway data is loaded
  useEffect(() => {
    const initializeStripeElements = async () => {
      if (paymentGatewayData?.publishableKey && cardElementRef.current && step === 'payment') {
        // Clear any previous errors when starting initialization
        setCardElementError('');
        
        try {
          let stripeInstance = stripe;
          
          // Load Stripe if not already loaded
          if (!stripeInstance) {
            stripeInstance = await loadStripe(paymentGatewayData.publishableKey);
            setStripe(stripeInstance);
          }
          
          // Create elements if not already created
          let elements = stripeElements;
          if (!elements) {
            elements = (stripeInstance as any).elements();
            setStripeElements(elements);
          }
          
          // Clean up existing card element if it exists
          if (cardElement) {
            try {
              cardElement.destroy();
            } catch (destroyError) {
              // Ignore destroy errors
            }
            setCardElement(null);
            setCardElementReady(false);
          }
          
          // Create new card element
          const card = elements.create('card', {
            style: {
              base: {
                fontSize: '16px',
                color: '#374151',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                '::placeholder': {
                  color: '#9CA3AF',
                },
                padding: '8px 0',
              },
              invalid: {
                color: '#DC2626',
              },
            },
            hidePostalCode: true,
          });
          
          // Set card element immediately
          setCardElement(card);
          
          // Mount card element with a small delay to ensure DOM is ready
          setTimeout(() => {
            if (cardElementRef.current && card) {
              card.mount(cardElementRef.current);
              
              // Set up event listeners
              card.on('ready', () => {
                setCardElementReady(true);
                setCardElementError('');
              });
              
              card.on('change', (event: any) => {
                if (event.error) {
                  setCardElementError(event.error.message);
                } else {
                  setCardElementError('');
                }
              });
            }
          }, 100);
          
        } catch (error) {
          console.error('Stripe initialization error:', error);
          setCardElementError('Failed to load payment form. Please refresh and try again.');
        }
      }
    };

    initializeStripeElements();
  }, [paymentGatewayData, stripe, stripeElements, step, open, loadStripe]);

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
    if (!selectedPaymentPlan || !selectedPaymentOption || !enrollmentData) {
      return;
    }

    setProcessingPayment(true);
    setValidationError('');
    setCardElementError('');
    
    try {
      // Validate and sanitize email
      let sanitizedEmail: string;
      try {
        sanitizedEmail = validateAndSanitizeEmail(email);
      } catch (emailError) {
        setValidationError(emailError instanceof Error ? emailError.message : 'Invalid email format');
        return;
      }

      // Validate Stripe Elements
      if (!stripe || !cardElement || !cardElementReady) {
        setCardElementError('Payment form not loaded. Please refresh and try again.');
        return;
      }

      // Create payment method using Stripe Elements
      const paymentMethod = await createStripePaymentMethodWithElements(stripe, cardElement);
      
      // Call the enrollment API with payment
      await handlePaymentForEnrollment({
        userEmail: "user@example.com", // This should come from user profile
        receiptEmail: sanitizedEmail,
        instituteId,
        packageSessionId,
        enrollmentData,
        paymentGatewayData: paymentGatewayData!,
        selectedPaymentPlan,
        selectedPaymentOption,
        amount: selectedPaymentPlan.actual_price,
        currency: getCurrency(),
        description: `Subscription for ${selectedPaymentPlan.name}`,
        paymentType: 'subscription',
        paymentMethod,
        token,
        returnUrl: window.location.origin + "/courses", // Default return URL
      });

      // Close the main dialog
      onOpenChange(false);
      
      // Check if approval is required
      if (selectedPaymentOption.require_approval) {
        setShowPendingDialog(true);
      } else {
        setShowSuccessDialog(true);
      }
      
    } catch (error) {
      console.error('Subscription payment error:', error);
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('card') || errorMsg.includes('payment method')) {
          setCardElementError(error.message);
        } else {
          setValidationError(error.message);
        }
      } else {
        setValidationError("Payment failed. Please try again.");
      }
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleExploreCourse = () => {
    setShowSuccessDialog(false);
    if (onContinue) {
      onContinue();
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
    <>
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[9999] bg-black/60 animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[9999] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white shadow-xl focus:outline-none flex flex-col"
        >
          <button
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-700 focus:outline-none z-10"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <Cross2Icon className="h-5 w-5" />
          </button>
          
          {/* Header */}
          <div className="bg-primary-50 px-6 py-4 rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Subscription Payment
                </h2>
                <p className="text-gray-600 text-sm">
                  Complete your subscription to access the course
                </p>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6 space-y-6">

          {step === 'summary' ? (
            <>
              {/* Plan Summary Card */}
              {selectedPaymentPlan && (
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Subscription Summary</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Plan:</span>
                      <span className="font-semibold text-gray-900">{selectedPaymentPlan.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Price:</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(selectedPaymentPlan.actual_price, getCurrency())}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Validity:</span>
                      <span className="font-semibold text-gray-900">
                        {selectedPaymentPlan.validity_in_days} days
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Email Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="subscription-email">
                  Your Email Address
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <EnvelopeSimple size={18} />
                  </span>
                  <input
                    id="subscription-email"
                    type="email"
                    className={`border rounded-lg pl-10 pr-4 py-3 text-sm w-full ${
                      validationError ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    }`}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setValidationError('');
                    }}
                    placeholder={validationError ? validationError : "you@example.com"}
                  />
                </div>
                <p className="text-sm text-gray-500">We'll send your receipt to this email address</p>
                {validationError && (
                  <p className="text-sm text-red-600">{validationError}</p>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Payment Summary Card */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Payment Summary</h3>
                  <button
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-1 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors duration-200"
                    onClick={handleEdit}
                  >
                    Edit
                  </button>
                </div>
                {selectedPaymentPlan && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Plan:</span>
                      <span className="font-semibold text-gray-900">{selectedPaymentPlan.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(selectedPaymentPlan.actual_price, getCurrency())}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Email:</span>
                      <span className="font-semibold text-gray-900">{email}</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Card Details */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">💳 Secure Payment</h3>
                <p className="text-gray-600 text-sm">Enter your card details below.</p>
                
                <div className={`border rounded-lg p-4 bg-white ${
                  cardElementError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}>
                  {!cardElementReady && (
                    <div className="flex items-center justify-center h-12 text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Loading payment form...
                    </div>
                  )}
                  <div ref={cardElementRef} className="w-full h-full" />
                </div>
                
                {cardElementError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <strong className="text-red-800">❌ Error</strong>
                    <p className="text-red-700 text-sm mt-1">{cardElementError}</p>
                  </div>
                )}
                
                {/* Payment Buttons */}
                <div className="flex flex-col gap-3 mt-6">
                  <MyButton
                    buttonType="primary"
                    scale="large"
                    layoutVariant="default"
                    className="w-full h-12 text-base flex items-center justify-center gap-2"
                    onClick={handlePaymentAndEnrollment}
                    disabled={processingPayment}
                  >
                    {processingPayment ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing Payment...
                      </>
                    ) : (
                      <>
                        <Lock size={20} /> Subscribe Now
                      </>
                    )}
                  </MyButton>
                  
                  <div className="text-sm text-gray-500 text-center flex items-center justify-center gap-2">
                    <Lock size={16} />
                    Secure payment powered by
                    <span className="font-semibold flex items-center gap-1">
                      <SiStripe size={18} className="text-indigo-600" /> 
                      {paymentGatewayData?.vendor || 'Stripe'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
          </div>
          
          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-lg">
            {step === 'summary' ? (
              <div className="flex gap-3">
                <MyButton
                  buttonType="secondary"
                  scale="large"
                  layoutVariant="default"
                  className="flex-1 h-11"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </MyButton>
                <MyButton
                  buttonType="primary"
                  scale="large"
                  layoutVariant="default"
                  className="flex-1 h-11"
                  onClick={handleContinue}
                >
                  Continue to Payment
                </MyButton>
              </div>
            ) : (
              <MyButton
                buttonType="secondary"
                scale="large"
                layoutVariant="default"
                className="w-full h-11"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </MyButton>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>

    {/* Success Dialog */}
    <EnrollmentSuccessDialog
      open={showSuccessDialog}
      onOpenChange={setShowSuccessDialog}
      courseTitle={enrollmentData?.name || "Course"}
      onExploreCourse={handleExploreCourse}
    />

    {/* Pending Dialog */}
    <EnrollmentPendingDialog
      open={showPendingDialog}
      onOpenChange={setShowPendingDialog}
      courseTitle={enrollmentData?.name || "Course"}
    />
  </>
  );
}; 