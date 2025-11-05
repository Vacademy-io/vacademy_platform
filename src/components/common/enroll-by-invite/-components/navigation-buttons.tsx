import { ArrowLeft, ArrowRight } from "lucide-react";
import { MyButton } from "@/components/design-system/button";
import { SelectedPayment } from "./types";
import { PaymentVendor } from "../-utils/payment-vendor-helper";

interface NavigationButtonsProps {
  currentStep: number;
  selectedPayment: SelectedPayment | null;
  onPrevious: () => void;
  onNext: () => void;
  onSubmitEnrollment: () => void;
  loading: boolean;
  paymentType?: string;
  donationAmountValid?: boolean;
  paymentVendor?: PaymentVendor;
  isPaymentDataReady?: boolean; // For Stripe processor or Eway encrypted data
}

const NavigationButtons = ({
  currentStep,
  selectedPayment,
  onPrevious,
  onNext,
  onSubmitEnrollment,
  loading,
  paymentType,
  donationAmountValid,
  paymentVendor,
  isPaymentDataReady = false,
}: NavigationButtonsProps) => {
  const isNextDisabled = () => {
    if (loading) return true;

    // Step 1: Payment selection
    if (currentStep === 1 && !selectedPayment) return true;
    if (currentStep === 1 && paymentType === "DONATION" && !donationAmountValid)
      return true;

    // Step 3: Payment details - check if payment data is ready based on vendor
    if (currentStep === 3) {
      // For Eway: require encrypted data
      if (paymentVendor === "EWAY" && !isPaymentDataReady) {
        return true;
      }
      // For Stripe: require payment processor
      if (paymentVendor === "STRIPE" && !isPaymentDataReady) {
        return true;
      }
      // For Razorpay: button is always enabled (order created on click)
      // Payment happens after button click, not before
    }

    return false;
  };

  return (
    <div className="p-6 flex flex-col-reverse sm:flex-row items-center justify-between w-full gap-4 mt-8 fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
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
          ? "Loading"
          : currentStep === 3 || (currentStep === 2 && paymentType === "FREE")
          ? currentStep === 3 && !isPaymentDataReady
            ? paymentVendor === "EWAY"
              ? "Verify Card First"
              : "Waiting for Payment..."
            : "Complete Enrollment"
          : "Next"}
        <ArrowRight className="w-4 h-4" />
      </MyButton>
    </div>
  );
};

export default NavigationButtons;
