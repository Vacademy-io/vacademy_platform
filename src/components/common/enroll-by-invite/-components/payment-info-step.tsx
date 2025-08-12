import { CardElement } from "@stripe/react-stripe-js";
interface PaymentInfoStepProps {
    error: string | null;
}

const CheckoutForm = ({ error }: { error: string | null }) => {
    return (
        <div className="w-full max-w-md mx-auto">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl border-2 border-white/20 p-8 text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    💳 Secure Payment
                </h2>
                <p className="text-gray-600 mb-6">
                    Enter your card details below.
                </p>
                <div className="p-4 border border-gray-300 rounded-lg mb-6 bg-white">
                    <CardElement
                        options={{
                            style: {
                                base: {
                                    color: "#32325d",
                                    fontFamily: "Arial, sans-serif",
                                    fontSmoothing: "antialiased",
                                    fontSize: "16px",
                                    "::placeholder": {
                                        color: "#aab7c4",
                                    },
                                },
                                invalid: {
                                    color: "#fa755a",
                                    iconColor: "#fa755a",
                                },
                            },
                            hidePostalCode: true,
                        }}
                    />
                </div>
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

const PaymentInfoStep = ({ error }: PaymentInfoStepProps) => {
    return (
        <div className="space-y-6">
            {/* Payment Form */}
            <CheckoutForm error={error} />
        </div>
    );
};

export default PaymentInfoStep;
