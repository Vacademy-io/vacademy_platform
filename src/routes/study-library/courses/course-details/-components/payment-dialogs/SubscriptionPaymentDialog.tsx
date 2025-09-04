import React, { useState, useEffect, useRef, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import { MyButton } from "@/components/design-system/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Lock } from "lucide-react";
import { SiStripe } from "react-icons/si";
import { EnvelopeSimple } from "phosphor-react";
import { Loader2, CreditCard, CheckCircle } from "lucide-react";
import {
  formatCurrency,
  getCurrencySymbol,
  handlePaymentForEnrollment,
  fetchPaymentGatewayDetails,
  createStripePaymentMethodWithElements,
  validateAndSanitizeEmail,
  getPaymentOptions,
  getPaymentPlans,
  type PaymentOption,
  type PaymentPlan,
} from "../../-services/enrollment-api";
import {
  usePaymentDialog,
  getCurrencyWithPriority,
  type PaymentDialogProps,
} from "./payment-utils";
import { EnrollmentSuccessDialog } from "./EnrollmentSuccessDialog";
import { EnrollmentPendingDialog } from "./EnrollmentPendingDialog";
import { EnrollmentPendingApprovalDialog } from "./EnrollmentPendingApprovalDialog";

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

  const [step, setStep] = useState<'plans' | 'email' | 'payment'>('plans');
  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState<string>('');
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showPendingDialog, setShowPendingDialog] = useState(false);
  const [showPendingApprovalDialog, setShowPendingApprovalDialog] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlan | null>(null);
  
  // Stripe Elements state
  const [stripe, setStripe] = useState<any>(null);
  const [stripeElements, setStripeElements] = useState<any>(null);
  const [cardElement, setCardElement] = useState<any>(null);
  const [cardElementError, setCardElementError] = useState<string>('');
  const [cardElementReady, setCardElementReady] = useState<boolean>(false);
  const cardElementRef = useRef<HTMLDivElement>(null);

  const getCurrency = (): string => {
    return getCurrencyWithPriority(selectedPlan, selectedPaymentOption, enrollmentData);
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
    if (step === 'plans') {
      if (!selectedPlan) {
        setValidationError('Please select a subscription plan');
        return;
      }
      setStep('email');
    } else if (step === 'email') {
      // Validate email before proceeding to payment
      if (!email || !email.trim()) {
        setValidationError('Please enter your email address');
        return;
      }
      
      // Enhanced email validation and sanitization
      try {
        const sanitizedEmail = validateAndSanitizeEmail(email);
        setEmail(sanitizedEmail);
      } catch (error) {
        setValidationError(error instanceof Error ? error.message : 'Please enter a valid email address');
        return;
      }
      
      setStep('payment');
    } else if (step === 'payment') {
      handlePaymentAndEnrollment();
    }
  };

  const handlePaymentAndEnrollment = async () => {
    if (!selectedPlan || !selectedPaymentOption || !enrollmentData) {
      return;
    }

    // Check if payment gateway is available
    if (!paymentGatewayData) {
      setValidationError('Payment processing is currently unavailable. Please contact support.');
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
        selectedPaymentPlan: selectedPlan,
        selectedPaymentOption,
        amount: selectedPlan.actual_price,
        currency: getCurrency(),
        description: `Subscription for ${selectedPlan.name}`,
        paymentType: 'subscription',
        paymentMethod,
        token,
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
      
      // Handle specific error cases
      if (error instanceof Error && error.message === 'ENROLLMENT_PENDING_APPROVAL') {
        // User already has a pending enrollment request
        onOpenChange(false);
        setShowPendingApprovalDialog(true);
      } else if (error instanceof Error) {
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
    setStep('email');
  };

  const handleBackToPlans = () => {
    setStep('plans');
  };

  // Reset step when dialog is closed
  React.useEffect(() => {
    if (!open) {
      setStep('plans');
      setSelectedPlan(null);
      setEmail('');
      setValidationError('');
    }
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
            <DialogPrimitive.Title className="sr-only">Loading Subscription Options</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Please wait while we load the available subscription plans for this course.</DialogPrimitive.Description>
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
            <DialogPrimitive.Title className="sr-only">Subscription Error</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">There was an error loading the subscription options. Please try again.</DialogPrimitive.Description>
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
          className="fixed left-1/2 top-1/2 z-[9999] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl focus:outline-none flex flex-col gap-4"
        >
          <DialogPrimitive.Title className="sr-only">Subscription Payment</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Choose a subscription plan and complete your payment to enroll in this course.</DialogPrimitive.Description>
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

           {step === 'plans' ? (
             <Card className="shadow-lg border bg-white w-full">
               <CardContent className="p-5 sm:p-6">
                 {/* Small Subheading */}
                 <div className="mb-4">
                   <h3 className="text-sm font-medium text-gray-700">Choose your plan</h3>
                 </div>

                 {/* Plan Selection */}
                 {enrollmentData && (
                   <div className="space-y-4">
                   
                   {(() => {
                     const paymentOptions = getPaymentOptions(enrollmentData);
                     console.log('SubscriptionPaymentDialog - All payment options:', paymentOptions);
                     const subscriptionOptions = paymentOptions.filter(option => 
                       option.payment_option_type === 'SUBSCRIPTION' || option.type === 'SUBSCRIPTION'
                     );
                     console.log('SubscriptionPaymentDialog - Subscription options:', subscriptionOptions);
                     
                     if (subscriptionOptions.length === 0) {
                       return (
                         <div className="text-center py-8">
                           <p className="text-gray-600">No subscription plans available at the moment.</p>
                         </div>
                       );
                     }
                     
                     return subscriptionOptions.map((option) => {
                       const plans = getPaymentPlans(option);
                       console.log(`SubscriptionPaymentDialog - Plans for option ${option.name}:`, plans);
                       return (
                         <div key={option.id} className="space-y-4">
                           <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                             {plans.map((plan) => (
                               <Card
                                 key={plan.id}
                                 className={`cursor-pointer transition-all duration-200 hover:shadow-md min-w-[280px] flex-shrink-0 ${
                                   selectedPlan?.id === plan.id
                                     ? "ring-2 ring-blue-500 bg-blue-50"
                                     : "hover:bg-gray-50"
                                 }`}
                                 onClick={() => {
                                   setSelectedPlan(plan);
                                   setValidationError('');
                                 }}
                               >
                                 <CardContent className="p-6">
                                 {/* Plan Name */}
                                 <h4 className="text-xl font-bold text-gray-900 mb-2">
                                   {plan.name}
                                 </h4>

                                 {/* Price Information */}
                                 <div className="mb-3">
                                   <div className="text-xl font-bold text-primary-500">
                                     {formatCurrency(plan.actual_price, plan.currency)}
                                     {plan.validity_in_days > 0 && (
                                       <span className="text-sm font-normal text-gray-500">
                                         &nbsp;/ {plan.validity_in_days} days
                                       </span>
                                     )}
                                   </div>
                                   {plan.elevated_price > plan.actual_price && (
                                     <div className="text-sm text-gray-500 line-through">
                                       {formatCurrency(plan.elevated_price, plan.currency)}
                                     </div>
                                   )}
                                 </div>

                                 {/* Description */}
                                 {plan.description && (
                                   <p className="text-sm text-gray-600 mb-3">
                                     {plan.description}
                                   </p>
                                 )}

                                 {/* Features */}
                                 {plan.feature_json && (
                                   <div className="space-y-2">
                                     {(() => {
                                       try {
                                         const features = JSON.parse(plan.feature_json);
                                         return Array.isArray(features) ? features.slice(0, 4).map((feature: string, index: number) => (
                                           <div key={index} className="flex items-center space-x-2">
                                             <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                             <span className="text-sm text-gray-700">{feature}</span>
                                           </div>
                                         )) : [];
                                       } catch {
                                         return [
                                           <div key="default" className="flex items-center space-x-2">
                                             <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                             <span className="text-sm text-gray-700">Course access included</span>
                                           </div>
                                         ];
                                       }
                                     })()}
                                   </div>
                                 )}
                                 </CardContent>
                               </Card>
                             ))}
                           </div>
                         </div>
                       );
                     });
                   })()}
                   
                   {validationError && (
                     <div className="text-center">
                       <p className="text-red-600 text-sm">{validationError}</p>
                     </div>
                   )}
                                  </div>
               )}
               </CardContent>
             </Card>
           ) : step === 'email' ? (
            <>
              {/* Selected Plan Summary */}
              {selectedPlan && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="mb-2">
                    <span className="font-semibold text-blue-700">Selected Plan</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-blue-600">Plan:</span>
                    <span className="font-semibold text-blue-900">{selectedPlan.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-blue-600">Price:</span>
                    <span className="font-semibold text-blue-900">
                      {formatCurrency(selectedPlan.actual_price, getCurrency())}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-blue-600">Validity:</span>
                    <span className="font-semibold text-blue-900">
                      {selectedPlan.validity_in_days} days
                    </span>
                  </div>
                  <div className="flex justify-end mt-2">
                    <button
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                      onClick={handleBackToPlans}
                    >
                      Change Plan
                    </button>
                  </div>
                </div>
              )}
              
              {/* Email Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="subscription-email">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <EnvelopeSimple size={18} />
                  </span>
                  <input
                    id="subscription-email"
                    type="email"
                    className={`border rounded-lg pl-10 pr-4 py-3 text-sm w-full h-12 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setValidationError('');
                    }}
                    placeholder="you@example.com"
                  />
                </div>
                {validationError && (
                  <p className="text-red-600 text-xs mt-1">{validationError}</p>
                )}
                <p className="text-sm text-gray-500 mt-2">We'll send your receipt and subscription details to this email address</p>
              </div>
            </>
          ) : (
            <>
              {/* Payment Summary */}
              {selectedPlan && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-blue-700">Payment Summary</span>
                <button
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  onClick={handleEdit}
                >
                  Edit
                </button>
              </div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-blue-600">Plan:</span>
                    <span className="font-semibold text-blue-900">{selectedPlan.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-blue-600">Amount:</span>
                    <span className="font-semibold text-blue-900">
                      {formatCurrency(selectedPlan.actual_price, getCurrency())}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-blue-600">Email:</span>
                    <span className="font-semibold text-blue-900">{email}</span>
                  </div>
                </div>
              )}
              
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-gray-600">Card Details</label>
                </div>
                
                {!paymentGatewayData ? (
                  <div className="border border-orange-300 bg-orange-50 rounded p-4 text-sm">
                    <div className="flex items-center gap-2 text-orange-700">
                      <Lock size={16} />
                      <span className="font-medium">Payment Processing Unavailable</span>
                    </div>
                    <p className="text-orange-600 mt-1">
                      Payment processing is currently unavailable. Please contact support for assistance.
                    </p>
                  </div>
                ) : (
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
                )}
                
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
                    onClick={handlePaymentAndEnrollment}
                    disabled={processingPayment || !paymentGatewayData}
                  >
                    {processingPayment ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                    <Lock size={18} /> Subscribe Now
                      </>
                    )}
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

                                           {(step === 'plans' || step === 'email') && (
            <div className="flex flex-col gap-2 w-full mt-3">
              <MyButton
                buttonType="primary"
                scale="medium"
                layoutVariant="default"
                className="w-full h-11 text-base"
                onClick={handleContinue}
                 disabled={(step === 'plans' && !selectedPlan) || (step === 'email' && !email.trim())}
              >
                 {step === 'plans' ? 'Continue' : step === 'email' ? 'Continue to Payment' : 'Subscribe Now'}
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

    {/* Pending Approval Dialog */}
    <EnrollmentPendingApprovalDialog
      open={showPendingApprovalDialog}
      onOpenChange={setShowPendingApprovalDialog}
      courseTitle={enrollmentData?.name || "Course"}
      onClose={() => setShowPendingApprovalDialog(false)}
    />
  </>
  );
}; 