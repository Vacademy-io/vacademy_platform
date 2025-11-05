import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";

export interface RazorpayCheckoutFormRef {
  openPayment: (orderDetails: {
    razorpayKeyId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
    contact: string;
    email: string;
  }) => void;
}

interface RazorpayCheckoutFormProps {
  error: string | null;
  amount: number;
  currency: string;
  onPaymentReady?: (paymentData: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  onError?: (error: string) => void;
  isProcessing?: boolean;
  // Additional user and course details
  userName?: string;
  userEmail?: string;
  userContact?: string;
  courseName?: string;
  courseDescription?: string;
}

export const RazorpayCheckoutForm = forwardRef<
  RazorpayCheckoutFormRef,
  RazorpayCheckoutFormProps
>(
  (
    {
      error,
      amount,
      currency,
      onPaymentReady,
      onError,
      userName = "",
      courseName = "Course Enrollment",
      courseDescription = "Payment for course enrollment",
    },
    ref
  ) => {
    const [isScriptLoaded, setIsScriptLoaded] = useState(false);
    const [scriptError, setScriptError] = useState<string | null>(null);
    const razorpayInstanceRef = useRef<RazorpayInstance | null>(null);

    // Load Razorpay script
    useEffect(() => {
      // Check if script already exists
      const existingScript = document.querySelector(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
      );

      if (existingScript) {
        setIsScriptLoaded(true);
        return;
      }

      // Create and load script
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => {
        setIsScriptLoaded(true);
      };

      script.onerror = () => {
        console.error("Failed to load Razorpay script");
        setScriptError("Failed to load Razorpay payment gateway");
        if (onError) {
          onError("Failed to load payment gateway");
        }
      };

      document.body.appendChild(script);

      return () => {
        // Cleanup: remove script when component unmounts
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      };
    }, [onError]);

    // Expose method to open payment programmatically
    useImperativeHandle(ref, () => ({
      openPayment: (orderDetails: {
        razorpayKeyId: string;
        razorpayOrderId: string;
        amount: number;
        currency: string;
        contact: string;
        email: string;
      }) => {
        if (!isScriptLoaded) {
          console.error("Razorpay script not loaded");
          if (onError) {
            onError("Payment gateway not ready");
          }
          return;
        }

        if (!window.Razorpay) {
          console.error("Razorpay object not found");
          if (onError) {
            onError("Payment gateway not initialized");
          }
          return;
        }

        const options: Record<string, unknown> = {
          key: orderDetails.razorpayKeyId,
          amount: orderDetails.amount,
          currency: orderDetails.currency,
          order_id: orderDetails.razorpayOrderId,
          name: courseName,
          description: courseDescription,
          handler: function (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) {
            if (onPaymentReady) {
              onPaymentReady({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });
            }
          },
          prefill: {
            name: userName,
            email: orderDetails.email,
            contact: orderDetails.contact,
          },
          theme: {
            color: "#3399cc",
          },
          modal: {
            ondismiss: function () {
              if (onError) {
                onError(
                  "Payment cancelled. The enrollment is created but payment is pending."
                );
              }
            },
          },
        };

        try {
          razorpayInstanceRef.current = new window.Razorpay(options);
          razorpayInstanceRef.current.open();
        } catch (err) {
          console.error("Error opening Razorpay checkout:", err);
          if (onError) {
            onError("Failed to open payment gateway");
          }
        }
      },
    }));

    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              💳 Razorpay Payment
            </h2>
            <p className="text-gray-600">
              Click "Complete Enrollment" to proceed with payment
            </p>
          </div>

          {/* Amount Display */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-700 font-medium">Amount to Pay:</span>
              <span className="text-2xl font-bold text-blue-600">
                {currency.toUpperCase()} {amount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Error Display */}
          {(error || scriptError) && (
            <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-lg">
              <strong className="text-red-800 flex items-center gap-2">
                <span>❌</span> Error
              </strong>
              <p className="text-red-700 text-sm mt-1">
                {error || scriptError}
              </p>
            </div>
          )}

          {/* Security Notice */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              🔒 Your payment is secured by Razorpay
              <br />
              Razorpay supports Credit/Debit Cards, Net Banking, UPI & Wallets
            </p>
          </div>
        </div>
      </div>
    );
  }
);

RazorpayCheckoutForm.displayName = "RazorpayCheckoutForm";

// Razorpay types
interface RazorpayInstance {
  open: () => void;
  close: () => void;
}

interface RazorpayConstructor {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (options: any): RazorpayInstance;
}

// Extend window type for TypeScript
declare global {
  interface Window {
    Razorpay: RazorpayConstructor;
  }
}
