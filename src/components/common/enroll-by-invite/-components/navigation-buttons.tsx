import { ArrowLeft, ArrowRight } from "lucide-react";
import { MyButton } from "@/components/design-system/button";
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
    onPrevious: () => void;
    onNext: () => void;
    onSubmitEnrollment: () => void;
    loading: boolean;
    paymentType?: string;
}

const NavigationButtons = ({
    currentStep,
    selectedPayment,
    onPrevious,
    onNext,
    onSubmitEnrollment,
    loading,
    paymentType,
}: NavigationButtonsProps) => {
    const isNextDisabled = () => {
        if (loading) return true;
        if (currentStep === 1 && !selectedPayment) return true;
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
                onClick={
                    currentStep === 3 || (currentStep === 2 && paymentType === "FREE")
                        ? onSubmitEnrollment
                        : onNext
                }
                disable={isNextDisabled()}
                className="w-full sm:w-auto flex items-center gap-2 bg-gradient-to-r from-primary-500 to-primary-500 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
            >
                {loading
                    ? "loading..."
                    : currentStep === 3 || (currentStep === 2 && paymentType === "FREE")
                      ? "Complete Enrollment"
                      : "Next"}
                <ArrowRight className="w-4 h-4" />
            </MyButton>
        </div>
    );
};

export default NavigationButtons;
