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
            {/* Payment Pending Header */}
            <div className="text-center">
                <div className="flex justify-center mb-4">
                    <div className="p-3 bg-amber-100 rounded-full">
                        <Clock className="w-12 h-12 text-amber-600" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Payment Pending
                </h2>
                <p className="text-gray-600 text-lg">
                    Complete your payment to proceed
                </p>
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

            {/* Action Buttons */}
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

            {/* Redirect Notice */}
            <div className="text-center space-y-2">
                <p className="text-gray-600 text-sm">
                    You will be redirected to Stripe's secure payment page
                </p>
                <p className="text-gray-500 text-xs">Powered by Stripe</p>
            </div>
        </div>
    );
};

export default PaymentPendingStep;
