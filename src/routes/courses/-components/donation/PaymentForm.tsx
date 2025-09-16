import { useState } from "react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { SiStripe } from "react-icons/si";
import { Loader2, Lock } from "lucide-react";
import { MyButton } from "@/components/design-system/button";
import { processDonationPayment, createDonationRequest } from "../../-services/donation-api";

interface PaymentFormProps {
  amount: number;
  email: string;
  instituteId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export const PaymentForm = ({
  amount,
  email,
  instituteId,
  onSuccess,
  onError
}: PaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardError, setCardError] = useState("");
  const [cardComplete, setCardComplete] = useState(false);

  const handleSubmit = async () => {
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
        "", // customerId - you might need to create/retrieve this
        window.location.origin + "/courses" // returnUrl
      );

      // Process donation payment
      const result = await processDonationPayment(instituteId, donationData);
      
      // Check for successful payment based on actual API response format
      if (result.status === null && result.response_data && result.response_data.paymentStatus === "PAID") {
        // Payment was successful - API returns status: null and paymentStatus: "PAID" for successful payments
        onSuccess();
      } else if (result.success || result.status === "succeeded") {
        // Fallback for other success indicators
        onSuccess();
      } else {
        throw new Error(result.message || "Payment processing failed");
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "Payment failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Card Element Container */}
      <div className="min-h-[48px] border border-gray-300 rounded-md p-3 bg-white">
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
          }}
        />
      </div>
      
      {/* Error Message */}
      {cardError && (
        <div className="text-red-600 text-xs">
          {cardError}
        </div>
      )}
      
      {/* Donate Button */}
      <div className="pt-2">
        <MyButton
          buttonType="primary"
          scale="medium"
          layoutVariant="default"
          className="w-full h-11 text-base flex items-center justify-center gap-2"
          onClick={handleSubmit}
          disabled={!stripe || isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Lock size={18} />
              Donate Now
            </>
          )}
        </MyButton>
      </div>
      
      {/* Security Message */}
      <div className="text-xs text-gray-500 text-center flex items-center justify-center gap-1">
        <Lock size={14} className="inline-block mr-1" />
        Secure payment powered by
        <span className="font-semibold flex items-center gap-1 ml-1">
          <SiStripe size={16} className="text-indigo-600" /> 
          Stripe
        </span>
      </div>
    </div>
  );
};
