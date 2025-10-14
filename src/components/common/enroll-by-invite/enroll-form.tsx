import { Route } from "@/routes/learner-invitation-response";
import { Preferences } from "@capacitor/preferences";
import { applyTabBranding } from "@/utils/branding";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  handleEnrollLearnerForPayment,
  handleGetEnrollInviteData,
  handleGetPublicInstituteDetails,
  ReferRequest,
} from "./-services/enroll-invite-services";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { GraduationCap } from "lucide-react";
import { useEffect, useState } from "react";
import {
  convertInviteCustomFields,
  getDefaultPlanFromPaymentsData,
  safeJsonParse,
  transformApiDataToCourseDataForInvite,
} from "./-utils/helper";
import { useInstituteDetailsStore } from "@/stores/study-library/useInstituteDetails";
import { getDynamicSchema } from "@/routes/register/-utils/helper";
import z from "zod";
import { AssessmentCustomFieldOpenRegistration } from "@/types/assessment-open-registration";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { MyButton } from "@/components/design-system/button";

// Import step components
import {
  RegistrationStep,
  PaymentSelectionStep,
  ReviewStep,
  PaymentInfoStep,
  PaymentPendingStep,
  SuccessStep,
  CourseInfoCard,
  NavigationButtons,
  FinalCourseData,
  EnrollmentData,
  SelectedPayment,
} from "./-components";
import { useElements, useStripe, CardElement } from "@stripe/react-stripe-js";

// SUBSCRIPTION, FREE, UPFRONT, DONATION

const EnrollByInvite = () => {
  const [paymentType, setPaymentType] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");
  const [paymentCompletionResponse, setPaymentCompletionResponse] =
    useState(null);
  const [donationAmountValid, setDonationAmountValid] = useState(false);
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0); // 0: Registration, 1: Payment Selection, 2: Review, 3: Payment Details, 4: Payment Pending, 5: Success
  const [isRegistrationCardVisible, setIsRegistrationCardVisible] =
    useState(false);
  const [courseData, setCourseData] = useState<FinalCourseData>({
    aboutCourse: "",
    course: "",
    courseBanner: "",
    courseMedia: "",
    coursePreview: "",
    courseMediaId: {
      type: "",
      id: "",
    },
    customHtml: "",
    description: "",
    includeInstituteLogo: false,
    includePaymentPlans: false,
    instituteLogo: "",
    learningOutcome: "",
    restrictToSameBatch: false,
    showRelatedCourses: false,
    tags: [],
    targetAudience: "",
  });
  const [referRequest, setReferRequest] = useState<ReferRequest | null>(null);
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentData>({
    registrationData: {},
    selectedPayment: null,
    paymentInfo: {
      cardholderName: "",
      cardNumber: "",
      expiryDate: "",
      cvv: "",
    },
  });

  const { instituteId, inviteCode, ref } = Route.useSearch();
  const { data: instituteData, isLoading: isInstituteLoading } =
    useSuspenseQuery(handleGetPublicInstituteDetails({ instituteId }));

  const { getDetailsFromPackageSessionId, setInstituteDetails } =
    useInstituteDetailsStore();

  const { data: inviteData, isLoading } = useSuspenseQuery(
    handleGetEnrollInviteData({ instituteId, inviteCode })
  );

  const paymentOptions = getDefaultPlanFromPaymentsData(
    inviteData?.package_session_to_payment_options?.[0]?.payment_option
  );
  const zodSchema = getDynamicSchema(
    convertInviteCustomFields(inviteData?.institute_custom_fields || []) || []
  );

  type FormValues = z.infer<typeof zodSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(zodSchema),
    defaultValues: (
      convertInviteCustomFields(inviteData?.institute_custom_fields || []) || []
    )
      .sort(
        (
          a: AssessmentCustomFieldOpenRegistration,
          b: AssessmentCustomFieldOpenRegistration
        ) => a.field_order - b.field_order
      )
      .reduce(
        (
          defaults: Record<
            string,
            {
              id: string;
              name: string;
              value: string;
              is_mandatory: boolean;
              type: string;
              comma_separated_options?: string[];
            }
          >,
          field: AssessmentCustomFieldOpenRegistration
        ) => {
          if (field.field_type === "dropdown") {
            const optionsArray = field.comma_separated_options
              ? field.comma_separated_options
                  .split(",")
                  .map((opt) => opt.trim())
              : [];

            defaults[field.field_key] = {
              id: field.id,
              name: field.field_name,
              value: optionsArray[0] || "",
              is_mandatory: field.is_mandatory || false,
              comma_separated_options: optionsArray,
              type: field.field_type,
            };
          } else {
            defaults[field.field_key] = {
              id: field.id,
              name: field.field_name,
              value: "",
              is_mandatory: field.is_mandatory || false,
              type: field.field_type,
            };
          }
          return defaults;
        },
        {} as Record<
          string,
          {
            id: string;
            name: string;
            value: string;
            is_mandatory: boolean;
            type: string;
            comma_separated_options?: string[];
          }
        >
      ),
    mode: "onChange",
  });

  form.watch();

  function onSubmit(values: FormValues) {
    setEnrollmentData((prev) => ({
      ...prev,
      registrationData: values,
    }));
    // For FREE payments, go directly to review step (step 2)
    // For other payment types, go to payment selection step (step 1)
    setCurrentStep(paymentType === "FREE" ? 2 : 1);
  }

  const handlePaymentSelection = (payment: SelectedPayment) => {
    setEnrollmentData((prev) => ({
      ...prev,
      selectedPayment: payment,
    }));
  };

  const handleDonationAmountChange = (amount: number) => {
    setEnrollmentData((prev) => ({
      ...prev,
      selectedPayment: prev.selectedPayment
        ? {
            ...prev.selectedPayment,
            amount: amount,
          }
        : null,
    }));
  };

  const handleDonationValidationChange = (isValid: boolean) => {
    setDonationAmountValid(isValid);
  };

  const handleNext = () => {
    if (currentStep < 5) {
      // If payment type is FREE and we're on registration step, skip payment selection
      if (currentStep === 0 && paymentType === "FREE") {
        setCurrentStep(2); // Skip to review step
      } else if (currentStep === 2 && paymentType === "FREE") {
        setCurrentStep(5); // Skip payment steps and go directly to success
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      // If payment type is FREE and we're on success step, go back to review
      if (currentStep === 5 && paymentType === "FREE") {
        setCurrentStep(2);
      } else if (currentStep === 2 && paymentType === "FREE") {
        setCurrentStep(0);
      } else {
        setCurrentStep(currentStep - 1);
      }
    }
  };

  const handleSubmitEnrollment = async () => {
    // For FREE payments, skip payment processing and go directly to success
    if (paymentType === "FREE") {
      setLoading(true);
      try {
        const paymentResponse = await handleEnrollLearnerForPayment({
          registrationData: form.getValues(),
          enrollmentData: enrollmentData,
          // No paymentMethodId for FREE payments
          instituteId,
          enrollInviteId: inviteData?.id,
          payment_option_id:
            inviteData?.package_session_to_payment_options[0].payment_option.id,
          package_session_id:
            inviteData?.package_session_to_payment_options[0]
              ?.package_session_id,
          allowLearnersToCreateCourses:
            JSON.parse(instituteData?.setting)?.setting?.COURSE_SETTING?.data
              ?.permissions?.allowLearnersToCreateCourses || false,
          referRequest: referRequest,
        });
        setPaymentCompletionResponse(paymentResponse);
        setCurrentStep(5); // Go directly to success for FREE payments
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        setError(err?.response?.data?.ex);
      } finally {
        setLoading(false);
      }
      return;
    }

    // For paid payments, process through Stripe
    if (!stripe || !elements) return;

    setLoading(true); // Start loading
    setError(null);

    const cardElement = elements.getElement(CardElement);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: "card",
      card: cardElement,
    });

    if (error) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      setError(error.message);
    } else {
      try {
        const paymentResponse = await handleEnrollLearnerForPayment({
          registrationData: form.getValues(),
          enrollmentData: enrollmentData,
          paymentMethodId: paymentMethod.id,
          instituteId,
          enrollInviteId: inviteData?.id,
          payment_option_id:
            inviteData?.package_session_to_payment_options[0].payment_option.id,
          package_session_id:
            inviteData?.package_session_to_payment_options[0]
              ?.package_session_id,
          allowLearnersToCreateCourses:
            JSON.parse(instituteData?.setting)?.setting?.COURSE_SETTING?.data
              ?.permissions?.allowLearnersToCreateCourses || false,
          referRequest: referRequest,
        });
        setOrderId(paymentResponse?.payment_response?.order_id);
        setPaymentCompletionResponse(paymentResponse);
        setTimeout(() => {
          if (
            paymentResponse?.payment_response?.response_data?.paymentStatus ===
            "PAID"
          ) {
            setCurrentStep(5);
          } else setCurrentStep(4);
        }, 100);
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        setError(err?.response?.data?.ex);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const loadCourseData = async () => {
      try {
        const transformedData = await safeJsonParse(
          inviteData?.web_page_meta_data_json,
          {}
        );
        const paymentTypeValue =
          inviteData?.package_session_to_payment_options[0]?.payment_option
            ?.type || "";
        setPaymentType(paymentTypeValue);

        // If payment type is FREE, ONE_TIME, or DONATION, automatically set the default payment plan
        if (
          paymentTypeValue === "FREE" ||
          paymentTypeValue === "ONE_TIME" ||
          paymentTypeValue === "DONATION"
        ) {
          const defaultPaymentPlan =
            inviteData?.package_session_to_payment_options[0]?.payment_option
              ?.payment_plans?.[0];
          if (defaultPaymentPlan) {
            // Get the unit from payment option metadata to format duration correctly
            const paymentOptionMetadata = JSON.parse(
              inviteData?.package_session_to_payment_options[0]?.payment_option
                ?.payment_option_metadata_json || "{}"
            );
            const unit = paymentOptionMetadata?.unit || "days";

            const duration =
              unit === "days"
                ? `${defaultPaymentPlan.validity_in_days} days`
                : `${Math.floor(
                    defaultPaymentPlan.validity_in_days / 30
                  )} months`;

            // @ts-expect-error // TODO:fix this
            const paymentOption: SelectedPayment = {
              id: defaultPaymentPlan.id,
              name: defaultPaymentPlan.name,
              amount: defaultPaymentPlan.actual_price,
              currency: defaultPaymentPlan.currency,
              description: defaultPaymentPlan.description,
              duration: duration,
              // Include referral option for free plans
              referral_option: defaultPaymentPlan.referral_option,
              // features: [],
            };
            setEnrollmentData((prev) => ({
              ...prev,
              selectedPayment: paymentOption,
            }));
          }
        }
        const transformedJsonData = await transformApiDataToCourseDataForInvite(
          transformedData
        );
        setCourseData({
          aboutCourse: transformedJsonData?.aboutCourse || "",
          course: transformedJsonData?.course || "",
          courseBanner: transformedJsonData?.courseBanner || "",
          courseMedia: transformedJsonData?.courseMediaPreview || "",
          coursePreview: transformedJsonData?.coursePreview || "",
          courseMediaId: {
            type: transformedJsonData?.courseMediaId.type || "",
            id: transformedJsonData?.courseMediaId.id || "",
          },
          customHtml: transformedJsonData?.customHtml || "",
          description: transformedJsonData?.description || "",
          includeInstituteLogo:
            transformedJsonData?.includeInstituteLogo || false,
          includePaymentPlans:
            transformedJsonData?.includePaymentPlans || false,
          instituteLogo: transformedJsonData?.instituteLogo || "",
          learningOutcome: transformedJsonData?.learningOutcome || "",
          restrictToSameBatch:
            transformedJsonData?.restrictToSameBatch || false,
          showRelatedCourses: transformedJsonData?.showRelatedCourses || false,
          tags: transformedJsonData?.tags ?? [],
          targetAudience: transformedJsonData?.targetAudience ?? "",
        });
      } catch (error) {
        console.error("Error transforming course data:", error);
      }
    };

    loadCourseData();
  }, [inviteData]);

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <RegistrationStep
            courseData={courseData}
            inviteData={inviteData}
            instituteId={instituteId}
            onSubmit={onSubmit}
            form={form}
          />
        );
      case 1: {
        // Skip payment selection step for FREE payments
        if (paymentType === "FREE") {
          return (
            <ReviewStep
              courseData={{
                course: courseData.course,
                courseBanner: courseData.courseBanner,
              }}
              selectedPayment={enrollmentData.selectedPayment}
              paymentType={paymentType}
              package_session_id={
                inviteData?.package_session_to_payment_options[0]
                  ?.package_session_id
              }
              setReferRequest={setReferRequest}
              refCode={ref || ""}
            />
          );
        }

        // Parse donation metadata for DONATION payment type
        let donationMetadata = undefined;
        if (paymentType === "DONATION") {
          try {
            const metadata = JSON.parse(
              inviteData?.package_session_to_payment_options[0]?.payment_option
                ?.payment_option_metadata_json || "{}"
            );
            donationMetadata = {
              allowCustomAmount:
                metadata.donationData?.allowCustomAmount || false,
              suggestedAmounts: metadata.donationData?.suggestedAmounts || "",
              minimumAmount: metadata.donationData?.minimumAmount || "0",
            };
          } catch (error) {
            console.error("Error parsing donation metadata:", error);
          }
        }

        return (
          <PaymentSelectionStep
            // @ts-expect-error : //TODO: Create interface for this
            paymentOptions={paymentOptions}
            selectedPayment={enrollmentData.selectedPayment}
            onPaymentSelect={handlePaymentSelection}
            paymentType={paymentType}
            donationMetadata={donationMetadata}
            onAmountChange={handleDonationAmountChange}
            onValidationChange={handleDonationValidationChange}
          />
        );
      }
      case 2:
        return (
          <ReviewStep
            courseData={{
              course: courseData.course,
              courseBanner: courseData.courseBanner,
            }}
            selectedPayment={enrollmentData.selectedPayment}
            paymentType={paymentType}
            package_session_id={
              inviteData?.package_session_to_payment_options[0]
                ?.package_session_id
            }
            setReferRequest={setReferRequest}
            refCode={ref || ""}
          />
        );
      case 3:
        return <PaymentInfoStep error={error} />;
      case 4:
        return (
          <PaymentPendingStep
            paymentCompletionResponse={paymentCompletionResponse!}
            selectedPayment={enrollmentData.selectedPayment}
            orderId={orderId}
            setCurrentStep={setCurrentStep}
          />
        );
      case 5:
        return (
          <SuccessStep
            courseName={courseData.course}
            approvalRequired={
              inviteData?.package_session_to_payment_options[0]?.payment_option
                ?.require_approval || false
            }
            email={enrollmentData?.registrationData?.email?.value || ""}
          />
        );
      default:
        return (
          <RegistrationStep
            courseData={courseData}
            inviteData={inviteData}
            instituteId={instituteId}
            onSubmit={onSubmit}
            form={form}
          />
        );
    }
  };

  useEffect(() => {
    if (instituteData) {
      setInstituteDetails(instituteData);
    }
  }, [instituteData, setInstituteDetails]);

  // Ensure branding is applied on invitation pages using public institute details
  useEffect(() => {
    const syncBranding = async () => {
      try {
        if (!instituteId || !instituteData) return;

        // Persist minimal institute context for branding utilities
        await Preferences.set({ key: "InstituteId", value: instituteId });

        // Map public details to the structure expected elsewhere
        const mappedDetails = {
          id: instituteId,
          institute_name: instituteData?.institute_name ?? instituteData?.name ?? "",
          institute_logo_file_id: instituteData?.institute_logo_file_id ?? null,
          institute_theme_code: instituteData?.institute_theme_code ?? (instituteData?.theme as string) ?? "primary",
          institute_settings_json: instituteData?.setting ?? "",
        } as unknown as {
          id: string;
          institute_name: string;
          institute_logo_file_id: string | null;
          institute_theme_code: string;
          institute_settings_json: string;
        };

        await Preferences.set({
          key: "InstituteDetails",
          value: JSON.stringify(mappedDetails),
        });

        // Store learner branding subset used by applyTabBranding
        const learnerKey = `LEARNER_${instituteId}`;
        const learnerSettings = {
          tabText: instituteData?.tabText ?? instituteData?.institute_name ?? null,
          tabIconFileId: instituteData?.tabIconFileId ?? instituteData?.institute_logo_file_id ?? null,
          fontFamily: instituteData?.fontFamily ?? null,
          theme: instituteData?.institute_theme_code ?? null,
          privacyPolicyUrl: null,
          termsAndConditionUrl: null,
          allowSignup: null,
          allowGoogleAuth: null,
          allowGithubAuth: null,
          allowEmailOtpAuth: null,
          allowUsernamePasswordAuth: null,
        };
        await Preferences.set({ key: learnerKey, value: JSON.stringify(learnerSettings) });

        // Apply tab title, favicon, and font
        await applyTabBranding(document.title);
      } catch (e) {
        // best-effort; do not block invitation flow
        console.warn("[Invite] Branding sync failed", e);
      }
    };

    void syncBranding();
  }, [instituteId, instituteData]);

  // Set up Intersection Observer to detect when registration card is visible
  useEffect(() => {
    const registrationCard = document.getElementById("registration-card");
    if (!registrationCard) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsRegistrationCardVisible(entry.isIntersecting);
        });
      },
      {
        threshold: 0.1, // Trigger when 10% of the element is visible
        rootMargin: "-50px 0px", // Add some margin to trigger earlier
      }
    );

    observer.observe(registrationCard);

    return () => {
      observer.disconnect();
    };
  }, [currentStep]); // Re-run when step changes to ensure the element exists

  if (isLoading || isInstituteLoading) return <DashboardLoader />;

  return (
    <div
      className={`w-full h-auto bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4 sm:px-6 lg:px-8 pb-24`}
    >
      <div className="md:max-w-[80%] mx-auto space-y-8">
        {/* Course Information Card - Only show in registration step */}
        {currentStep === 0 && (
          <CourseInfoCard
            courseData={courseData}
            levelName={
              getDetailsFromPackageSessionId({
                packageSessionId:
                  inviteData.package_session_to_payment_options[0]
                    .package_session_id,
              })?.level.level_name || "-"
            }
          />
        )}

        {/* Current Step Content */}
        {renderCurrentStep()}

        {/* Navigation Buttons - Show for steps 1-3, but skip step 1 for FREE payments */}
        {currentStep > 0 &&
          currentStep < 4 &&
          !(currentStep === 1 && paymentType === "FREE") && (
            <NavigationButtons
              currentStep={currentStep}
              selectedPayment={enrollmentData.selectedPayment}
              onPrevious={handlePrevious}
              onNext={handleNext}
              onSubmitEnrollment={handleSubmitEnrollment}
              loading={loading}
              paymentType={paymentType}
              donationAmountValid={donationAmountValid}
            />
          )}
      </div>

      {/* Fixed bottom container with border - Only show in registration step and when registration card is not visible */}
      {currentStep === 0 && !isRegistrationCardVisible && (
        <div className="flex items-center justify-center py-4 fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <MyButton
            type="button"
            buttonType="secondary"
            scale="large"
            layoutVariant="default"
            onClick={() => {
              const registrationCard =
                document.getElementById("registration-card");
              if (registrationCard) {
                registrationCard.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }
            }}
            className="text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <GraduationCap className="w-5 h-5 mr-2" />
            Enroll Now
          </MyButton>
        </div>
      )}
    </div>
  );
};

export default EnrollByInvite;
