import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CreditCard, CheckCircle } from "lucide-react";
import { MyInput } from "@/components/design-system/input";
import { useState, useRef, useEffect } from "react";

interface PaymentOption {
    id: string;
    name: string;
    amount: number;
    currency: string;
    description: string;
    duration: string;
}

interface PaymentInfo {
    cardholderName: string;
    cardNumber: string;
    expiryDate: string;
    cvv: string;
}

interface PaymentInfoStepProps {
    courseData: {
        course: string;
    };
    selectedPayment: PaymentOption | null;
    paymentInfo: PaymentInfo;
    onPaymentInfoChange: (field: keyof PaymentInfo, value: string) => void;
}

const PaymentInfoStep = ({ 
    courseData, 
    selectedPayment, 
    paymentInfo, 
    onPaymentInfoChange 
}: PaymentInfoStepProps) => {
    const dateInputRef = useRef<HTMLInputElement>(null);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    return (
        <div className="space-y-6">
            {/* Payment Form Card */}
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6 sm:p-8">
                    <div className="flex items-start gap-2 sm:gap-3 mb-6">
                        <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                            <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
                                Payment Information
                            </h2>
                            <p className="text-gray-600 text-sm mt-1">
                                Enter your card details to complete the enrollment
                            </p>
                        </div>
                    </div>

                    <Separator className="mb-6" />

                    <div className="space-y-4">
                        <MyInput
                            inputType="text"
                            inputPlaceholder="Cardholder Name"
                            input={paymentInfo.cardholderName}
                            onChangeFunction={(e: any) => onPaymentInfoChange('cardholderName', e.target.value)}
                            required
                            size="large"
                            label="Cardholder Name"
                            className="!max-w-full !w-full"
                        />
                        <MyInput
                            inputType="text"
                            inputPlaceholder="1234 5678 9012 3456"
                            input={paymentInfo.cardNumber}
                            onChangeFunction={(e: any) => onPaymentInfoChange('cardNumber', e.target.value)}
                            required
                            size="large"
                            label="Card Number"
                            className="!max-w-full !w-full"
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                    Expiry Date <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        ref={dateInputRef}
                                        type="text"
                                        value={paymentInfo.expiryDate || ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            // Allow manual typing in MM/YY format
                                            if (value.length <= 5) {
                                                onPaymentInfoChange('expiryDate', value);
                                            }
                                        }}
                                        onFocus={(e) => {
                                            setIsDatePickerOpen(true);
                                            // Convert MM/YY to YYYY-MM format for date picker
                                            if (paymentInfo.expiryDate && paymentInfo.expiryDate.includes('/')) {
                                                const [month, year] = paymentInfo.expiryDate.split('/');
                                                const fullYear = `20${year}`;
                                                e.target.type = 'month';
                                                e.target.value = `${fullYear}-${month.padStart(2, '0')}`;
                                            } else {
                                                e.target.type = 'month';
                                            }
                                        }}
                                        onBlur={(e) => {
                                            setTimeout(() => {
                                                setIsDatePickerOpen(false);
                                                e.target.type = 'text';
                                                // Format the date as MM/YY when user selects from picker
                                                if (e.target.value && e.target.value.includes('-')) {
                                                    const [year, month] = e.target.value.split('-');
                                                    const formattedDate = `${parseInt(month)}/${year.slice(-2)}`;
                                                    onPaymentInfoChange('expiryDate', formattedDate);
                                                }
                                            }, 200);
                                        }}
                                        placeholder="MM/YY"
                                        required
                                        className="w-full h-12 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                    CVV <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={paymentInfo.cvv}
                                        onChange={(e) => onPaymentInfoChange('cvv', e.target.value)}
                                        placeholder="123"
                                        required
                                        maxLength={4}
                                        className="w-full h-12 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Order Summary Card */}
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6 sm:p-8">
                    <div className="flex items-start gap-2 sm:gap-3 mb-6">
                        <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg flex-shrink-0">
                            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
                                Order Summary
                            </h2>
                            <p className="text-gray-600 text-sm mt-1">
                                Final review before payment
                            </p>
                        </div>
                    </div>

                    <Separator className="mb-6" />

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div>
                                <h3 className="font-semibold text-gray-900">{courseData.course}</h3>
                                <p className="text-sm text-gray-600">{selectedPayment?.name}</p>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-bold text-gray-900">
                                    ${selectedPayment?.amount}
                                </div>
                                <div className="text-sm text-gray-500">Duration: {selectedPayment?.duration}</div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default PaymentInfoStep; 