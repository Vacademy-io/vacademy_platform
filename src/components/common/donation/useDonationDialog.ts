import { useState, useEffect, useRef, useCallback } from "react";
import { Preferences } from "@capacitor/preferences";
import {
  formatCurrency,
  getCurrencySymbol,
  createStripePaymentMethodWithElements,
  validateAndSanitizeEmail,
} from "../../../routes/study-library/courses/course-details/-services/enrollment-api";
import {
  usePaymentDialog,
  getCurrencyWithPriority,
  parsePaymentOptionMetadata,
} from "../../../routes/study-library/courses/course-details/-components/payment-dialogs/payment-utils";
import { processDonationPayment, getUserPlanId } from "../../../services/donation-payment";

interface UseDonationDialogProps {
  open: boolean;
  packageSessionId: string;
  instituteId: string;
  token: string;
  inviteCode?: string;
  mode: 'enrollment' | 'slide-access';
  isUserEnrolled?: boolean;
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

export const useDonationDialog = ({
  open,
  packageSessionId,
  instituteId,
  token,
  inviteCode = "default",
  mode,
  isUserEnrolled = false,
  onEnrollmentSuccess,
  onSlideAccessSuccess,
  targetSlideDetails,
}: UseDonationDialogProps) => {
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

  // State management
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
  }, []);

  // Initialize selectedAmount to 0 so user must make explicit choice
  useEffect(() => {
    if (selectedPaymentOption && selectedPaymentPlan && selectedAmount === 0) {
      // Don't auto-select any amount - user must choose explicitly
      setSelectedAmount(0);
    }
  }, [selectedPaymentOption, selectedPaymentPlan, selectedAmount]);

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
            try {
              if (cardElementRef.current && card) {
                card.mount(cardElementRef.current);
                setCardElementReady(true);
                // Clear any errors when successfully mounted
                setCardElementError('');
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
  }, [paymentGatewayData, stripe, stripeElements, step, open, loadStripe]);

  // Parse donation metadata from payment option
  const getDonationMetadata = useCallback(() => {
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
  }, [selectedPaymentOption]);

  // Get donation amounts from metadata
  const getDonationAmounts = useCallback((): number[] => {
    const metadata = getDonationMetadata();
    return metadata.suggestedAmounts;
  }, [getDonationMetadata]);

  // Get minimum amount from metadata
  const getMinimumAmount = useCallback((): number => {
    const metadata = getDonationMetadata();
    return metadata.minimumAmount;
  }, [getDonationMetadata]);

  // Get the correct currency with priority: payment plan > metadata > main response
  const getCurrency = useCallback((): string => {
    return getCurrencyWithPriority(selectedPaymentPlan, selectedPaymentOption, enrollmentData);
  }, [selectedPaymentPlan, selectedPaymentOption, enrollmentData]);

  const getAmount = useCallback(() => {
    if (selectedAmount === 'other') {
      const val = parseFloat(customAmount);
      return isNaN(val) ? '' : val;
    }
    return selectedAmount;
  }, [selectedAmount, customAmount]);

  // Check if the current step is valid (only for email step, amount step is always valid until clicked)
  const isCurrentStepValid = useCallback(() => {
    if (step === 'email') {
      return email && email.trim() !== '';
    }
    
    return true; // Amount selection and payment steps are always valid until user clicks Continue
  }, [step, email]);

  const handleContinue = useCallback(() => {
    if (step === 'select') {
      // Clear any previous validation errors
      setValidationError('');
      
      // First, check if any amount is selected
      if (selectedAmount === 0 || selectedAmount === null || selectedAmount === undefined) {
        setValidationError('⚠️ Please select or enter a donation amount to continue');
        return;
      }
      
      // Validate minimum amount
      const minAmount = getMinimumAmount();
      const currentAmount = selectedAmount === 'other' ? parseFloat(customAmount) : selectedAmount;
      
      if (selectedAmount === 'other') {
        if (!customAmount || customAmount.trim() === '') {
          setValidationError('Please enter a donation amount');
          return;
        }
        if (isNaN(currentAmount) || currentAmount <= 0) {
          setValidationError('Please enter a valid donation amount');
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
  }, [step, selectedAmount, customAmount, email, getMinimumAmount, getCurrency]);

  const handlePaymentAndEnrollment = useCallback(async () => {
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
      const userProfileEmail = userData?.email || sanitizedEmail;
      
      // Check if user is already enrolled and use appropriate API
      if (isUserEnrolled) {
        // Use donation payment API for already enrolled users
        const userPlanId = await getUserPlanId(instituteId);
        if (!userPlanId) {
          // Fallback to enrollment API if no user plan ID exists
          await handlePayment({
            userEmail: userProfileEmail,
            receiptEmail: sanitizedEmail,
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
          userEmail: userProfileEmail,
          receiptEmail: sanitizedEmail,
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
      } else if (mode === 'enrollment') {
        // For enrollment mode, prioritize slide access success for auto navigation
        if (onSlideAccessSuccess) {
          onSlideAccessSuccess('', '', '', '', ''); // Empty strings since we don't have slide details
        } else if (onEnrollmentSuccess) {
          // Fallback to enrollment success if no slide access success
          await onEnrollmentSuccess();
        }
      }
      
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
  }, [
    enrollmentData,
    paymentGatewayData,
    selectedPaymentPlan,
    selectedPaymentOption,
    stripe,
    cardElement,
    email,
    getRealUserData,
    isUserEnrolled,
    instituteId,
    handlePayment,
    getAmount,
    getCurrency,
    targetSlideDetails,
    onSlideAccessSuccess,
    mode,
    onEnrollmentSuccess,
    token,
  ]);

  const handleEdit = useCallback(() => {
    if (step === 'payment') {
      setStep('email');
    } else if (step === 'email') {
      setStep('select');
    }
  }, [step]);

  const handleSkip = useCallback(async () => {
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
        userEmail: userData.email || sanitizedEmail,
        receiptEmail: sanitizedEmail,
        amount: 0, // No payment amount
        currency: getCurrency(),
        description: `Free enrollment for ${selectedPaymentPlan?.name || 'course'}`,
        paymentType: 'free',
        paymentMethod: null, // Pass null to indicate no payment
        token,
        userData: userData || undefined // Pass real user data
      });
      
      // Success - call appropriate callback based on available callbacks
      if (onSlideAccessSuccess) {
        // If slide access success is available, use it for auto navigation
        onSlideAccessSuccess('', '', '', '', ''); // Empty strings since we don't have slide details
      } else if (onEnrollmentSuccess) {
        // Fallback to enrollment success if no slide access success
        onEnrollmentSuccess();
      }
      
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
  }, [
    mode,
    targetSlideDetails,
    onSlideAccessSuccess,
    getRealUserData,
    email,
    handlePayment,
    getCurrency,
    selectedPaymentPlan,
    token,
    onEnrollmentSuccess,
  ]);

  // Reset step when dialog is closed
  useEffect(() => {
    if (!open) {
      setStep('select');
      // Clean up Stripe elements when dialog closes
      if (cardElement) {
        try {
          cardElement.destroy();
        } catch (destroyError) {
          // Ignore destroy errors
        }
        setCardElement(null);
        setCardElementReady(false);
      }
      // Reset Stripe state to allow fresh initialization on next open
      setStripe(null);
      setStripeElements(null);
    }
  }, [open]);

  return {
    // Payment dialog data
    enrollmentData,
    paymentGatewayData,
    loading,
    error,
    selectedPaymentOption,
    selectedPaymentPlan,
    retryFetch,
    
    // State
    selectedAmount,
    customAmount,
    step,
    email,
    validationError,
    isApiLoading,
    
    // Stripe state
    cardElementRef,
    cardElementError,
    cardElementReady,
    
    // Computed values
    donationAmounts: getDonationAmounts(),
    minimumAmount: getMinimumAmount(),
    currency: getCurrency(),
    amount: getAmount(),
    
    // Actions
    setSelectedAmount,
    setCustomAmount,
    setEmail,
    setValidationError,
    handleContinue,
    handlePaymentAndEnrollment,
    handleEdit,
    handleSkip,
    isCurrentStepValid,
  };
};
