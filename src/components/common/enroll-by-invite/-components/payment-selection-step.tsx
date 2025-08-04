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
}

interface PaymentSelectionStepProps {
    paymentOptions: PaymentOption[];
    selectedPayment: PaymentOption | null;
    onPaymentSelect: (payment: PaymentOption) => void;
}

const PaymentSelectionStep = ({ 
    paymentOptions, 
    selectedPayment, 
    onPaymentSelect 
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
                    {paymentOptions.map((payment) => (
                        <Card
                            key={payment.id}
                            className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                                selectedPayment?.id === payment.id
                                    ? 'ring-2 ring-blue-500 bg-blue-50'
                                    : 'hover:bg-gray-50'
                            }`}
                            onClick={() => onPaymentSelect(payment)}
                        >
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-gray-900">{payment.name}</h3>
                                        <p className="text-sm text-gray-600 mt-1">{payment.description}</p>
                                        <p className="text-xs text-gray-500 mt-1">Duration: {payment.duration}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-bold text-gray-900">
                                            ${payment.amount}
                                        </div>
                                        <div className="text-sm text-gray-500">{payment.currency}</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default PaymentSelectionStep; 