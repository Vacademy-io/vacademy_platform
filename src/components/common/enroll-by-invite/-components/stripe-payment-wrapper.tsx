import { ReactNode } from "react";
import { useStripePayment } from "../-hooks/use-stripe-payment";

interface StripePaymentWrapperProps {
  children: (
    processPayment: () => Promise<{
      success: boolean;
      paymentMethodId?: string;
      error?: string;
    }>
  ) => ReactNode;
}

/**
 * Wrapper component that provides Stripe payment processing
 * to children via render prop pattern
 *
 * This allows the parent component to not directly use Stripe hooks,
 * avoiding the "Elements context not found" error when using Eway
 */
export const StripePaymentWrapper = ({
  children,
}: StripePaymentWrapperProps) => {
  const { processStripePayment } = useStripePayment();

  return <>{children(processStripePayment)}</>;
};
