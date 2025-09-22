import React, { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import { MyButton } from "@/components/design-system/button";
import { Loader2, Heart } from "lucide-react";
import { DonationAmountSelector } from "./DonationAmountSelector";
import { DonationEmailForm } from "./DonationEmailForm";
import { DonationPaymentForm } from "./DonationPaymentForm";
import { useDonationDialog } from "./useDonationDialog";
import { InstituteBrandingComponent, type InstituteBranding } from "@/components/common/institute-branding";
import { fetchAndStoreInstituteDetails, type InstituteDetails } from "@/services/fetchAndStoreInstituteDetails";
import { getUserId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";

export interface DonationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageSessionId: string;
  instituteId: string;
  token: string;
  courseTitle?: string;
  inviteCode?: string;
  mode: 'enrollment' | 'slide-access';
  isUserEnrolled?: boolean; // New prop to check if user is already enrolled
  onEnrollmentSuccess?: () => void;
  onSlideAccessSuccess?: (courseId: string, subjectId: string, moduleId: string, chapterId: string, slideId: string) => void;
  targetSlideDetails?: {
    courseId: string;
    subjectId: string;
    moduleId: string;
    chapterId: string;
    slideId: string;
  };
}

export const DonationDialog: React.FC<DonationDialogProps> = ({
  open,
  onOpenChange,
  packageSessionId,
  instituteId,
  token,
  courseTitle = "Course",
  inviteCode = "default",
  mode,
  isUserEnrolled = false,
  onEnrollmentSuccess,
  onSlideAccessSuccess,
  targetSlideDetails,
}) => {
  // Institute branding state
  const [instituteBranding, setInstituteBranding] = useState<InstituteBranding | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(false);
  // Use the custom hook for all donation dialog logic
  const {
    // Payment dialog data
    enrollmentData,
    paymentGatewayData,
    loading,
    error,
    selectedPaymentOption,
    selectedPaymentPlan,
    retryFetch,
    
    // State
    selectedAmount,
    customAmount,
    step,
    email,
    validationError,
    isApiLoading,
    
    // Stripe state
    cardElementRef,
    cardElementError,
    cardElementReady,
    
    // Computed values
    donationAmounts,
    minimumAmount,
    currency,
    amount,
    
    // Actions
    setSelectedAmount,
    setCustomAmount,
    setEmail,
    setValidationError,
    handleContinue,
    handlePaymentAndEnrollment,
    handleEdit,
    handleSkip,
    isCurrentStepValid,
  } = useDonationDialog({
    open,
    packageSessionId,
    instituteId,
    token,
    inviteCode,
    mode,
    isUserEnrolled,
    onEnrollmentSuccess,
    onSlideAccessSuccess,
    targetSlideDetails,
  });

  // Fetch institute details when dialog opens
  useEffect(() => {
    const fetchInstituteBranding = async () => {
      if (open && instituteId && !instituteBranding) {
        setBrandingLoading(true);
        try {
          const userId = await getUserId();
          const targetInstituteId = enrollmentData?.institute_id || instituteId;
          
          const details: InstituteDetails | null = await fetchAndStoreInstituteDetails(
            targetInstituteId, 
            userId || 'guest'
          );
          
          if (details) {
            setInstituteBranding({
              instituteId: details.id,
              instituteName: details.institute_name,
              instituteLogoFileId: details.institute_logo_file_id,
              instituteThemeCode: details.institute_theme_code,
            });
          } else {
            // Set fallback branding
            setInstituteBranding({
              instituteId: targetInstituteId,
              instituteName: null,
              instituteLogoFileId: null,
              instituteThemeCode: null,
            });
          }
        } catch (error) {
          console.error('Failed to fetch institute details:', error);
          // Set fallback branding
          setInstituteBranding({
            instituteId: instituteId,
            instituteName: null,
            instituteLogoFileId: null,
            instituteThemeCode: null,
          });
        } finally {
          setBrandingLoading(false);
        }
      }
    };

    fetchInstituteBranding();
  }, [open, instituteId, enrollmentData, instituteBranding]);

  // Show loading state
  if (loading) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[9999] bg-black/60 animate-fade-in" />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-1/2 z-[9999] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl focus:outline-none flex flex-col gap-4"
          >
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-600" />
              <p className="text-gray-600">Loading donation options...</p>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  // Show error state
  if (error) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[9999] bg-black/60 animate-fade-in" />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-1/2 z-[9999] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl focus:outline-none flex flex-col gap-4"
          >
            <div className="text-center py-6">
              <p className="text-red-600 mb-4">{error}</p>
              <MyButton
                buttonType="primary"
                scale="medium"
                onClick={retryFetch}
              >
                Try Again
              </MyButton>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[9999] bg-black/60 animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[9999] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl focus:outline-none flex flex-col gap-4"
        >
          <button
            className="absolute right-2 top-2 text-gray-400 hover:text-gray-700 focus:outline-none"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <Cross2Icon className="h-4 w-4" />
          </button>
          
          {/* Institute Branding */}
          {instituteBranding && (
            <div className="mb-2">
              <InstituteBrandingComponent
                branding={instituteBranding}
                size="small"
                showName={true}
                className="justify-center"
              />
            </div>
          )}
          
          <h2 className="text-lg font-semibold text-gray-900 flex items-center justify-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            Support Free Learning
          </h2>
          
          {step === 'select' && (
            <p className="text-sm text-gray-600 text-center">
              Choose an amount to donate
            </p>
          )}

          {step === 'select' ? (
            <DonationAmountSelector
              selectedAmount={selectedAmount}
              customAmount={customAmount}
              validationError={validationError}
              donationAmounts={donationAmounts}
              minimumAmount={minimumAmount}
              currency={currency}
              onAmountSelect={(amount) => {
                setSelectedAmount(amount);
                setValidationError('');
              }}
              onCustomAmountChange={(amount) => {
                setCustomAmount(amount);
                setValidationError('');
              }}
            />
          ) : step === 'email' ? (
            <DonationEmailForm
              email={email}
              validationError={validationError}
              amount={amount as number}
              currency={currency}
              paymentPlanName={selectedPaymentPlan?.name}
              onEmailChange={(newEmail) => {
                setEmail(newEmail);
                setValidationError('');
              }}
              onEdit={handleEdit}
            />
          ) : (
            <DonationPaymentForm
              email={email}
              amount={amount as number}
              currency={currency}
              paymentPlanName={selectedPaymentPlan?.name}
              cardElementError={cardElementError}
              cardElementReady={cardElementReady}
              isApiLoading={isApiLoading}
              paymentGatewayData={paymentGatewayData}
              cardElementRef={cardElementRef}
              onEdit={handleEdit}
              onPayment={handlePaymentAndEnrollment}
              onSkip={handleSkip}
            />
          )}

          {step !== 'payment' && (
            <div className="flex flex-col gap-2 w-full mt-3">
              <MyButton
                buttonType="primary"
                scale="medium"
                layoutVariant="default"
                className="w-full h-11 text-base"
                onClick={handleContinue}
                disabled={isApiLoading}
              >
                {isApiLoading ? 'Processing...' : 'Continue'}
              </MyButton>
              <MyButton
                buttonType="secondary"
                scale="medium"
                layoutVariant="default"
                className="w-full h-10 text-sm border-none"
                onClick={handleSkip}
                disabled={isApiLoading}
              >
                {isApiLoading ? 'Processing...' : 'Skip'}
              </MyButton>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );

};
