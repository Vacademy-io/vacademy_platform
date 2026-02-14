import { ReactNode, Suspense, useMemo } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handlePaymentGatewaykeys } from "../-services/enroll-invite-services";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { PaymentVendor } from "../-utils/payment-vendor-helper";
import { EwayProvider } from "../-contexts/eway-context";
import { RazorpayProvider } from "../-contexts/razorpay-context";

interface PaymentGatewayWrapperProps {
  vendor: PaymentVendor;
  instituteId: string;
  children: ReactNode;
}

/**
 * Payment Gateway Wrapper Component
 *
 * This component dynamically loads and wraps the appropriate payment gateway provider
 * based on the vendor specified in the invite data.
 *
 * Supported vendors:
 * - STRIPE: Uses Stripe Elements provider
 * - EWAY: Uses Eway integration
 * - RAZORPAY: Razorpay integration (to be implemented)
 * - PAYPAL: PayPal integration (to be implemented)
 *
 * @param vendor - The payment gateway vendor (STRIPE, EWAY, etc.)
 * @param instituteId - The institute ID for fetching gateway keys
 * @param children - Child components that need payment gateway context
 */
export const PaymentGatewayWrapper = ({
  vendor,
  instituteId,
  children,
}: PaymentGatewayWrapperProps) => {
  // Render appropriate payment gateway based on vendor
  switch (vendor) {
    case "STRIPE":
      return (
        <StripePaymentWrapper instituteId={instituteId}>
          {children}
        </StripePaymentWrapper>
      );

    case "EWAY":
      return (
        <EwayPaymentWrapper instituteId={instituteId}>
          {children}
        </EwayPaymentWrapper>
      );

    case "RAZORPAY":
      return (
        <RazorpayPaymentWrapper instituteId={instituteId}>
          {children}
        </RazorpayPaymentWrapper>
      );

    case "CASHFREE":
      // Cashfree doesn't need gateway keys - uses paymentSessionId from backend
      return <>{children}</>;

    case "PAYPAL":
      // TODO: Implement PayPal wrapper
      console.warn("PayPal integration not yet implemented");
      return <>{children}</>;

    default:
      console.error(`Unsupported payment vendor: ${vendor}`);
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-2">
              Unsupported Payment Gateway
            </h2>
            <p className="text-gray-600">
              The payment gateway "{vendor}" is not supported.
            </p>
          </div>
        </div>
      );
  }
};

/**
 * Stripe Payment Wrapper
 * Loads Stripe keys and wraps children with Stripe Elements provider
 */
const StripePaymentWrapper = ({
  instituteId,
  children,
}: {
  instituteId: string;
  children: ReactNode;
}) => {
  const { data: stripeKeys } = useSuspenseQuery(
    handlePaymentGatewaykeys(instituteId, "STRIPE")
  );

  // Load Stripe with publishable key - memoize to prevent recreating on every render
  const stripePromise: Promise<Stripe | null> = useMemo(() => 
    loadStripe(stripeKeys.publishableKey), 
    [stripeKeys.publishableKey]
  );

  return (
    <Suspense fallback={<DashboardLoader />}>
      <Elements stripe={stripePromise}>{children}</Elements>
    </Suspense>
  );
};

/**
 * Eway Payment Wrapper
 * Loads Eway keys and provides Eway context to children
 */
const EwayPaymentWrapper = ({
  instituteId,
  children,
}: {
  instituteId: string;
  children: ReactNode;
}) => {
  const { data: ewayKeys } = useSuspenseQuery(
    handlePaymentGatewaykeys(instituteId, "EWAY")
  );

  return (
    <EwayProvider
      encryptionKey={ewayKeys?.encryptionKey}
      publicKey={ewayKeys?.publicKey}
    >
      {children}
    </EwayProvider>
  );
};

/**
 * Razorpay Payment Wrapper
 * Loads Razorpay keys and provides Razorpay context to children
 */
const RazorpayPaymentWrapper = ({
  instituteId,
  children,
}: {
  instituteId: string;
  children: ReactNode;
}) => {
  const { data: razorpayKeys } = useSuspenseQuery(
    handlePaymentGatewaykeys(instituteId, "RAZORPAY")
  );

  return (
    <RazorpayProvider keyId={razorpayKeys?.keyId}>{children}</RazorpayProvider>
  );
};
