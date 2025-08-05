import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Mail } from "lucide-react";
import { useState, useEffect } from "react";
import { getCurrencySymbol } from "./payment-selection-step";

interface PaymentOption {
    id: string;
    name: string;
    amount: number;
    currency: string;
    description: string;
    duration: string;
}

interface ReviewStepProps {
    courseData: {
        course: string;
        courseBanner?: string;
    };
    selectedPayment: PaymentOption | null;
    registrationData: Record<string, { name: string; value: string }>;
    onEmailChange?: (email: string) => void;
}

const ReviewStep = ({
    courseData,
    selectedPayment,
    registrationData,
    onEmailChange,
}: ReviewStepProps) => {
    const [email, setEmail] = useState("");

    // Find email from registration data
    useEffect(() => {
        const emailField = Object.entries(registrationData).find(
            ([key, value]) =>
                value.name.toLowerCase().includes("email") ||
                key.toLowerCase().includes("email")
        );
        if (emailField) {
            setEmail(emailField[1].value);
        }
    }, [registrationData]);

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newEmail = e.target.value;
        setEmail(newEmail);
        if (onEmailChange) {
            onEmailChange(newEmail);
        }
    };
    return (
        <div className="space-y-6">
            {/* Order Summary Card */}
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6 sm:p-8">
                    <div className="flex items-start gap-2 sm:gap-3 mb-4">
                        <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg flex-shrink-0">
                            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
                                Order Summary
                            </h2>
                            <p className="text-gray-600 text-sm mt-1">
                                Review your order before proceeding to payment
                            </p>
                        </div>
                    </div>

                    <div className="space-y-0">
                        {/* Course Banner and Name */}
                        <div className="flex items-center gap-4 pb-5">
                            {courseData.courseBanner && (
                                <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0">
                                    <img
                                        src={courseData.courseBanner}
                                        alt="Course Banner"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            )}
                            <div className="flex-1">
                                <span>{courseData.course}</span>
                            </div>
                        </div>

                        <Separator />

                        {/* Plan and Duration */}
                        <div className="flex items-center justify-between pt-4">
                            <div>
                                <span className="text-gray-600">Plan:</span>
                            </div>
                            <div>
                                <span className="ml-2">
                                    {selectedPayment?.duration}
                                </span>
                            </div>
                        </div>

                        {/* Price */}
                        <div className="flex items-center justify-between py-4">
                            <span className="text-gray-600">Price:</span>
                            <span className="text-gray-900">
                                {getCurrencySymbol(
                                    selectedPayment?.currency || ""
                                )}
                                {selectedPayment?.amount}
                            </span>
                        </div>

                        <Separator />

                        {/* Total */}
                        <div className="flex items-center justify-between py-4">
                            <span className="text-gray-700 font-bold">
                                Total:
                            </span>
                            <span className="font-bold text-lg text-gray-900">
                                {getCurrencySymbol(
                                    selectedPayment?.currency || ""
                                )}
                                {selectedPayment?.amount}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Email for Receipt Card */}
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6 sm:p-8">
                    <div className="flex items-start gap-2 sm:gap-3 mb-6">
                        <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                            <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
                                Payment Receipt Email
                            </h2>
                            <p className="text-gray-600 text-sm mt-1">
                                Enter the email address where you'd like to
                                receive your payment receipt
                            </p>
                        </div>
                    </div>

                    <Separator className="mb-6" />

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                                Email Address{" "}
                                <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={handleEmailChange}
                                placeholder="Enter your email address"
                                required
                                className="w-full h-12 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                            />
                            <p className="text-xs text-gray-500">
                                Your payment receipt will be sent to this email
                                address
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ReviewStep;
