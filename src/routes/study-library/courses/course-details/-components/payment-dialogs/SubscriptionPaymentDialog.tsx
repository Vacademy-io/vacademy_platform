import React, { useState, useEffect, useRef, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import { MyButton } from "@/components/design-system/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { SiStripe } from "react-icons/si";
import { EnvelopeSimple } from "phosphor-react";
import { Loader2, CheckCircle,CreditCard  } from "lucide-react";
import { Preferences } from "@capacitor/preferences";
import {
  formatCurrency,
  handlePaymentForEnrollment,
  createStripePaymentMethodWithElements,
  validateAndSanitizeEmail,
  getPaymentOptions,
  getPaymentPlans,
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
import { PaymentStatusPollingDialog } from "./PaymentStatusPollingDialog";
import { PaymentSuccessDialog } from "./PaymentSuccessDialog";
import { PaymentFailedDialog } from "./PaymentFailedDialog";

// TypeScript declarations for Stripe
declare global {
  interface Window {
    Stripe?: any;
  }
}

export const SubscriptionPaymentDialog: React.FC<PaymentDialogProps> = ({
  open,
  onOpenChange,
  onEnrollmentSuccess,
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
  const [showPaymentStatusDialog, setShowPaymentStatusDialog] = useState(false);
  const [showPaymentSuccessDialog, setShowPaymentSuccessDialog] = useState(false);
  const [showPaymentFailedDialog, setShowPaymentFailedDialog] = useState(false);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlan | null>(null);
  
  // Stripe Elements state
  const [stripe, setStripe] = useState<any>(null);
  const [stripeElements, setStripeElements] = useState<any>(null);
  const [cardElement, setCardElement] = useState<any>(null);
  const [cardElementError, setCardElementError] = useState<string>('');
  const [cardElementReady, setCardElementReady] = useState<boolean>(false);
  const cardElementRef = useRef<HTMLDivElement>(null);

  // Track if we already prefilled the email for this dialog open
  const hasPrefilledEmailRef = useRef<boolean>(false);

  // Helper function to get real user data from preferences
  const getRealUserData = useCallback(async () => {
    try {
      const { value } = await Preferences.get({ key: "StudentDetails" });
      if (!value) {
        return null;
      }

      const studentData = JSON.parse(value);
      // Handle both array and object formats
      const student = Array.isArray(studentData) ? studentData[0] : studentData;
      
      return {
        email: student.email || '',
        username: student.username || '',
        full_name: student.full_name || '',
        mobile_number: student.mobile_number || '',
        date_of_birth: student.date_of_birth || new Date().toISOString(),
        gender: student.gender || 'Not Specified',
        address_line: student.address_line || '',
        city: student.city || '',
        region: student.region || '',
        pin_code: student.pin_code || '',
        profile_pic_file_id: student.face_file_id || '',
        country: student.country || ''
      };
    } catch {
      return null;
    }
  }, []);

  // Prefill email when dialog opens (only once per open)
  useEffect(() => {
    const prefillEmail = async () => {
      if (open && !hasPrefilledEmailRef.current) {
        const userData = await getRealUserData();
        if (userData?.email) {
          // Only set if user hasn't typed anything yet
          setEmail((prev) => (prev ? prev : userData.email));
        }
        hasPrefilledEmailRef.current = true;
      }

      if (!open) {
        // Reset flag when dialog closes so next open can prefill again
        hasPrefilledEmailRef.current = false;
      }
    };

    prefillEmail();
  }, [open, getRealUserData]);

  const getCurrency = (): string => {
    return getCurrencyWithPriority(selectedPlan, selectedPaymentOption, enrollmentData);
  };

  // Simple loadStripe function
  const loadStripe = useCallback(async (publishableKey: string) => {
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
  }, []);

  // Load Stripe when payment gateway data is available
  useEffect(() => {
    const loadStripeInstance = async () => {
      if (paymentGatewayData?.publishableKey && !stripe) {
        try {
          console.log('Loading Stripe instance...');
          const stripeInstance = await loadStripe(paymentGatewayData.publishableKey);
          setStripe(stripeInstance);
        } catch (error) {
          console.error('Failed to load Stripe:', error);
          setCardElementError('Failed to load payment system. Please refresh and try again.');
        }
      }
    };

    loadStripeInstance();
  }, [paymentGatewayData, loadStripe]);

  // Create Stripe Elements when Stripe is loaded
  useEffect(() => {
    if (stripe && !stripeElements) {
      console.log('Creating Stripe Elements...');
      const elements = stripe.elements();
      setStripeElements(elements);
    }
  }, [stripe]);

  // Initialize card element when on payment step
  useEffect(() => {
    const initializeCardElement = () => {
      if (step === 'payment' && stripeElements && cardElementRef.current && !cardElement) {
        console.log('Initializing card element...');
        
        try {
          // Create card element
          const card = stripeElements.create('card', {
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

          // Mount the card element
          card.mount(cardElementRef.current);
          
          // Set up event listeners
          card.on('ready', () => {
            console.log('Card element ready');
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

          // Store the card element
          setCardElement(card);
          
        } catch (error) {
          console.error('Failed to create card element:', error);
          setCardElementError('Failed to create payment form. Please try again.');
        }
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initializeCardElement, 100);
    return () => clearTimeout(timer);
  }, [step, stripeElements, cardElement]);

  // Cleanup when component unmounts or step changes
  useEffect(() => {
    return () => {
      if (cardElement) {
        try {
          cardElement.unmount();
          cardElement.destroy();
        } catch (error) {
          console.log('Error cleaning up card element:', error);
        }
      }
    };
  }, [cardElement]);

  const handleContinue = () => {
    console.log('handleContinue called, current step:', step);
    console.log('selectedPlan:', selectedPlan);
    console.log('email:', email);
    
    if (step === 'plans') {
      if (!selectedPlan) {
        setValidationError('Please select a subscription plan');
        return;
      }
      console.log('Moving from plans to email step');
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
        console.log('Email validation passed, moving to payment step');
        setStep('payment');
      } catch (error) {
        console.log('Email validation failed:', error);
        setValidationError(error instanceof Error ? error.message : 'Please enter a valid email address');
        return;
      }
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
      
      // Get real user data for payment
      const userData = await getRealUserData();
      const userProfileEmail = userData?.email || email;
      
      // Call the enrollment API with payment
      console.log('SubscriptionPaymentDialog - Calling enrollment API', {
        packageSessionId,
        courseTitle: enrollmentData?.name || "Course",
        userEmail: userProfileEmail,
        receiptEmail: sanitizedEmail,
        amount: selectedPlan.actual_price,
        currency: getCurrency(),
        paymentType: 'subscription',
        planName: selectedPlan.name
      });

      await handlePaymentForEnrollment({
        userEmail: userProfileEmail,
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

      console.log('SubscriptionPaymentDialog - Enrollment API call successful, starting payment status polling', {
        packageSessionId,
        courseTitle: enrollmentData?.name || "Course"
      });

      // Close the main dialog
      onOpenChange(false);
      
      // For subscription payments, start payment status polling
      setShowPaymentStatusDialog(true);
      
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

  const handleExploreCourse = async () => {
    setShowSuccessDialog(false);
    if (onEnrollmentSuccess) {
      await onEnrollmentSuccess();
    }
  };

  // Payment status dialog handlers
  const handlePaymentSuccess = (approvalRequired: boolean) => {
    console.log('SubscriptionPaymentDialog - Payment success received', {
      packageSessionId,
      courseTitle: enrollmentData?.name || "Course",
      approvalRequired
    });
    setShowPaymentStatusDialog(false);
    setApprovalRequired(approvalRequired);
    setShowPaymentSuccessDialog(true);
  };

  const handlePaymentFailed = () => {
    console.log('SubscriptionPaymentDialog - Payment failed received', {
      packageSessionId,
      courseTitle: enrollmentData?.name || "Course"
    });
    setShowPaymentStatusDialog(false);
    setShowPaymentFailedDialog(true);
  };

  const handlePaymentStatusClose = () => {
    console.log('SubscriptionPaymentDialog - Payment status dialog closed', {
      packageSessionId,
      courseTitle: enrollmentData?.name || "Course"
    });
    setShowPaymentStatusDialog(false);
  };

  const handlePaymentSuccessClose = () => {
    console.log('SubscriptionPaymentDialog - Payment success dialog closed', {
      packageSessionId,
      courseTitle: enrollmentData?.name || "Course",
      approvalRequired
    });
    setShowPaymentSuccessDialog(false);
    if (!approvalRequired && onEnrollmentSuccess) {
      console.log('SubscriptionPaymentDialog - Calling onEnrollmentSuccess (no approval required)');
      onEnrollmentSuccess();
    }
  };

  const handlePaymentFailedClose = () => {
    console.log('SubscriptionPaymentDialog - Payment failed dialog closed', {
      packageSessionId,
      courseTitle: enrollmentData?.name || "Course"
    });
    setShowPaymentFailedDialog(false);
  };

  const handleTryAgain = () => {
    console.log('SubscriptionPaymentDialog - Try again clicked', {
      packageSessionId,
      courseTitle: enrollmentData?.name || "Course"
    });
    setShowPaymentFailedDialog(false);
    // Reopen the main enrollment dialog
    onOpenChange(true);
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
      // Clean up Stripe elements
      if (cardElement) {
        try {
          cardElement.unmount();
          cardElement.destroy();
        } catch (error) {
          console.log('Error cleaning up card element on close:', error);
        }
        setCardElement(null);
        setCardElementReady(false);
        setCardElementError('');
      }
    }
  }, [open, cardElement]);

  // Debug step changes and cleanup when leaving payment step
  React.useEffect(() => {
    console.log('Step changed to:', step);
    
    // Clean up Stripe elements when leaving payment step
    if (step !== 'payment' && cardElement) {
      try {
        cardElement.unmount();
        cardElement.destroy();
      } catch (error) {
        console.log('Error cleaning up card element on step change:', error);
      }
      setCardElement(null);
      setCardElementReady(false);
      setCardElementError('');
    }
  }, [step, cardElement]);

  // Debug payment gateway data
  React.useEffect(() => {
    console.log('Payment gateway data changed:', paymentGatewayData);
  }, [paymentGatewayData]);

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
          className={`fixed left-1/2 top-1/2 z-[9999] w-full -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-4 sm:p-6 shadow-xl focus:outline-none flex flex-col gap-4 max-h-[90vh] overflow-y-auto ${
            step === 'plans' 
              ? 'max-w-sm sm:max-w-2xl lg:max-w-4xl' 
              : 'max-w-md'
          }`}
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
                    <h3 className="text-sm font-medium text-gray-700">Select your subscription plan</h3>
                   </div>

                 {/* Plan Selection */}
                 {enrollmentData && (
                   <div className="space-y-4">
                   
                   {(() => {
                     const paymentOptions = getPaymentOptions(enrollmentData);
                     console.log('SubscriptionPaymentDialog - All payment options:', paymentOptions);
                     const subscriptionOptions = paymentOptions.filter(option => 
                       option.type === 'SUBSCRIPTION'
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
                           <div 
                             className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto scrollbar-hide" 
                             style={{ 
                               scrollbarWidth: 'none', 
                               msOverflowStyle: 'none'
                             }}
                           >
                             {plans.map((plan) => (
                               <Card
                                 key={plan.id}
                                 className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
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
                     <span className="font-semibold text-blue-700">Payment Summary</span>
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
                   <div className="flex justify-end mt-3">
                     <MyButton
                       buttonType="secondary"
                       scale="small"
                       layoutVariant="default"
                       className="text-xs"
                       onClick={handleBackToPlans}
                     >
                       Change Plan
                     </MyButton>
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
                <p className="text-sm text-gray-500 mt-2">We'll send your subscription details to this email address</p>
              </div>
            </>
          ) : (
            <>
                              {/* Payment Summary */}
                {selectedPlan && (
                 <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                   <div className="mb-2">
                     <span className="font-semibold text-blue-700">Payment Summary</span>
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
                   <div className="flex justify-end mt-3">
                     <MyButton
                       buttonType="secondary"
                       scale="small"
                       layoutVariant="default"
                       className="text-xs"
                  onClick={handleEdit}
                >
                  Edit
                     </MyButton>
                   </div>
              </div>
                )}
              
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-gray-600">Card Details</label>
                </div>
                
                {!paymentGatewayData ? (
                  <div className="border border-orange-300 bg-orange-50 rounded p-4 text-sm">
                    <div className="flex items-center gap-2 text-orange-700 mb-2">
                      <Lock size={16} />
                      <span className="font-medium">Payment Processing Unavailable</span>
                    </div>
                    <p className="text-orange-600 mb-3">
                      Payment processing is currently unavailable. You can still proceed with enrollment and complete payment later.
                    </p>
                    <div className="flex gap-2">
                      <MyButton
                        buttonType="secondary"
                        scale="small"
                        layoutVariant="default"
                        className="flex-1"
                        onClick={retryFetch}
                      >
                        Retry Payment Setup
                      </MyButton>
                      <MyButton
                        buttonType="primary"
                        scale="small"
                        layoutVariant="default"
                        className="flex-1"
                        onClick={handlePaymentAndEnrollment}
                        disabled={processingPayment}
                      >
                        {processingPayment ? 'Processing...' : 'Continue Without Payment'}
                      </MyButton>
                    </div>
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
            <div className={`flex w-full mt-3 ${step === 'plans' ? 'justify-end' : 'justify-center'}`}>
              <MyButton
                buttonType="primary"
                scale="medium"
                layoutVariant="default"
                className={`h-11 text-base ${step === 'plans' ? 'w-1/2' : 'w-full'}`}
                onClick={() => {
                  console.log('Continue button clicked, step:', step, 'selectedPlan:', selectedPlan, 'email:', email);
                  handleContinue();
                }}
                 disabled={(step === 'plans' && !selectedPlan) || (step === 'email' && !email.trim())}
              >
                 {step === 'plans' ? 'Continue' : step === 'email' ? 'Continue to Payment' : 'Subscribe Now'}
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

    {/* Payment Status Polling Dialog */}
    <PaymentStatusPollingDialog
      open={showPaymentStatusDialog}
      onOpenChange={setShowPaymentStatusDialog}
      packageSessionId={packageSessionId}
      courseTitle={enrollmentData?.name || "Course"}
      onPaymentSuccess={handlePaymentSuccess}
      onPaymentFailed={handlePaymentFailed}
      onClose={handlePaymentStatusClose}
    />

    {/* Payment Success Dialog */}
    <PaymentSuccessDialog
      open={showPaymentSuccessDialog}
      onOpenChange={setShowPaymentSuccessDialog}
      courseTitle={enrollmentData?.name || "Course"}
      approvalRequired={approvalRequired}
      onExploreCourse={handleExploreCourse}
      onClose={handlePaymentSuccessClose}
    />

    {/* Payment Failed Dialog */}
    <PaymentFailedDialog
      open={showPaymentFailedDialog}
      onOpenChange={setShowPaymentFailedDialog}
      courseTitle={enrollmentData?.name || "Course"}
      onTryAgain={handleTryAgain}
      onClose={handlePaymentFailedClose}
    />
  </>
  );
}; 