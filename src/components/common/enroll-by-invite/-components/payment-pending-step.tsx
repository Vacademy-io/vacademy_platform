import { Card, CardContent } from "@/components/ui/card";
import { Clock, ArrowRight, ExternalLink } from "lucide-react";
import { MyButton } from "@/components/design-system/button";
import { getCurrencySymbol } from "./payment-selection-step";
import { getPaymentCompletionStatus } from "../-services/enroll-invite-services";
import { useEffect } from "react";

export interface User {
    id: string;
    username: string;
    email: string;
    full_name: string;
    address_line: string | null;
    city: string | null;
    region: string | null;
    pin_code: string | null;
    mobile_number: string | null;
    date_of_birth: string | null;
    gender: string | null;
    password: string | null;
    profile_pic_file_id: string | null;
    roles: string[];
    root_user: boolean;
}

export interface PaymentResponse {
    response_data: ResponseData;
    order_id: string;
}

export interface ResponseData {
    dueDate: string | null;
    description: string | null;
    paidAt: number;
    invoiceId: string;
    invoice: string; // raw JSON string (from Stripe)
    paymentUrl: string;
    invoicePdfUrl: string;
    paymentStatus: string;
    status: string;
}

export interface UserPaymentResponse {
    user: User;
    payment_response: PaymentResponse;
}

interface PaymentPendingStepProps {
    orderId: string;
    paymentCompletionResponse: UserPaymentResponse;
    selectedPayment: {
        id: string;
        name: string;
        amount: number;
        currency: string;
        description: string;
        duration: string;
    } | null;
    setCurrentStep: (step: number) => void;
}

const PaymentPendingStep = ({
    orderId,
    paymentCompletionResponse,
    selectedPayment,
    setCurrentStep,
}: PaymentPendingStepProps) => {
    const handleCompletePayment = (paymentUrl: string) => {
        if (!paymentUrl) {
            return;
        }

        window.open(paymentUrl, "_blank", "noopener,noreferrer");
    };

    const handleViewInvoice = (invoicePdfUrl: string) => {
        if (!invoicePdfUrl) {
            return;
        }

        const link = document.createElement("a");
        link.href = invoicePdfUrl;
        link.download = "invoice.pdf"; // You can customize this filename
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Polling effect - checks payment status every 10 seconds
    useEffect(() => {
        if (!orderId) return;

        const pollPaymentStatus = async () => {
            try {
                const response = await getPaymentCompletionStatus({
                    paymentLogId: orderId,
                });
                if (response?.payment_status === "PAID") {
                    setCurrentStep(5);
                    return; // Stop polling once payment is completed
                }
            } catch (error) {
                // Silently handle errors - don't show any UI changes
                console.error("Payment status check failed:", error);
            }
        };

        // Initial check
        pollPaymentStatus();

        // Set up polling interval (10 seconds)
        const intervalId = setInterval(pollPaymentStatus, 10000);

        // Cleanup function
        return () => {
            clearInterval(intervalId);
        };
    }, [orderId, setCurrentStep]);

    return (
        <div className="space-y-6">
            {/* Processing Payment Header */}
            <div className="text-center">
                <div className="flex justify-center mb-4">
                    <div className="p-3 bg-blue-100 rounded-full">
                        <div className="relative">
                            <Clock className="w-12 h-12 text-blue-600 animate-pulse" />
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Processing Payment
                </h2>
            </div>

            {/* Order Details Card */}
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6 sm:p-8">
                    <div className="space-y-4">
                        {/* Amount */}
                        <div className="flex items-center justify-between py-2">
                            <span className="text-gray-600 font-medium">
                                Amount:
                            </span>
                            <span className="text-gray-900 font-semibold">
                                {getCurrencySymbol(
                                    selectedPayment?.currency || ""
                                )}
                                {selectedPayment?.amount}
                            </span>
                        </div>

                        {/* Status */}
                        <div className="flex items-center justify-between py-2">
                            <span className="text-gray-600 font-medium">
                                Status:
                            </span>
                            <span className="text-amber-600 font-semibold">
                                {
                                    paymentCompletionResponse?.payment_response
                                        ?.response_data?.paymentStatus
                                }
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Processing Status */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <div className="flex-1 text-left">
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">
                            Payment in Progress
                        </h4>
                        <p className="text-sm text-gray-700 leading-relaxed">
                            Your payment is being processed securely. This usually takes just a few moments. 
                            We'll automatically update your enrollment status once the payment is confirmed.
                        </p>
                    </div>
                </div>
            </div>


            {/* Action Buttons - Only show if payment URL is available */}
            {paymentCompletionResponse?.payment_response?.response_data?.paymentUrl && (
                <div className="flex flex-col gap-4 sm:items-center">
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="large"
                        layoutVariant="default"
                        onClick={() =>
                            handleCompletePayment(
                                paymentCompletionResponse?.payment_response
                                    ?.response_data?.paymentUrl
                            )
                        }
                        className="w-full sm:w-auto bg-primary-500 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                        Complete Payment
                        <ArrowRight className="w-5 h-5 ml-2" />
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="large"
                        layoutVariant="default"
                        onClick={() =>
                            handleViewInvoice(
                                paymentCompletionResponse?.payment_response
                                    ?.response_data?.invoicePdfUrl
                            )
                        }
                        className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                        View Invoice
                        <ExternalLink className="w-5 h-5 ml-2" />
                    </MyButton>
                </div>
            )}

            {/* Security Notice */}
            <div className="text-center space-y-2">
                <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span>Your payment is secured with bank-level encryption</span>
                    </div>
                </div>
                <p className="text-gray-500 text-xs">Powered by Stripe</p>
            </div>
        </div>
    );
};

export default PaymentPendingStep;
