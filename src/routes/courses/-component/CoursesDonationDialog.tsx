import React, { useState, useEffect, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import { MyButton } from "@/components/design-system/button";
import { SiStripe } from "react-icons/si";
import { Mail, Loader2, Heart, CheckCircle } from "lucide-react";
import { LockSimple } from "phosphor-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { processDonationPayment, createDonationRequest } from "../-services/donation-api";

interface CoursesDonationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instituteId: string;
}

// Stripe configuration - you'll need to get this from your backend
const STRIPE_PUBLISHABLE_KEY = "pk_test_..."; // Replace with actual key

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

// Payment form component
const PaymentForm: React.FC<{
  amount: number;
  email: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  instituteId: string;
  onCardDetailsChange: (details: { paymentMethodId: string; last4: string; customerId: string }) => void;
}> = ({ amount, email, onSuccess, onError, instituteId, onCardDetailsChange }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardError, setCardError] = useState<string>("");
  const [cardComplete, setCardComplete] = useState(false);

  const handleSubmit = async () => {
    console.log('PaymentForm: handleSubmit called', { stripe: !!stripe, elements: !!elements });
    
    if (!stripe || !elements) {
      onError("Stripe is not loaded. Please refresh the page.");
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      onError("Card element not found.");
      return;
    }

    setIsProcessing(true);
    setCardError("");

    try {
      // Create payment method
      const { error: paymentMethodError, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
        billing_details: {
          email: email,
        },
      });

      if (paymentMethodError) {
        setCardError(paymentMethodError.message || "Payment method creation failed.");
        setIsProcessing(false);
        return;
      }

      // Create donation request data
      const donationData = createDonationRequest(
        amount,
        email,
        paymentMethod.id,
        paymentMethod.card?.last4 || "",
        "" // customerId - you might need to create/retrieve this
      );

      // Process donation payment
      const result = await processDonationPayment(instituteId, donationData);
      
      if (result.success || result.status === "succeeded") {
        onSuccess();
      } else {
        throw new Error(result.message || "Payment processing failed");
      }
    } catch (error) {
      console.error("Payment error:", error);
      onError(error instanceof Error ? error.message : "Payment failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <CardElement
        options={{
          style: {
            base: {
              fontSize: "16px",
              color: "#374151",
              fontFamily: "system-ui, -apple-system, sans-serif",
              "::placeholder": {
                color: "#9CA3AF",
              },
            },
            invalid: {
              color: "#DC2626",
            },
          },
        }}
        onChange={(event) => {
          setCardComplete(event.complete);
          if (event.error) {
            setCardError(event.error.message);
          } else {
            setCardError("");
          }
          
          // If card is complete, create payment method to get details
          if (event.complete && stripe && elements) {
            const cardElement = elements.getElement(CardElement);
            if (cardElement) {
              stripe.createPaymentMethod({
                type: 'card',
                card: cardElement,
              }).then(({ paymentMethod, error }) => {
                if (paymentMethod && !error) {
                  onCardDetailsChange({
                    paymentMethodId: paymentMethod.id,
                    last4: paymentMethod.card?.last4 || "",
                    customerId: paymentMethod.customer || ""
                  });
                }
              });
            }
          }
        }}
      />
      {cardError && (
        <div className="text-red-600 text-xs mb-2 mt-1">
          {cardError}
        </div>
      )}
    </>
  );
};

// Main donation dialog component
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
  const [cardDetails, setCardDetails] = useState<{ paymentMethodId: string; last4: string; customerId: string } | null>(null);

  const suggestedAmounts = [5, 10, 25, 50, 100];
  const minAmount = 1;

  useEffect(() => {
    if (open) {
      setIsInitializing(true);
      // Simulate a brief loading state for better UX
      setTimeout(() => {
        setStep('select');
        setSelectedAmount(0);
        setCustomAmount('');
        setEmail('');
        setValidationError('');
        setIsInitializing(false);
      }, 100);
    }
  }, [open]);

  const handleAmountSelect = (amount: number | 'other') => {
    setSelectedAmount(amount);
    if (amount !== 'other') {
      setCustomAmount('');
    }
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount('other');
  };

  const handleContinue = () => {
    if (step === 'select') {
      let amount = selectedAmount === 'other' ? parseFloat(customAmount) : selectedAmount;
      
      // If no amount selected, use minimum amount
      if (!amount || amount <= 0) {
        amount = minAmount;
        setSelectedAmount(minAmount);
      }
      
      if (selectedAmount === 'other' && parseFloat(customAmount) < minAmount) {
        setValidationError(`Minimum donation amount is $${minAmount}`);
        return;
      }
      if (amount > 10000) {
        setValidationError('Maximum donation amount is $10,000');
        return;
      }
      setStep('email');
      setValidationError('');
    } else if (step === 'email') {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setValidationError('Please enter a valid email address');
        return;
      }
      setStep('payment');
      setValidationError('');
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
    setStep('success');
  };

  const handlePaymentError = (error: string) => {
    toast.error(error, {
      className: "error-toast",
      duration: 4000,
    });
    // Reset to payment step to allow retry
    setStep('payment');
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after a delay to allow animation to complete
    setTimeout(() => {
      setStep('select');
      setSelectedAmount(0);
      setCustomAmount('');
      setEmail('');
      setValidationError('');
    }, 300);
  };

  const getCurrentAmount = () => {
    if (selectedAmount === 'other') {
      return parseFloat(customAmount) || 0;
    }
    return selectedAmount;
  };

  if (!open) return null;

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
            <div className="text-center space-y-6">
                             <div className="flex justify-center">
                 <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                   <CheckCircle className="w-12 h-12 text-green-500" />
                 </div>
               </div>
              <div className="space-y-3">
                <h2 className="text-3xl font-bold text-gray-900">Thank You!</h2>
                <p className="text-gray-600 text-lg">
                  Your generous donation of <span className="font-semibold text-green-600">${getCurrentAmount()}</span> has been received.
                </p>
                <p className="text-gray-500">
                  Thank you for supporting free learning and making education accessible to everyone!
                </p>
              </div>
              <MyButton
                onClick={handleClose}
                className="w-full"
                scale="large"
                buttonType="primary"
                layoutVariant="default"
              >
                Close
              </MyButton>
            </div>
          ) : (
            <>
              {/* Header - show in all steps */}
              <div className="mb-6">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Heart className="w-6 h-6 text-red-500" />
                  <h2 className="text-xl font-bold text-gray-900">
                    Support Free Learning
                  </h2>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  {step === 'select' && 'Choose an amount to donate'}
                </p>
              </div>

              {step === 'select' && (
                <>
                  <div className="grid grid-cols-2 gap-3 justify-center mb-2">
                    {suggestedAmounts.map((amount) => (
                      <div
                        key={amount}
                        className={`h-11 min-w-[90px] flex items-center justify-center rounded border cursor-pointer select-none text-sm font-medium transition-colors duration-200 ${
                          selectedAmount === amount ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-800 border-gray-300 hover:bg-blue-50'
                        }`}
                        onClick={() => handleAmountSelect(amount)}
                        role="button"
                        tabIndex={0}
                      >
                        ${amount}
                      </div>
                    ))}
                    {selectedAmount !== 'other' && (
                      <div
                        className={`h-11 w-full flex items-center justify-center rounded border cursor-pointer select-none text-sm font-medium transition-colors duration-200 bg-white text-gray-800 border-gray-300 hover:bg-blue-50`}
                        onClick={() => handleAmountSelect('other')}
                        role="button"
                        tabIndex={0}
                        style={{ gridColumn: 'span 2' }}
                      >
                        Other
                      </div>
                    )}
                    {selectedAmount === 'other' && (
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        max="10000"
                        placeholder="$ (min $1)"
                        className="border rounded p-2 text-xs w-full mt-1 mb-1 col-span-2 h-12"
                        value={customAmount}
                        onChange={(e) => handleCustomAmountChange(e.target.value)}
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
              )}

              {step === 'email' && (
                <>
                  <div className="mb-2 bg-white border border-neutral-300 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-700">Donation Summary</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-semibold text-gray-900">${getCurrentAmount()}</span>
                    </div>
                    <button
                      className="text-xs font-medium ml-auto block rounded border border-neutral-300 bg-white text-neutral-600 px-3 py-1 focus:outline-none transition-colors duration-200 hover:bg-blue-50/50 hover:border-blue-300"
                      onClick={handleBack}
                      style={{ boxShadow: 'none', textDecoration: 'none' }}
                    >
                      Edit
                    </button>
                  </div>
                  <div className="mb-2">
                    <label className="block text-xs text-gray-600 mb-1" htmlFor="donation-email">Your Email</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <Mail size={16} />
                      </span>
                      <input
                        id="donation-email"
                        type="email"
                        className={`border rounded pl-9 p-2 text-xs w-full h-10 ${
                          validationError ? 'border-red-500 bg-red-50' : ''
                        }`}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={validationError ? validationError : "you@example.com"}
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">We'll send your receipt to this email address</p>
                  </div>
                </>
              )}

              {/* Continue button - show for select and email steps */}
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

              {step === 'payment' && (
                <>
                  <div className="mb-2 bg-white border border-neutral-300 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-700">Donation Summary</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-semibold text-gray-900">${getCurrentAmount()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Email:</span>
                      <span className="font-semibold text-gray-900">{email}</span>
                    </div>
                    <button
                      className="text-xs font-medium ml-auto block rounded border border-neutral-300 bg-white text-neutral-600 px-3 py-1 focus:outline-none transition-colors duration-200 hover:bg-blue-50/50 hover:border-blue-300"
                      onClick={handleBack}
                      style={{ boxShadow: 'none', textDecoration: 'none' }}
                    >
                      Edit
                    </button>
                  </div>
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs text-gray-600">Card Details</label>
                    </div>
                    
                    {/* Card input field only */}
                    <div className="border rounded p-3 text-sm w-full min-h-[48px] bg-gray-50">
                      <Elements stripe={stripePromise}>
                        <PaymentForm
                          amount={getCurrentAmount()}
                          email={email}
                          onSuccess={handlePaymentSuccess}
                          onError={handlePaymentError}
                          instituteId={instituteId}
                          onCardDetailsChange={setCardDetails}
                        />
                      </Elements>
                    </div>
                  </div>

                  {/* Donation button outside the card input field */}
                  <div className="flex flex-col gap-2 w-full mt-3">
                    <MyButton
                      buttonType="primary"
                      scale="medium"
                      layoutVariant="default"
                      className="w-full h-11 text-base flex items-center justify-center gap-2"
                      onClick={async () => {
                        try {
                          // Call the API directly
                          const response = await fetch(`https://backend-stage.vacademy.io/admin-core-service/open/payments/pay?instituteId=${instituteId}`, {
                            method: 'POST',
                            headers: {
                              'accept': '*/*',
                              'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
                              'cache-control': 'no-cache',
                              'content-type': 'application/json',
                              'origin': 'https://backend-stage.vacademy.io',
                              'pragma': 'no-cache',
                              'referer': 'https://backend-stage.vacademy.io/admin-core-service/swagger-ui/index.html',
                              'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                              'sec-ch-ua-mobile': '?0',
                              'sec-ch-ua-platform': '"Windows"',
                              'sec-fetch-dest': 'empty',
                              'sec-fetch-mode': 'cors',
                              'sec-fetch-site': 'same-origin',
                              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
                            },
                            body: JSON.stringify({
                              amount: getCurrentAmount(),
                              currency: "USD",
                              description: "Donation for free learning",
                              charge_automatically: true,
                              order_id: `donation_${Date.now()}`,
                              institute_id: instituteId,
                              email: email,
                              vendor: "stripe",
                              vendor_id: "stripe_payment",
                              stripe_request: {
                                payment_method_id: cardDetails?.paymentMethodId || "pm_donation",
                                card_last4: cardDetails?.last4 || "1234",
                                customer_id: cardDetails?.customerId || "cus_donation"
                              },
                              razorpay_request: {
                                customer_id: "",
                                contact: "",
                                email: email
                              },
                              pay_pal_request: {},
                              include_pending_items: true
                            })
                          });

                          if (response.ok) {
                            const result = await response.json();
                            console.log('Payment successful:', result);
                            handlePaymentSuccess();
                          } else {
                            throw new Error(`Payment failed: ${response.status}`);
                          }
                        } catch (error) {
                          console.error('Payment error:', error);
                          handlePaymentError(error instanceof Error ? error.message : 'Payment failed. Please try again.');
                        }
                      }}
                      disabled={!cardDetails}
                    >
                      <LockSimple size={18} weight="bold" />
                      Donate Now
                    </MyButton>
                  </div>
                  
                  <div className="text-xs text-gray-500 text-center mt-2 flex items-center justify-center gap-1">
                    <LockSimple size={14} className="inline-block mr-1" />
                    Secure payment powered by
                    <span className="font-semibold flex items-center gap-1 ml-1">
                      <SiStripe size={16} className="text-indigo-600" /> 
                      Stripe
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
