import { ArrowLeft, ArrowRight } from "lucide-react";
import { MyButton } from "@/components/design-system/button";

interface PaymentInfo {
    cardholderName: string;
    cardNumber: string;
    expiryDate: string;
    cvv: string;
}

interface PaymentOption {
    id: string;
    name: string;
    amount: number;
    currency: string;
    description: string;
    duration: string;
}

interface NavigationButtonsProps {
    currentStep: number;
    selectedPayment: PaymentOption | null;
    paymentInfo: PaymentInfo;
    onPrevious: () => void;
    onNext: () => void;
    onSubmitEnrollment: () => void;
}

const NavigationButtons = ({
    currentStep,
    selectedPayment,
    paymentInfo,
    onPrevious,
    onNext,
    onSubmitEnrollment,
}: NavigationButtonsProps) => {
    const isNextDisabled = () => {
        if (currentStep === 1 && !selectedPayment) return true;
        if (currentStep === 3) {
            return (
                !paymentInfo.cardholderName ||
                !paymentInfo.cardNumber ||
                !paymentInfo.expiryDate ||
                !paymentInfo.cvv
            );
        }
        return false;
    };

    return (
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between w-full gap-4 mt-8">
            <MyButton
                type="button"
                buttonType="secondary"
                scale="medium"
                layoutVariant="default"
                onClick={onPrevious}
                className="w-full sm:w-auto flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
            >
                <ArrowLeft className="w-4 h-4" />
                Previous
            </MyButton>
            <MyButton
                type="button"
                buttonType="primary"
                scale="medium"
                layoutVariant="default"
                onClick={currentStep === 3 ? onSubmitEnrollment : onNext}
                disable={isNextDisabled()}
                className="w-full sm:w-auto flex items-center gap-2 bg-gradient-to-r from-primary-500 to-primary-500 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
            >
                {currentStep === 3 ? "Complete Payment" : "Next"}
                <ArrowRight className="w-4 h-4" />
            </MyButton>
        </div>
    );
};

export default NavigationButtons;
