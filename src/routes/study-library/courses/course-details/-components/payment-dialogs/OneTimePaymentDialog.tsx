import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import { EnvelopeSimple } from "phosphor-react";
import { SiStripe } from "react-icons/si";
import { Preferences } from "@capacitor/preferences";
import {
  fetchEnrollmentDetails,
  getPaymentOptions,
  getPaymentPlans,
  formatCurrency,
  handlePaymentForEnrollment,
  fetchPaymentGatewayDetails,
  createStripePaymentMethodWithElements,
  validateAndSanitizeEmail,
  type EnrollmentResponse,
  type PaymentOption,
  type PaymentPlan,
} from "../../-services/enrollment-api";
import { MyButton } from "@/components/design-system/button";
import { EnrollmentSuccessDialog } from "./EnrollmentSuccessDialog";
import { EnrollmentPendingDialog } from "./EnrollmentPendingDialog";
import { EnrollmentPendingApprovalDialog } from "./EnrollmentPendingApprovalDialog";
import { PaymentStatusPollingDialog } from "./PaymentStatusPollingDialog";
import { PaymentSuccessDialog } from "./PaymentSuccessDialog";
import { PaymentFailedDialog } from "./PaymentFailedDialog";

// TypeScript declarations for Stripe
declare global {
  interface Window {
    Stripe?: (publishableKey: string) => any;
  }
}

interface OneTimePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageSessionId: string;
  instituteId: string;
  token: string;
  courseTitle?: string;
  inviteCode?: string;
  onEnrollmentSuccess?: () => void;
}

export const OneTimePaymentDialog: React.FC<OneTimePaymentDialogProps> = ({
  open,
  onOpenChange,
  packageSessionId,
  instituteId,
  token,
  courseTitle = "Course",
  inviteCode = "default",
  onEnrollmentSuccess,
}) => {
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaymentOption, setSelectedPaymentOption] = useState<PaymentOption | null>(null);
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState<PaymentPlan | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [step, setStep] = useState<'select' | 'email' | 'payment'>('select');
  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState<string>('');
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showPendingDialog, setShowPendingDialog] = useState(false);
  const [showPendingApprovalDialog, setShowPendingApprovalDialog] = useState(false);
  const [showPaymentStatusDialog, setShowPaymentStatusDialog] = useState(false);
  const [showPaymentSuccessDialog, setShowPaymentSuccessDialog] = useState(false);
  const [showPaymentFailedDialog, setShowPaymentFailedDialog] = useState(false);
  const [approvalRequired, setApprovalRequired] = useState(false);
  
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
    } catch (error) {
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

  // Fetch enrollment data when dialog opens
  useEffect(() => {
    if (open && packageSessionId) {
      fetchEnrollmentData();
    }
  }, [open, packageSessionId]);

  // Auto-select first payment option and best plan
  useEffect(() => {
    if (enrollmentData && !selectedPaymentOption) {
      const paymentOptions = getPaymentOptions(enrollmentData);
      const oneTimeOptions = paymentOptions.filter(option => 
        option.payment_option_type === 'ONE_TIME'
      );
      
      if (oneTimeOptions.length > 0) {
        const option = oneTimeOptions[0];
        setSelectedPaymentOption(option);
        
        // Auto-select the best plan (prefer discounted plans, then default)
        const plans = getPaymentPlans(option);
        console.log('OneTimePaymentDialog - Available plans:', plans);
        
        if (plans.length > 0) {
          // Remove duplicate plans by ID to prevent React key warnings
          const uniquePlans = plans.filter((plan, index, self) => 
            index === self.findIndex(p => p.id === plan.id)
          );
          
          console.log('OneTimePaymentDialog - Unique plans after deduplication:', uniquePlans);
          
          // Sort plans: discounted plans first, then by price
          const sortedPlans = uniquePlans.sort((a, b) => {
            // Check if plan has discount (elevated_price > actual_price)
            const aHasDiscount = a.elevated_price && a.elevated_price > a.actual_price;
            const bHasDiscount = b.elevated_price && b.elevated_price > b.actual_price;
            
            // Prioritize discounted plans
            if (aHasDiscount && !bHasDiscount) return -1;
            if (!aHasDiscount && bHasDiscount) return 1;
            
            // If both have discount, prefer the one with higher discount percentage
            if (aHasDiscount && bHasDiscount) {
              const aDiscountPercent = ((a.elevated_price - a.actual_price) / a.elevated_price) * 100;
              const bDiscountPercent = ((b.elevated_price - b.actual_price) / b.elevated_price) * 100;
              return bDiscountPercent - aDiscountPercent; // Higher discount first
            }
            
            // If neither has discount, sort by price (lowest first)
            return a.actual_price - b.actual_price;
          });
          
          console.log('OneTimePaymentDialog - Selected plan:', sortedPlans[0]);
          setSelectedPaymentPlan(sortedPlans[0]);
        }
      }
    }
  }, [enrollmentData, selectedPaymentOption]);

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

  // Initialize Stripe Elements when payment gateway data is loaded
  useEffect(() => {
    const initializeStripeElements = async () => {
      if (enrollmentData && cardElementRef.current && step === 'payment') {
        // Clear any previous errors when starting initialization
        setCardElementError('');
        
        try {
          // Fetch payment gateway details
          const paymentGatewayData = await fetchPaymentGatewayDetails(instituteId, 'STRIPE', token);
          
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
  }, [enrollmentData, stripe, stripeElements, step, open, loadStripe, instituteId, token]);

  const fetchEnrollmentData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEnrollmentDetails(inviteCode, instituteId, packageSessionId, token);
      setEnrollmentData(data);
      
      // Auto-select first payment option and first plan
      const paymentOptions = getPaymentOptions(data);
      if (paymentOptions.length > 0) {
        const firstOption = paymentOptions[0];
        setSelectedPaymentOption(firstOption);
        
        // Auto-select the first plan since there's only one
        const plans = getPaymentPlans(firstOption);
        if (plans.length > 0) {
          setSelectedPaymentPlan(plans[0]);
        }
      }
    } catch (err) {
      setError("Failed to load payment options. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!selectedPaymentOption || !selectedPaymentPlan || !enrollmentData) {
      setError("Please select a payment plan.");
      return;
    }

    setProcessingPayment(true);
    setError(null);
    setCardElementError('');
    
    try {
      // Validate Stripe Elements
      if (!stripe || !cardElement || !cardElementReady) {
        setCardElementError('Payment form not loaded. Please refresh and try again.');
        return;
      }

      // Create payment method using Stripe Elements
      const paymentMethod = await createStripePaymentMethodWithElements(stripe, cardElement);
      
      // Fetch payment gateway details (needed for enrollment API)
      const paymentGatewayData = await fetchPaymentGatewayDetails(instituteId, 'STRIPE', token);
      
      // Get real user data for payment
      const userData = await getRealUserData();
      const userProfileEmail = userData?.email || email;
      
      // Call the enrollment API with payment
      console.log('OneTimePaymentDialog - Calling enrollment API', {
        packageSessionId,
        courseTitle,
        userEmail: userProfileEmail,
        receiptEmail: email,
        amount: selectedPaymentPlan.actual_price,
        currency: selectedPaymentPlan.currency || enrollmentData.currency,
        paymentType: 'one-time'
      });

      await handlePaymentForEnrollment({
        userEmail: userProfileEmail,
        receiptEmail: email,
        instituteId,
        packageSessionId,
        enrollmentData,
        paymentGatewayData,
        selectedPaymentPlan,
        selectedPaymentOption,
        amount: selectedPaymentPlan.actual_price,
        currency: selectedPaymentPlan.currency || enrollmentData.currency,
        description: `One-time payment for ${courseTitle}`,
        paymentType: 'one-time',
        paymentMethod,
        token,
      });

      console.log('OneTimePaymentDialog - Enrollment API call successful, starting payment status polling', {
        packageSessionId,
        courseTitle
      });

      // Close the main dialog
      onOpenChange(false);
      
      // For one_time payments, start payment status polling
      setShowPaymentStatusDialog(true);
      
    } catch (err) {
      console.error('One-time payment error:', err);
      
      // Handle specific error cases
      if (err instanceof Error && err.message === 'ENROLLMENT_PENDING_APPROVAL') {
        // User already has a pending enrollment request
        onOpenChange(false);
        setShowPendingApprovalDialog(true);
      } else if (err instanceof Error) {
        const errorMsg = err.message.toLowerCase();
        if (errorMsg.includes('card') || errorMsg.includes('payment method')) {
          setCardElementError(err.message);
        } else {
          setError(err.message);
        }
      } else {
      setError("Payment processing failed. Please try again.");
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
    console.log('OneTimePaymentDialog - Payment success received', {
      packageSessionId,
      courseTitle,
      approvalRequired
    });
    setShowPaymentStatusDialog(false);
    setApprovalRequired(approvalRequired);
    setShowPaymentSuccessDialog(true);
  };

  const handlePaymentFailed = () => {
    console.log('OneTimePaymentDialog - Payment failed received', {
      packageSessionId,
      courseTitle
    });
    setShowPaymentStatusDialog(false);
    setShowPaymentFailedDialog(true);
  };

  const handlePaymentStatusClose = () => {
    console.log('OneTimePaymentDialog - Payment status dialog closed', {
      packageSessionId,
      courseTitle
    });
    setShowPaymentStatusDialog(false);
  };

  const handlePaymentSuccessClose = () => {
    console.log('OneTimePaymentDialog - Payment success dialog closed', {
      packageSessionId,
      courseTitle,
      approvalRequired
    });
    setShowPaymentSuccessDialog(false);
    if (!approvalRequired && onEnrollmentSuccess) {
      console.log('OneTimePaymentDialog - Calling onEnrollmentSuccess (no approval required)');
      onEnrollmentSuccess();
    }
  };

  const handlePaymentFailedClose = () => {
    console.log('OneTimePaymentDialog - Payment failed dialog closed', {
      packageSessionId,
      courseTitle
    });
    setShowPaymentFailedDialog(false);
  };

  const handleTryAgain = () => {
    console.log('OneTimePaymentDialog - Try again clicked', {
      packageSessionId,
      courseTitle
    });
    setShowPaymentFailedDialog(false);
    // Reopen the main enrollment dialog
    onOpenChange(true);
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Loading Payment Options</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-600" />
              <p className="text-gray-600">Loading payment options...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error && !enrollmentData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payment Error</DialogTitle>
          </DialogHeader>
          <div className="text-center py-6">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchEnrollmentData} variant="outline">
              Try Again
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }


  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            One-Time Payment
          </DialogTitle>
          {enrollmentData && (
            <p className="text-sm text-gray-600 text-center">
              Complete your one-time payment to access the course
            </p>
          )}
        </DialogHeader>

        {enrollmentData && step === 'select' && (
          <>
            {/* Plan Summary */}
            {selectedPaymentPlan && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {selectedPaymentOption?.name || selectedPaymentPlan.name}
                  </h3>
                  <div className="flex items-center justify-center gap-3 mb-3">
                    {selectedPaymentPlan.elevated_price && selectedPaymentPlan.elevated_price > selectedPaymentPlan.actual_price && (
                      <div className="text-2xl font-bold text-gray-400 line-through">
                        {formatCurrency(selectedPaymentPlan.elevated_price, selectedPaymentPlan.currency)}
                      </div>
                    )}
                    <div className="text-4xl font-bold text-blue-600">
                      {formatCurrency(selectedPaymentPlan.actual_price, selectedPaymentPlan.currency)}
                                  </div>
                    {selectedPaymentPlan.elevated_price && selectedPaymentPlan.elevated_price > selectedPaymentPlan.actual_price && (
                      <div className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                        {Math.round(((selectedPaymentPlan.elevated_price - selectedPaymentPlan.actual_price) / selectedPaymentPlan.elevated_price) * 100)}% OFF
                                    </div>
                                  )}
                                </div>
                  <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                    One-time payment
                    </div>
                </div>
                </div>
              )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                <p className="text-red-600 text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Action Button */}
            <div className="space-y-4">
              <MyButton
                type="button"
                scale="large"
                buttonType="primary"
                layoutVariant="default"
                className="w-full h-14 text-lg font-semibold"
                disabled={!selectedPaymentOption || !selectedPaymentPlan || processingPayment}
                onClick={() => setStep('email')}
              >
                {processingPayment ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    Continue to Payment
                  </>
                )}
              </MyButton>
              
              <div className="text-center">
                <p className="text-xs text-gray-500">
                  Secure payment • Instant access • 30-day money-back guarantee
                </p>
              </div>
            </div>
          </>
        )}

        {/* Email Step */}
        {step === 'email' && selectedPaymentPlan && (
          <>
            {/* Selected Plan Summary */}
            {selectedPaymentPlan && (
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="mb-2">
                  <span className="font-semibold text-blue-700">Payment Summary</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-blue-600">Plan:</span>
                  <span className="font-semibold text-blue-900">{selectedPaymentOption?.name || selectedPaymentPlan.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-blue-600">Price:</span>
                  <span className="font-semibold text-blue-900">
                    {formatCurrency(selectedPaymentPlan.actual_price, selectedPaymentPlan.currency)}
                  </span>
                </div>
                <div className="flex justify-end mt-3">
                  <MyButton
                    buttonType="secondary"
                    scale="small"
                    layoutVariant="default"
                    className="text-xs"
                    onClick={() => setStep('select')}
                  >
                    Back
                  </MyButton>
                </div>
              </div>
            )}
            
            {/* Email Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="one-time-email">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <EnvelopeSimple size={18} />
                </span>
                <input
                  id="one-time-email"
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
              <p className="text-sm text-gray-500 mt-2">We'll send your receipt and course details to this email address</p>
            </div>

            {/* Continue Button */}
            <div className="flex justify-center">
              <MyButton
                type="button"
                scale="large"
                buttonType="primary"
                layoutVariant="default"
                className="w-full"
                disabled={!email.trim()}
                onClick={() => {
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
                }}
              >
                Continue to Payment
              </MyButton>
            </div>
          </>
        )}

        {/* Payment Step */}
        {step === 'payment' && selectedPaymentPlan && (
          <>
            {/* Payment Summary */}
            {selectedPaymentPlan && (
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="mb-2">
                  <span className="font-semibold text-blue-700">Payment Summary</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-blue-600">Plan:</span>
                  <span className="font-semibold text-blue-900">{selectedPaymentOption?.name || selectedPaymentPlan.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-blue-600">Amount:</span>
                  <span className="font-semibold text-blue-900">
                    {formatCurrency(selectedPaymentPlan.actual_price, selectedPaymentPlan.currency)}
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
                    onClick={() => setStep('email')}
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
                <div className="text-red-600 text-sm mt-2">
                  {cardElementError}
                </div>
              )}
                </div>

            <div className="space-y-4">
                  <MyButton
                    type="button"
                    scale="large"
                    buttonType="primary"
                    layoutVariant="default"
                className="w-full"
                    disabled={processingPayment}
                    onClick={handleEnroll}
                  >
                    {processingPayment ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        Pay Now
                      </>
                    )}
                  </MyButton>

              <div className="text-xs text-gray-500 text-center flex items-center justify-center gap-1">
                <Lock size={14} className="inline-block mr-1" />
                  Secure payment powered by
                <span className="font-semibold flex items-center gap-1 ml-1">
                  <SiStripe size={16} className="text-indigo-600" /> 
                    Stripe
                  </span>
                </div>
          </div>
          </>
        )}
      </DialogContent>
    </Dialog>

      {/* Success Dialog */}
      <EnrollmentSuccessDialog
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        courseTitle={courseTitle}
        onExploreCourse={handleExploreCourse}
      />

      {/* Pending Dialog */}
      <EnrollmentPendingDialog
        open={showPendingDialog}
        onOpenChange={setShowPendingDialog}
        courseTitle={courseTitle}
      />

      {/* Pending Approval Dialog */}
      <EnrollmentPendingApprovalDialog
        open={showPendingApprovalDialog}
        onOpenChange={setShowPendingApprovalDialog}
        courseTitle={courseTitle}
        onClose={() => setShowPendingApprovalDialog(false)}
      />

      {/* Payment Status Polling Dialog */}
      <PaymentStatusPollingDialog
        open={showPaymentStatusDialog}
        onOpenChange={setShowPaymentStatusDialog}
        packageSessionId={packageSessionId}
        courseTitle={courseTitle}
        onPaymentSuccess={handlePaymentSuccess}
        onPaymentFailed={handlePaymentFailed}
        onClose={handlePaymentStatusClose}
      />

      {/* Payment Success Dialog */}
      <PaymentSuccessDialog
        open={showPaymentSuccessDialog}
        onOpenChange={setShowPaymentSuccessDialog}
        courseTitle={courseTitle}
        approvalRequired={approvalRequired}
        onExploreCourse={handleExploreCourse}
        onClose={handlePaymentSuccessClose}
      />

      {/* Payment Failed Dialog */}
      <PaymentFailedDialog
        open={showPaymentFailedDialog}
        onOpenChange={setShowPaymentFailedDialog}
        courseTitle={courseTitle}
        onTryAgain={handleTryAgain}
        onClose={handlePaymentFailedClose}
      />
    </>
  );
}; 