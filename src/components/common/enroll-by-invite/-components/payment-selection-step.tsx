import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Heart, Check, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";

interface PaymentOption {
    id: string;
    name: string;
    amount: number;
    currency: string;
    description: string;
    duration: string;
    features: string[];
}

interface DonationMetadata {
    allowCustomAmount: boolean;
    suggestedAmounts: string;
    minimumAmount: string;
}

interface PaymentSelectionStepProps {
    paymentOptions: PaymentOption[];
    selectedPayment: PaymentOption | null;
    onPaymentSelect: (payment: PaymentOption) => void;
    paymentType?: string;
    donationMetadata?: DonationMetadata;
    onAmountChange?: (amount: number) => void;
    onValidationChange?: (isValid: boolean) => void;
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
    paymentType,
    donationMetadata,
    onAmountChange,
    onValidationChange,
}: PaymentSelectionStepProps) => {
    const [customAmount, setCustomAmount] = useState<string>("");
    const [isDonation, setIsDonation] = useState(false);
    const hasInitialized = useRef(false);

    useEffect(() => {
        setIsDonation(paymentType === "DONATION");
        if (
            paymentType === "DONATION" &&
            donationMetadata &&
            selectedPayment &&
            !hasInitialized.current
        ) {
            // Set default amount to minimum amount for donations
            const defaultAmount = donationMetadata.minimumAmount || "0";
            setCustomAmount(defaultAmount);

            // Update the selected payment with default amount only once
            const updatedPayment = {
                ...selectedPayment,
                amount: parseInt(defaultAmount),
            };
            onPaymentSelect(updatedPayment);
            onAmountChange?.(parseInt(defaultAmount));

            hasInitialized.current = true;
        }
    }, [paymentType, donationMetadata, selectedPayment]);

    // Reset initialization flag when payment type changes
    useEffect(() => {
        if (paymentType !== "DONATION") {
            hasInitialized.current = false;
        }
    }, [paymentType]);

    // Check if donation amount is valid for enabling next button
    useEffect(() => {
        if (isDonation && donationMetadata) {
            const minAmount = parseInt(donationMetadata.minimumAmount);
            const currentAmount = parseInt(customAmount) || 0;
            // Only enable next button when amount is valid (>= minimum and not empty)
            const isValid = currentAmount >= minAmount && customAmount !== "";
            onValidationChange?.(isValid);
        }
    }, [customAmount, isDonation, donationMetadata, onValidationChange]);

    const handleCustomAmountChange = (value: string) => {
        // Only allow whole numbers (no decimals)
        const wholeNumberValue = value.replace(/[^0-9]/g, "");
        setCustomAmount(wholeNumberValue);

        // Update the selected payment with custom amount only if it's valid
        if (selectedPayment && isDonation) {
            const numValue = parseInt(wholeNumberValue);
            const minAmount = donationMetadata
                ? parseInt(donationMetadata.minimumAmount)
                : 0;

            if (wholeNumberValue === "" || numValue >= minAmount) {
                const finalAmount = numValue || minAmount;
                const updatedPayment = {
                    ...selectedPayment,
                    amount: finalAmount,
                };
                onPaymentSelect(updatedPayment);
                onAmountChange?.(finalAmount);
            }
        }
    };

    const handleSuggestedAmountClick = (amount: number) => {
        const minAmount = donationMetadata
            ? parseInt(donationMetadata.minimumAmount)
            : 0;
        if (amount >= minAmount) {
            setCustomAmount(amount.toString());

            // Update the selected payment with suggested amount
            if (selectedPayment && isDonation) {
                const updatedPayment = {
                    ...selectedPayment,
                    amount: amount,
                };
                onPaymentSelect(updatedPayment);
                onAmountChange?.(amount);
            }
        }
    };

    const getSuggestedAmounts = (): number[] => {
        if (!donationMetadata?.suggestedAmounts) return [];

        return donationMetadata.suggestedAmounts
            .split(",")
            .map((amount) => parseFloat(amount.trim()))
            .filter((amount) => !isNaN(amount))
            .sort((a, b) => b - a); // Sort in descending order
    };

    const getFilteredSuggestedAmounts = (): number[] => {
        const amounts = getSuggestedAmounts();
        const minAmount = donationMetadata
            ? parseInt(donationMetadata.minimumAmount)
            : 0;
        return amounts.filter((amount) => amount >= minAmount);
    };

    const renderDonationSection = () => {
        if (!isDonation || !donationMetadata) return null;

        const filteredAmounts = getFilteredSuggestedAmounts();
        const minAmount = parseInt(donationMetadata.minimumAmount);

        return (
            <div className="space-y-6">
                {/* Donation Header */}
                <div className="flex items-start gap-2 sm:gap-3 mb-6">
                    <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg flex-shrink-0">
                        <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                    </div>
                    <div>
                        <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
                            Make a Donation
                        </h2>
                        <p className="text-gray-600 text-sm mt-1">
                            Support our cause with your generous contribution
                        </p>
                    </div>
                </div>

                <Separator className="mb-6" />

                {/* Suggested Amounts */}
                {filteredAmounts.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Suggested Amounts
                        </h3>
                        <div className="flex flex-wrap gap-3">
                            {filteredAmounts.map((amount, index) => (
                                <Badge
                                    key={index}
                                    variant={
                                        customAmount === amount.toString()
                                            ? "default"
                                            : "outline"
                                    }
                                    className={`cursor-pointer px-4 py-2 text-base font-medium ${
                                        customAmount === amount.toString()
                                            ? "bg-blue-600 text-white hover:bg-blue-700"
                                            : "bg-white text-gray-700 hover:bg-gray-50 border-gray-300"
                                    }`}
                                    onClick={() =>
                                        handleSuggestedAmountClick(amount)
                                    }
                                >
                                    {getCurrencySymbol(
                                        selectedPayment?.currency || "GBP"
                                    )}
                                    {amount}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/* Custom Amount Input */}
                {donationMetadata.allowCustomAmount && (
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Custom Amount
                        </h3>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg">
                                {getCurrencySymbol(
                                    selectedPayment?.currency || "GBP"
                                )}
                            </span>
                            <input
                                type="number"
                                value={customAmount}
                                onChange={(e) =>
                                    handleCustomAmountChange(e.target.value)
                                }
                                min={minAmount}
                                step="1"
                                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                                placeholder={`Minimum ${getCurrencySymbol(selectedPayment?.currency || "GBP")}${minAmount}`}
                            />
                        </div>
                        <p className="text-sm text-gray-600">
                            Minimum donation amount:{" "}
                            {getCurrencySymbol(
                                selectedPayment?.currency || "GBP"
                            )}
                            {minAmount}
                        </p>
                    </div>
                )}

                {/* Selected Donation Summary */}
                {selectedPayment && (
                    <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-700 font-medium">
                                    Your Donation:
                                </span>
                                <span className="text-xl font-bold text-blue-600">
                                    {getCurrencySymbol(
                                        selectedPayment.currency
                                    )}
                                    {selectedPayment.amount}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    };

    const renderRegularPaymentOptions = () => {
        if (isDonation) return null;

        // Get all unique features from all payment options
        const allFeatures = new Set<string>();
        paymentOptions.forEach((option) => {
            option.features?.forEach((feature: string) => {
                allFeatures.add(feature);
            });
        });
        const uniqueFeatures = Array.from(allFeatures);

        return (
            <>
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
                                    <h4 className="text-xl font-bold text-gray-900">
                                        {payment.name}
                                    </h4>

                                    {/* Price Information */}
                                    <div>
                                        <div className="text-xl font-bold text-primary-500 my-2">
                                            {getCurrencySymbol(
                                                payment.currency
                                            )}
                                            {payment.amount}
                                            <span className="text-sm font-normal text-gray-500">
                                                &nbsp;/{payment.duration}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Features - Show all features with check/cross indicators */}
                                    {uniqueFeatures.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="space-y-2">
                                                {uniqueFeatures.map(
                                                    (feature, index) => {
                                                        const isIncluded =
                                                            payment.features?.includes(
                                                                feature
                                                            );
                                                        return (
                                                            <div
                                                                key={index}
                                                                className="flex items-center gap-1.5 text-sm"
                                                            >
                                                                {isIncluded ? (
                                                                    <Check className="size-3 shrink-0 text-emerald-500" />
                                                                ) : (
                                                                    <X className="size-3 shrink-0 text-gray-400" />
                                                                )}
                                                                <span
                                                                    className={`${
                                                                        isIncluded
                                                                            ? "text-gray-700"
                                                                            : "text-gray-400 line-through"
                                                                    } leading-tight`}
                                                                >
                                                                    {feature}
                                                                </span>
                                                            </div>
                                                        );
                                                    }
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </>
        );
    };

    return (
        <Card className="shadow-lg border bg-white w-full">
            <CardContent className="p-5 sm:p-6">
                {renderDonationSection()}
                {renderRegularPaymentOptions()}
            </CardContent>
        </Card>
    );
};

export default PaymentSelectionStep;
