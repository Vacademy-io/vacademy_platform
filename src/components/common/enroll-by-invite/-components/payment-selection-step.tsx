import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CreditCard } from "lucide-react";

interface PaymentOption {
    id: string;
    name: string;
    amount: number;
    currency: string;
    description: string;
    duration: string;
    features: string[];
}

interface PaymentSelectionStepProps {
    paymentOptions: PaymentOption[];
    selectedPayment: PaymentOption | null;
    onPaymentSelect: (payment: PaymentOption) => void;
}

const currencySymbols: { [key: string]: string } = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    INR: "₹",
    AUD: "A$",
    CAD: "C$",
};

export const getCurrencySymbol = (currencyCode: string) => {
    return currencySymbols[currencyCode] || currencyCode;
};

const PaymentSelectionStep = ({
    paymentOptions,
    selectedPayment,
    onPaymentSelect,
}: PaymentSelectionStepProps) => {
    return (
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm w-full">
            <CardContent className="p-6 sm:p-8">
                <div className="flex items-start gap-2 sm:gap-3 mb-6">
                    <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                        <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
                            Select Payment Plan
                        </h2>
                        <p className="text-gray-600 text-sm mt-1">
                            Choose the payment option that best suits your needs
                        </p>
                    </div>
                </div>

                <Separator className="mb-6" />

                <div className="grid gap-4">
                    {paymentOptions.map((payment) => {
                        return (
                            <Card
                                key={payment.id}
                                className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                                    selectedPayment?.id === payment.id
                                        ? "ring-2 ring-blue-500 bg-blue-50"
                                        : "hover:bg-gray-50"
                                }`}
                                onClick={() => onPaymentSelect(payment)}
                            >
                                <CardContent className="p-6">
                                    {/* Duration Heading */}
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">
                                            {payment.duration} Plan
                                        </h3>
                                    </div>

                                    {/* Price Information */}
                                    <div>
                                        <div className=" text-gray-600 text-sm my-1">
                                            {getCurrencySymbol(
                                                payment.currency
                                            )}
                                            {payment.amount} /{" "}
                                            {payment.duration}
                                        </div>
                                    </div>

                                    {/* Features */}
                                    {payment.features &&
                                        payment.features.length > 0 && (
                                            <div className="space-y-2">
                                                <h4 className="font-medium text-gray-900 text-sm">
                                                    Features:
                                                </h4>
                                                <ul className="space-y-1">
                                                    {payment.features.map(
                                                        (feature, index) => (
                                                            <li
                                                                key={index}
                                                                className="flex items-center gap-2 text-sm text-gray-600"
                                                            >
                                                                <span className="text-blue-500">
                                                                    •
                                                                </span>
                                                                <span>
                                                                    {feature}
                                                                </span>
                                                            </li>
                                                        )
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};

export default PaymentSelectionStep;
