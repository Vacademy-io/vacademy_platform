import React, { useState, useEffect, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import { MyButton } from "@/components/design-system/button";
import { LockSimple } from "phosphor-react";
import { SiStripe } from "react-icons/si";
import { EnvelopeSimple } from "phosphor-react";
import { Loader2, Heart } from "lucide-react";
import {
  formatCurrency,
  getCurrencySymbol,
  createStripePaymentMethodWithElements,
  validateAndSanitizeEmail,
} from "../../../routes/study-library/courses/course-details/-services/enrollment-api";
import { Preferences } from "@capacitor/preferences";
import {
  usePaymentDialog,
  getCurrencyWithPriority,
  parsePaymentOptionMetadata,
} from "../../../routes/study-library/courses/course-details/-components/payment-dialogs/payment-utils";
import { processDonationPayment, getUserPlanId } from "../../../services/donation-payment";

export interface DonationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageSessionId: string;
  instituteId: string;
  token: string;
  courseTitle?: string;
  inviteCode?: string;
  mode: 'enrollment' | 'slide-access';
  isUserEnrolled?: boolean; // New prop to check if user is already enrolled
  onEnrollmentSuccess?: () => void;
  onSlideAccessSuccess?: (courseId: string, subjectId: string, moduleId: string, chapterId: string, slideId: string) => void;
  targetSlideDetails?: {
    courseId: string;
    subjectId: string;
    moduleId: string;
    chapterId: string;
    slideId: string;
  };
}

export const DonationDialog: React.FC<DonationDialogProps> = ({
  open,
  onOpenChange,
  packageSessionId,
  instituteId,
  token,
  courseTitle = "Course",
  inviteCode = "default",
  mode,
  isUserEnrolled = false, // Default to false
  onEnrollmentSuccess,
  onSlideAccessSuccess,
  targetSlideDetails,
}) => {
  
  // Log when dialog opens
  React.useEffect(() => {
    // Dialog opened effect
  }, [open, mode, isUserEnrolled, targetSlideDetails, courseTitle, instituteId]);
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

  const [selectedAmount, setSelectedAmount] = useState<number | 'other'>(0);
  const [customAmount, setCustomAmount] = useState('');
  const [step, setStep] = useState<'select' | 'email' | 'payment'>('select');
  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState<string>('');
  const [isApiLoading, setIsApiLoading] = useState<boolean>(false);
  
  // Stripe Elements state
  const [stripe, setStripe] = useState<any>(null);
  const [stripeElements, setStripeElements] = useState<any>(null);
  const [cardElement, setCardElement] = useState<any>(null);
  const [cardElementError, setCardElementError] = useState<string>('');
  const [cardElementReady, setCardElementReady] = useState<boolean>(false);
  const cardElementRef = useRef<HTMLDivElement>(null);

  // Helper function to get real user data from preferences
  const getRealUserData = async () => {
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
  };

  // Prefill email when dialog opens
  useEffect(() => {
    const prefillEmail = async () => {
      if (open && !email) {
        const userData = await getRealUserData();
        if (userData?.email) {
          setEmail(userData.email);
        }
      }
    };
    
    prefillEmail();
  }, [open, email]);

  // Simple loadStripe function
  const loadStripe = async (publishableKey: string) => {
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
            resolve(window.Stripe(publishableKey));
          } else {
            reject(new Error('Stripe failed to load'));
          }
        };
        script.onerror = () => reject(new Error('Failed to load Stripe script'));
        document.head.appendChild(script);
      });
    } catch (error) {
      throw error;
    }
  };

  // Set initial amount when payment option is loaded
  React.useEffect(() => {
    if (selectedPaymentOption && selectedPaymentPlan) {
      try {
        const metadata = parsePaymentOptionMetadata(selectedPaymentOption);
        const donationData = metadata?.donationData || metadata?.config?.donation || {};
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
  }, [selectedPaymentOption, selectedPaymentPlan]);

  // Initialize Stripe Elements when payment gateway data is loaded
  useEffect(() => {
    const initializeStripeElements = async () => {
      if (paymentGatewayData?.publishableKey && cardElementRef.current && !stripe && step === 'payment') {
        try {
          // First load Stripe
          const stripeInstance = await loadStripe(paymentGatewayData.publishableKey);
          setStripe(stripeInstance);
          
          // Then create elements
          const elements = (stripeInstance as any).elements();
          setStripeElements(elements);
          
          // Create card element
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
            try {
              if (cardElementRef.current && card) {
                card.mount(cardElementRef.current);
                setCardElementReady(true);
              }
            } catch (mountError) {
              // Card mount error handled silently
              setCardElementError('Failed to load card input. Please refresh and try again.');
            }
          }, 200);
          
          // Handle card element errors
          card.on('change', (event: any) => {
            if (event.error) {
              setCardElementError(event.error.message);
            } else {
              setCardElementError('');
            }
          });
          
          // Add focus event listener
          card.on('focus', () => {
            // Focus event handled silently
          });
          
          // Add blur event listener
          card.on('blur', () => {
            // Blur event handled silently
          });
        } catch (error) {
          // Stripe initialization error handled silently
          setCardElementError('Failed to load payment form. Please refresh and try again.');
        }
      }
    };

    initializeStripeElements();
  }, [paymentGatewayData, stripe, step, open]);

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
    return getCurrencyWithPriority(selectedPaymentPlan, selectedPaymentOption, enrollmentData);
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
    }
  };

  const handlePaymentAndEnrollment = async () => {
    
    if (!enrollmentData || !paymentGatewayData || !selectedPaymentPlan || !selectedPaymentOption) {
      return;
    }

    setCardElementError('');
    setIsApiLoading(true);

    try {
      // Use Stripe Elements only
      if (!stripe || !cardElement) {
        setCardElementError('Payment form not loaded. Please refresh and try again.');
        return;
      }

      // Validate and sanitize email before sending
      let sanitizedEmail: string;
      try {
        sanitizedEmail = validateAndSanitizeEmail(email);
      } catch (emailError) {
        setCardElementError(emailError instanceof Error ? emailError.message : 'Invalid email format');
        return;
      }

      // Create payment method using Stripe Elements
      const paymentMethod = await createStripePaymentMethodWithElements(stripe, cardElement);
      
      // Get real user data for payment as well
      const userData = await getRealUserData();
      
      // Check if user is already enrolled and use appropriate API
      if (isUserEnrolled) {
        // Use donation payment API for already enrolled users
        const userPlanId = await getUserPlanId(instituteId);
        if (!userPlanId) {
          // Fallback to enrollment API if no user plan ID exists
          await handlePayment({
            email: sanitizedEmail,
            amount: getAmount() as number,
            currency: getCurrency(),
            description: `Donation for ${selectedPaymentPlan.name}`,
            paymentType: 'donation',
            paymentMethod,
            token,
            userData: userData || undefined
          });
        } else {
          await processDonationPayment(instituteId, userPlanId, {
            amount: getAmount() as number,
            email: sanitizedEmail,
            paymentMethodId: paymentMethod.id,
            cardLast4: paymentMethod.card?.last4 || "0000",
            customerId: paymentMethod.customer || "temp_customer_id",
            description: `Donation for ${selectedPaymentPlan.name}`,
          });
        }
      } else {
        // Use enrollment API for new enrollments
        await handlePayment({
          email: sanitizedEmail,
          amount: getAmount() as number,
          currency: getCurrency(),
          description: `Donation for ${selectedPaymentPlan.name}`,
          paymentType: 'donation',
          paymentMethod,
          token,
          userData: userData || undefined // Pass real user data for payment too
        });
      }
      
      // Success - after donation, always redirect to slides if slide details are available
      if (targetSlideDetails) {
        if (onSlideAccessSuccess) {
          onSlideAccessSuccess(
            targetSlideDetails.courseId,
            targetSlideDetails.subjectId,
            targetSlideDetails.moduleId,
            targetSlideDetails.chapterId,
            targetSlideDetails.slideId
          );
        }
      } else if (mode === 'enrollment' && onEnrollmentSuccess) {
        // Fallback to enrollment success if no slide details
        onEnrollmentSuccess();
      }
      onOpenChange(false);
      
    } catch (error) {
      // Provide user-friendly error messages instead of backend technical errors
      let errorMessage = 'Payment failed. Please try again.';
      
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        
        // Handle specific backend errors with user-friendly messages
        if (errorMsg.includes('duplicate key') || errorMsg.includes('already exists')) {
          errorMessage = 'You are already enrolled in this course. Please check your enrolled courses.';
        } else if (errorMsg.includes('enrollment configuration error')) {
          errorMessage = 'Course configuration error. Please refresh the page and try again.';
        } else if (errorMsg.includes('payment gateway error') || errorMsg.includes('payment gateway configuration')) {
          errorMessage = 'Payment system error. Please try again or contact support.';
        } else if (errorMsg.includes('authentication error') || errorMsg.includes('authentication required')) {
          errorMessage = 'Please log in again and try again.';
        } else if (errorMsg.includes('access denied')) {
          errorMessage = 'Access denied. Please check your permissions and try again.';
        } else if (errorMsg.includes('enrolldto') || errorMsg.includes('enrollinviteid')) {
          errorMessage = 'Course data error. Please refresh the page and try again.';
        } else if (errorMsg.includes('network authentication required')) {
          errorMessage = 'Please log in again and try again.';
        } else if (errorMsg.includes('jdbc exception') || errorMsg.includes('sql')) {
          errorMessage = 'System error. Please try again or contact support.';
        } else if (errorMsg.includes('failed to link student')) {
          errorMessage = 'Enrollment error. Please try again or contact support.';
        } else {
          // For any other errors, show a generic message
          errorMessage = 'Something went wrong. Please try again or contact support.';
        }
      }
      
      setCardElementError(errorMessage);
    } finally {
      setIsApiLoading(false);
    }
  };

  const handleEdit = () => {
    if (step === 'payment') {
      setStep('email');
    } else if (step === 'email') {
      setStep('select');
    }
  };

  const handleSkip = async () => {
    // For slide-access mode, just redirect to slides without calling enrollment API
    if (mode === 'slide-access' && targetSlideDetails) {
      if (onSlideAccessSuccess) {
        onSlideAccessSuccess(
          targetSlideDetails.courseId,
          targetSlideDetails.subjectId,
          targetSlideDetails.moduleId,
          targetSlideDetails.chapterId,
          targetSlideDetails.slideId
        );
      }
      onOpenChange(false);
      return;
    }

    // For enrollment mode, proceed with enrollment API call
    setIsApiLoading(true);
    try {
      // Get real user data from preferences
      const userData = await getRealUserData();
      if (!userData) {
        setValidationError('Unable to fetch user data. Please try again.');
        return;
      }

      // Use real user email or fallback to entered email
      let sanitizedEmail: string;
      try {
        const emailToUse = userData.email || email || 'guest@example.com';
        sanitizedEmail = validateAndSanitizeEmail(emailToUse);
      } catch (emailError) {
        setValidationError(emailError instanceof Error ? emailError.message : 'Invalid email format');
        return;
      }
      
      // Use the shared payment function with null payment method to enroll without payment
      await handlePayment({
        email: sanitizedEmail,
        amount: 0, // No payment amount
        currency: getCurrency(),
        description: `Free enrollment for ${selectedPaymentPlan?.name || 'course'}`,
        paymentType: 'free',
        paymentMethod: null, // Pass null to indicate no payment
        token,
        userData: userData || undefined // Pass real user data
      });
      
      // Success - call enrollment success callback
      if (onEnrollmentSuccess) {
        onEnrollmentSuccess();
      }
      onOpenChange(false);
      
    } catch (error) {
      // Provide user-friendly error messages instead of backend technical errors
      let errorMessage = 'Enrollment failed. Please try again.';
      
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        
        // Handle specific backend errors with user-friendly messages
        if (errorMsg.includes('duplicate key') || errorMsg.includes('already exists')) {
          errorMessage = 'You are already enrolled in this course. Please check your enrolled courses.';
        } else if (errorMsg.includes('enrollment configuration error')) {
          errorMessage = 'Course configuration error. Please refresh the page and try again.';
        } else if (errorMsg.includes('authentication error') || errorMsg.includes('authentication required')) {
          errorMessage = 'Please log in again and try again.';
        } else if (errorMsg.includes('access denied')) {
          errorMessage = 'Access denied. Please check your permissions and try again.';
        } else if (errorMsg.includes('enrolldto') || errorMsg.includes('enrollinviteid')) {
          errorMessage = 'Course data error. Please refresh the page and try again.';
        } else if (errorMsg.includes('network authentication required')) {
          errorMessage = 'Please log in again and try again.';
        } else if (errorMsg.includes('jdbc exception') || errorMsg.includes('sql')) {
          errorMessage = 'System error. Please try again or contact support.';
        } else if (errorMsg.includes('failed to link student')) {
          errorMessage = 'Enrollment error. Please try again or contact support.';
        } else {
          // For any other errors, show a generic message
          errorMessage = 'Something went wrong. Please try again or contact support.';
        }
      }
      
      // Show error to user
      setValidationError(errorMessage);
    } finally {
      setIsApiLoading(false);
    }
  };

  // Reset step when dialog is closed
  React.useEffect(() => {
    if (!open) {
      setStep('select');
      // Clean up Stripe elements when dialog closes
      if (cardElement) {
        cardElement.destroy();
        setCardElement(null);
        setCardElementReady(false);
      }
    }
  }, [open, cardElement]);

  // Show loading state
  if (loading) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[9999] bg-black/60 animate-fade-in" />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-1/2 z-[9999] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl focus:outline-none flex flex-col gap-4"
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
            className="fixed left-1/2 top-1/2 z-[9999] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl focus:outline-none flex flex-col gap-4"
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
          className="fixed left-1/2 top-1/2 z-[9999] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl focus:outline-none flex flex-col gap-4"
        >
          <button
            className="absolute right-2 top-2 text-gray-400 hover:text-gray-700 focus:outline-none"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <Cross2Icon className="h-4 w-4" />
          </button>
          
          <h2 className="text-lg font-semibold text-gray-900 flex items-center justify-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            Support Free Learning
          </h2>
          
          {step === 'select' && (
            <p className="text-sm text-gray-600">
              Choose an amount to donate
            </p>
          )}

          {step === 'select' ? (
            <>
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
          ) : step === 'email' ? (
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
                    onClick={handlePaymentAndEnrollment}
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
                    onClick={handleSkip}
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
          )}

          {step !== 'payment' && (
            <div className="flex flex-col gap-2 w-full mt-3">
              <MyButton
                buttonType="primary"
                scale="medium"
                layoutVariant="default"
                className="w-full h-11 text-base"
                onClick={handleContinue}
                disabled={isApiLoading}
              >
                {isApiLoading ? 'Processing...' : 'Continue'}
              </MyButton>
              <MyButton
                buttonType="secondary"
                scale="medium"
                layoutVariant="default"
                className="w-full h-10 text-sm border-none"
                onClick={handleSkip}
                disabled={isApiLoading}
              >
                {isApiLoading ? 'Processing...' : 'Skip'}
              </MyButton>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
