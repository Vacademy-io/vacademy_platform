/**
 * Cashfree Checkout Form - Hosted Payment Page (Redirect)
 *
 * Uses paymentSessionId to open Cashfree's hosted payment page via checkout().
 * User enters card details on Cashfree's secure page, then is redirected back.
 */
import { useState } from "react";
import { load as loadCashfree } from "@cashfreepayments/cashfree-js";

interface CashfreeCheckoutFormProps {
  error: string | null;
  amount: number;
  currency: string;
  paymentSessionId?: string | null;
  returnUrl?: string;
  orderId?: string;
  instituteId?: string;
  onPayClick?: () => void;
  onPayError?: () => void;
  isProcessing?: boolean;
}

export const CashfreeCheckoutForm = ({
  error,
  amount,
  currency,
  paymentSessionId,
  returnUrl,
  orderId,
  instituteId,
  onPayClick,
  onPayError,
  isProcessing = false,
}: CashfreeCheckoutFormProps) => {
  const [cardError, setCardError] = useState<string | null>(null);

  const handleProceedToPayment = async () => {
    if (!paymentSessionId || !returnUrl || !orderId) {
      setCardError("Payment not ready. Please wait.");
      return;
    }

    onPayClick?.();
    setCardError(null);

    try {
      const isSandbox =
        import.meta.env.VITE_CASHFREE_SANDBOX !== "false" &&
        import.meta.env.MODE !== "production";
      const cashfree = await loadCashfree({
        mode: isSandbox ? "sandbox" : "production",
      });

      if (!cashfree) {
        setCardError("Payment gateway not available.");
        onPayError?.();
        return;
      }

      const fullReturnUrl = instituteId
        ? `${returnUrl}?orderId=${orderId}&instituteId=${instituteId}`
        : `${returnUrl}?orderId=${orderId}`;

      const result = await cashfree.checkout({
        paymentSessionId,
        returnUrl: fullReturnUrl,
      });

      if (result?.error) {
        setCardError(result.error.message || "Payment initialization failed.");
        onPayError?.();
      }
    } catch (err) {
      setCardError(
        err instanceof Error ? err.message : "Payment could not be processed."
      );
      onPayError?.();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            💳 Cashfree Payment
          </h2>
          <p className="text-gray-600">
            Click below to open Cashfree&apos;s secure payment page. You will
            enter your card details there.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-700 font-medium">Amount to Pay:</span>
            <span className="text-2xl font-bold text-blue-600">
              {currency?.toUpperCase() || "INR"} {amount.toFixed(2)}
            </span>
          </div>
        </div>

        {paymentSessionId ? (
          <button
            type="button"
            onClick={handleProceedToPayment}
            disabled={isProcessing}
            className="w-full py-3 px-4 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isProcessing ? "Redirecting..." : "Proceed to Payment"}
          </button>
        ) : (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center text-gray-600">
            {isProcessing ? "Preparing payment..." : "Loading payment form..."}
          </div>
        )}

        {(error || cardError) && (
          <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-lg">
            <strong className="text-red-800 flex items-center gap-2">
              <span>❌</span> Error
            </strong>
            <p className="text-red-700 text-sm mt-1">{error || cardError}</p>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            🔒 Your payment is secured by Cashfree
            <br />
            Cards, UPI, Net Banking, Wallets &amp; more
          </p>
        </div>
      </div>
    </div>
  );
};
