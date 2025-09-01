import { useState, useEffect } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { PaymentForm } from "./PaymentForm";
import { GET_STRIPE_KEY_URL } from "@/constants/urls";

interface DonationPaymentStepProps {
  amount: number;
  email: string;
  instituteId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  onBack: () => void;
}

export const DonationPaymentStep = ({
  amount,
  email,
  instituteId,
  onSuccess,
  onError,
  onBack
}: DonationPaymentStepProps) => {
  const [stripePromise, setStripePromise] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch Stripe publishable key
  useEffect(() => {
    const fetchStripeKey = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${GET_STRIPE_KEY_URL}?instituteId=${instituteId}&vendor=STRIPE`, {
          method: 'GET',
          headers: {
            'accept': '*/*'
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          let publishableKey: string | undefined;
          
          // Check if publishableKey is directly available in the response
          if (data.publishableKey) {
            publishableKey = data.publishableKey;
          } else if (data.config_json) {
            try {
              const config = JSON.parse(data.config_json);
              
              // Try different possible field names for publishable key
              publishableKey = config.publishableKey || 
                              config.publishable_key || 
                              config.stripe_publishable_key ||
                              config.stripePublishableKey ||
                              config.key ||
                              config.public_key;
            } catch (error) {
              // Silent error handling
            }
          }
          
          if (publishableKey) {
            const stripeInstance = loadStripe(publishableKey);
            setStripePromise(stripeInstance);
          } else {
            onError('Payment gateway not configured');
          }
        } else {
          onError('Failed to load payment gateway');
        }
      } catch (error) {
        onError('Failed to load payment gateway');
      } finally {
        setLoading(false);
      }
    };

    fetchStripeKey();
  }, [instituteId, onError]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-sm text-gray-600">Loading payment gateway...</p>
      </div>
    );
  }

  if (!stripePromise) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-red-600">Payment gateway not available</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-2 bg-white border border-neutral-300 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-gray-700">Donation Summary</span>
        </div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-600">Amount:</span>
          <span className="font-semibold text-gray-900">${amount}</span>
        </div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-600">Email:</span>
          <span className="font-semibold text-gray-900">{email}</span>
        </div>
        <button
          className="text-xs font-medium ml-auto block rounded border border-neutral-300 bg-white text-neutral-600 px-3 py-1 focus:outline-none transition-colors duration-200 hover:bg-blue-50/50 hover:border-blue-300"
          onClick={onBack}
          style={{ boxShadow: 'none', textDecoration: 'none' }}
        >
          Edit
        </button>
      </div>
      
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs text-gray-600">Card Details</label>
        </div>
        
        <Elements stripe={stripePromise}>
          <PaymentForm
            amount={amount}
            email={email}
            instituteId={instituteId}
            onSuccess={onSuccess}
            onError={onError}
          />
        </Elements>
      </div>
    </>
  );
};
