import { Card, CardContent } from "@/components/ui/card";
import { Clock, ArrowRight, ExternalLink } from "lucide-react";
import { MyButton } from "@/components/design-system/button";
import { getCurrencySymbol } from "./payment-selection-step";

interface PaymentPendingStepProps {
    selectedPayment: {
        id: string;
        name: string;
        amount: number;
        currency: string;
        description: string;
        duration: string;
    } | null;
    orderId: string;
    onCompletePayment: () => void;
}

const PaymentPendingStep = ({
    selectedPayment,
    orderId,
    onCompletePayment,
}: PaymentPendingStepProps) => {
    const handleCompletePayment = () => {
        // Handle payment completion - redirect to Stripe
        console.log("Redirecting to Stripe payment...");
        onCompletePayment();
    };

    const handleViewInvoice = () => {
        // Handle invoice viewing
        console.log("Viewing invoice...");
    };

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
                        {/* Order ID */}
                        <div className="flex items-center justify-between py-2">
                            <span className="text-gray-600 font-medium">
                                Order ID:
                            </span>
                            <span className="text-gray-900 font-semibold">
                                {orderId}
                            </span>
                        </div>

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
                                Pending
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
                    onClick={handleCompletePayment}
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
                    onClick={handleViewInvoice}
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
