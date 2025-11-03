import { useElements, useStripe, CardElement } from "@stripe/react-stripe-js";

/**
 * Stripe Payment Handler Hook
 * Encapsulates Stripe-specific payment processing logic
 * Should only be used within Stripe Elements provider
 */
export const useStripePayment = () => {
  const stripe = useStripe();
  const elements = useElements();

  /**
   * Process Stripe payment
   * Creates payment method and returns the ID
   */
  const processStripePayment = async (): Promise<{
    success: boolean;
    paymentMethodId?: string;
    error?: string;
  }> => {
    if (!stripe || !elements) {
      return {
        success: false,
        error: "Stripe is not initialized. Please refresh the page.",
      };
    }

    const cardElement = elements.getElement(CardElement);

    if (!cardElement) {
      return {
        success: false,
        error: "Card element not found. Please refresh the page.",
      };
    }

    try {
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
      });

      if (error) {
        return {
          success: false,
          error: error.message || "Payment processing failed",
        };
      }

      return {
        success: true,
        paymentMethodId: paymentMethod?.id,
      };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : "An unexpected error occurred",
      };
    }
  };

  return {
    processStripePayment,
    isStripeReady: !!(stripe && elements),
  };
};
