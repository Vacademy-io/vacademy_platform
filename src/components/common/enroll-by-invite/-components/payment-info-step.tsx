import { lazy, Suspense, useMemo } from "react";
import { PaymentVendor } from "../-utils/payment-vendor-helper";
import EwayCardForm from "./eway-card-form";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Route } from "@/routes/learner-invitation-response";
import { useQuery } from "@tanstack/react-query";
import { handlePaymentGatewaykeys } from "../-services/enroll-invite-services";

// Lazy load Stripe component to avoid importing CardElement when using other gateways
const StripeCheckoutForm = lazy(() =>
  import("./stripe-checkout-form").then((module) => ({
    default: module.StripeCheckoutForm,
  }))
);

interface PaymentInfoStepProps {
  error: string | null;
  vendor?: PaymentVendor;
  amount?: number;
  currency?: string;
  onEwayPaymentReady?: (encryptedData: {
    encryptedNumber: string;
    encryptedCVN: string;
    cardData: {
      name: string;
      expiryMonth: string;
      expiryYear: string;
    };
  }) => void;
  onEwayError?: (error: string) => void;
  onStripePaymentReady?: (
    processPayment: () => Promise<{
      success: boolean;
      paymentMethodId?: string;
      error?: string;
    }>
  ) => void;
  isProcessing?: boolean;
}

/**
 * Eway Checkout Form
 * Renders Eway's custom card form with client-side encryption
 */
const EwayCheckoutForm = ({
  error,
  onPaymentReady,
  onError,
  isProcessing,
}: {
  error: string | null;
  onPaymentReady?: (encryptedData: {
    encryptedNumber: string;
    encryptedCVN: string;
    cardData: {
      name: string;
      expiryMonth: string;
      expiryYear: string;
    };
  }) => void;
  onError?: (error: string) => void;
  isProcessing?: boolean;
}) => {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-md border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">
          💳 Secure Payment
        </h2>
        <p className="text-gray-600 mb-6 text-center">
          Enter your card details below.--
        </p>
        <EwayCardForm
          onPaymentReady={onPaymentReady || (() => {})}
          onError={onError}
          isProcessing={isProcessing || false}
        />
        {error && (
          <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
            <strong className="text-red-800">❌ Error</strong>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Payment Info Step Component
 * Conditionally renders payment form based on the payment vendor
 *
 * @param vendor - Payment gateway vendor (STRIPE, EWAY, etc.)
 * @param error - Error message to display
 * @param amount - Payment amount in cents
 * @param currency - Currency code (e.g., "AUD", "USD")
 * @param onEwayPaymentReady - Callback when Eway payment data is ready
 * @param onEwayError - Callback for Eway errors
 * @param isProcessing - Whether payment is being processed
 */
const PaymentInfoStep = ({
  error,
  vendor = "STRIPE",
  onEwayPaymentReady,
  onEwayError,
  onStripePaymentReady,
  isProcessing,
}: PaymentInfoStepProps) => {
  const { instituteId } = Route.useSearch();

  // Fetch Stripe publishable key
  const {
    data: stripeKeyData,
    isLoading: isLoadingStripeKey,
    error: stripeKeyError,
  } = useQuery({
    ...handlePaymentGatewaykeys(instituteId, "STRIPE"),
    enabled: vendor === "STRIPE" && !!instituteId,
  });

  // Extract Stripe key (try multiple property names for compatibility)
  const stripePublishableKey = useMemo(() => {
    if (!stripeKeyData) return null;

    // Try different possible property names
    const possibleKeys = [
      stripeKeyData.publishableKey,
      stripeKeyData.publishable_key,
      stripeKeyData.key,
      stripeKeyData.stripePublishableKey,
      stripeKeyData.stripe_publishable_key,
    ];

    const foundKey = possibleKeys.find((key) => key && typeof key === "string");

    return foundKey || null;
  }, [stripeKeyData, vendor, isLoadingStripeKey, stripeKeyError, instituteId]);

  // Initialize Stripe - memoize to prevent recreating on every render
  const stripePromise = useMemo(() => {
    if (stripePublishableKey) {
      return loadStripe(stripePublishableKey);
    }
    if (vendor === "STRIPE" && stripeKeyData && !stripePublishableKey) {
      console.error(
        "❌ Stripe key not found in response. Available keys:",
        Object.keys(stripeKeyData)
      );
    }
    return null;
  }, [stripePublishableKey, vendor, stripeKeyData]);

  return (
    <div className="space-y-6">
      {/* Conditional Payment Form based on vendor */}
      {vendor === "STRIPE" && isLoadingStripeKey && (
        <div className="text-center p-6">
          <div className="animate-pulse">Loading Stripe configuration...</div>
        </div>
      )}

      {vendor === "STRIPE" &&
        !isLoadingStripeKey &&
        (stripeKeyError || !stripeKeyData) && (
          <div className="w-full max-w-md mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-md p-6 text-center">
              <h2 className="text-xl font-bold text-red-800 mb-2">
                ⚠️ Stripe Configuration Error
              </h2>
              <p className="text-red-700">
                {stripeKeyError
                  ? "Failed to load Stripe configuration. Please try again."
                  : "Unable to load Stripe payment gateway. Please contact support."}
              </p>
              <p className="text-sm text-red-600 mt-2">
                Institute ID: {instituteId}
              </p>
              {stripeKeyError && (
                <p className="text-xs text-red-500 mt-2">
                  Error: {String(stripeKeyError)}
                </p>
              )}
            </div>
          </div>
        )}

      {vendor === "STRIPE" &&
        !isLoadingStripeKey &&
        stripeKeyData &&
        !stripePublishableKey && (
          <div className="w-full max-w-md mx-auto">
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6 text-center">
              <h2 className="text-xl font-bold text-yellow-800 mb-2">
                ⚠️ Stripe Key Missing
              </h2>
              <p className="text-yellow-700">
                Stripe publishable key not found in configuration.
              </p>
              <p className="text-xs text-yellow-600 mt-2">
                Available keys: {Object.keys(stripeKeyData).join(", ")}
              </p>
            </div>
          </div>
        )}

      {vendor === "STRIPE" && !isLoadingStripeKey && stripePromise && (
        <Suspense
          fallback={
            <div className="text-center p-6">Loading payment form...</div>
          }
        >
          <Elements stripe={stripePromise}>
            <StripeCheckoutForm
              error={error}
              onPaymentMethodReady={onStripePaymentReady}
            />
          </Elements>
        </Suspense>
      )}

      {vendor === "EWAY" && (
        <EwayCheckoutForm
          error={error}
          onPaymentReady={onEwayPaymentReady}
          onError={onEwayError}
          isProcessing={isProcessing}
        />
      )}

      {vendor !== "STRIPE" && vendor !== "EWAY" && (
        <div className="w-full max-w-md mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6 text-center">
            <h2 className="text-xl font-bold text-yellow-800 mb-2">
              ⚠️ Payment Gateway Not Configured
            </h2>
            <p className="text-yellow-700">
              The payment gateway "{vendor}" is not yet supported. Please
              contact support.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentInfoStep;
