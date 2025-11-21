import { Route } from "@/routes/learner-invitation-response";
import { Preferences } from "@capacitor/preferences";
import { applyTabBranding } from "@/utils/branding";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import {
  handleEnrollLearnerForPayment,
  handleGetEnrollInviteData,
  handleGetPublicInstituteDetails,
  ReferRequest,
} from "./-services/enroll-invite-services";
import { handleGetInstituteCustomFields } from "./-services/custom-fields-setup";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { GraduationCap } from "lucide-react";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  convertInviteCustomFields,
  convertInstituteCustomFields,
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
import { RazorpayCheckoutFormRef } from "./-components/razorpay-checkout-form";
import {
  ModernCard,
  ModernCardHeader,
  ModernCardTitle,
} from "@/components/design-system/modern-card";
import { InstituteBrandingComponent } from "@/components/common/institute-branding";

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
import {
  getPaymentVendor,
  PaymentVendor,
} from "./-utils/payment-vendor-helper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourseStructureDetails as CatalogCourseStructureDetails } from "@/routes/$tagName/-components/CourseStructureDetails";

// SUBSCRIPTION, FREE, UPFRONT, DONATION

interface EnrollByInviteProps {
  vendor?: PaymentVendor;
}

type BundledSessionMeta = {
  packageSessionId: string;
  paymentOptionName?: string;
};

type InvitePackageSession =
  | {
      package_session_id?: string;
      payment_option?: {
        name?: string;
      } | null;
    }
  | null
  | undefined;

const EnrollByInvite = ({ vendor: propVendor }: EnrollByInviteProps = {}) => {
  // Ensure domain resolution runs on this public route to fetch fontFamily/tab branding from /resolve
  const domainRouting = useDomainRouting();
  const [paymentType, setPaymentType] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");
  const [paymentCompletionResponse, setPaymentCompletionResponse] =
    useState(null);
  const [donationAmountValid, setDonationAmountValid] = useState(false);
  const [ewayEncryptedData, setEwayEncryptedData] = useState<{
    encryptedNumber: string;
    encryptedCVN: string;
    cardData: {
      name: string;
      expiryMonth: string;
      expiryYear: string;
    };
  } | null>(null);
  const [stripePaymentProcessor, setStripePaymentProcessor] = useState<
    | (() => Promise<{
        success: boolean;
        paymentMethodId?: string;
        error?: string;
      }>)
    | null
  >(null);
  const [razorpayPaymentData, setRazorpayPaymentData] = useState<{
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  } | null>(null);
  const razorpayRef = useRef<RazorpayCheckoutFormRef>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePackageSessionId, setActivePackageSessionId] = useState<
    string | null
  >(null);

  const [currentStep, setCurrentStep] = useState(0); // 0: Registration, 1: Payment Selection, 2: Review, 3: Payment Details, 4: Payment Pending, 5: Success
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState<string | null>(null);
  const [termsAndConditionUrl, setTermsAndConditionUrl] = useState<
    string | null
  >(null);
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

  // Fetch custom fields from institute if not available in inviteData
  const hasCustomFieldsInInvite =
    inviteData?.institute_custom_fields &&
    inviteData.institute_custom_fields.length > 0;

  const { data: instituteCustomFields } = useQuery({
    ...handleGetInstituteCustomFields({ instituteId }),
    enabled: !hasCustomFieldsInInvite, // Only fetch if not in inviteData
  });

  // Merge custom fields: prioritize inviteData fields, fallback to institute fields
  const finalCustomFields = useMemo(() => {
    if (hasCustomFieldsInInvite) {
      const converted = convertInviteCustomFields(
        inviteData.institute_custom_fields
      );
      return converted;
    }
    // Use convertInstituteCustomFields for institute API response
    if (instituteCustomFields && instituteCustomFields.length > 0) {
      const converted = convertInstituteCustomFields(instituteCustomFields);
      return converted;
    }
    return [];
  }, [
    hasCustomFieldsInInvite,
    inviteData?.institute_custom_fields,
    instituteCustomFields,
  ]);

  // Track whether we're using institute custom fields (not from invite)
  const isUsingInstituteCustomFields =
    !hasCustomFieldsInInvite &&
    instituteCustomFields &&
    instituteCustomFields.length > 0;

  // Determine payment vendor from invite data or prop
  // const vendor = propVendor || getPaymentVendor(inviteData);

  const paymentOptions = getDefaultPlanFromPaymentsData(
    inviteData?.package_session_to_payment_options?.[0]?.payment_option
  );
  const zodSchema = getDynamicSchema(finalCustomFields || []);

  type FormValues = z.infer<typeof zodSchema>;

  // Helper function to generate default values from custom fields
  const generateDefaultValues = useCallback(
    (fields: AssessmentCustomFieldOpenRegistration[]) => {
      return fields
        .sort((a, b) => a.field_order - b.field_order)
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
                config?: string;
                comma_separated_options?: string[];
              }
            >,
            field
          ) => {
            if (field.field_type === "dropdown") {
              defaults[field.field_key] = {
                id: field.id,
                name: field.field_name,
                value: "",
                is_mandatory: field.is_mandatory || false,
                type: field.field_type,
                config: field.config || "{}",
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
              config?: string;
              comma_separated_options?: string[];
            }
          >
        );
    },
    []
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(zodSchema),
    defaultValues: generateDefaultValues(finalCustomFields || []),
    mode: "onChange",
  });

  // Update form when finalCustomFields changes (e.g., when instituteCustomFields loads)
  useEffect(() => {
    if (finalCustomFields && finalCustomFields.length > 0) {
      const newDefaultValues = generateDefaultValues(finalCustomFields);

      form.reset(newDefaultValues);
    }
  }, [finalCustomFields, form, generateDefaultValues]);

  form.watch();

  const isBundledInvite = Boolean(inviteData?.is_bundled);

  const bundledPackageSessions = useMemo<BundledSessionMeta[]>(() => {
    const sessions =
      (inviteData?.package_session_to_payment_options as
        | InvitePackageSession[]
        | undefined) ?? [];
    const seen = new Set<string>();

    return sessions.reduce<BundledSessionMeta[]>((acc, current) => {
      const packageSessionId = current?.package_session_id;
      if (!packageSessionId || seen.has(packageSessionId)) {
        return acc;
      }
      seen.add(packageSessionId);

      acc.push({
        packageSessionId,
        paymentOptionName: current?.payment_option?.name ?? undefined,
      });

      return acc;
    }, []);
  }, [inviteData?.package_session_to_payment_options]);

  // Check if right section (CourseInfoCard) has meaningful data beyond just the course name
  const hasRightSectionContent = useMemo(() => {
    return (
      (courseData.description && courseData.description.trim() !== "") ||
      (courseData.aboutCourse && courseData.aboutCourse.trim() !== "") ||
      (courseData.learningOutcome &&
        courseData.learningOutcome.trim() !== "") ||
      (courseData.tags && courseData.tags.length > 0)
    );
  }, [
    courseData.description,
    courseData.aboutCourse,
    courseData.learningOutcome,
    courseData.tags,
  ]);

  useEffect(() => {
    if (bundledPackageSessions.length > 0) {
      setActivePackageSessionId(bundledPackageSessions[0]?.packageSessionId);
    } else {
      setActivePackageSessionId(null);
    }
  }, [bundledPackageSessions]);

  const resolvePackageSessionLabel = (
    packageSessionId: string,
    fallbackIndex: number
  ) => {
    const details = getDetailsFromPackageSessionId({ packageSessionId });
    const courseName = details?.package_dto?.package_name;
    const levelName = details?.level?.level_name;
    const sessionName = details?.session?.session_name;

    if (courseName && levelName) {
      return `${courseName} · ${levelName}`;
    }

    if (courseName && sessionName) {
      return `${courseName} · ${sessionName}`;
    }

    return (
      courseName || levelName || sessionName || `Course ${fallbackIndex + 1}`
    );
  };

  function onSubmit(values: FormValues) {
    setEnrollmentData((prev) => ({
      ...prev,
      registrationData: values,
    }));

    // Detect single plan (non-donation)
    const paymentOptionMeta =
      inviteData?.package_session_to_payment_options?.[0]?.payment_option;
    const plans = paymentOptionMeta?.payment_plans || [];
    const hasSinglePlan = plans.length === 1;

    // If there's exactly one plan, preselect and skip selection step
    if (hasSinglePlan && paymentType !== "DONATION") {
      if (!enrollmentData.selectedPayment) {
        const onlyPlan = plans[0];
        try {
          const metadata = JSON.parse(
            paymentOptionMeta?.payment_option_metadata_json || "{}"
          );
          const unit = metadata?.unit || "days";
          const duration =
            unit === "days"
              ? `${onlyPlan.validity_in_days} days`
              : `${Math.floor(onlyPlan.validity_in_days / 30)} months`;

          // @ts-expect-error // TODO: strong type SelectedPayment mapping
          const preselected: SelectedPayment = {
            id: onlyPlan.id,
            name: onlyPlan.name,
            amount: onlyPlan.actual_price,
            currency: onlyPlan.currency,
            description: onlyPlan.description,
            duration,
            // include numeric pricing fields for summary calculations
            actual_price: onlyPlan.actual_price,
            elevated_price: onlyPlan.elevated_price,
            validity_in_days: onlyPlan.validity_in_days,
            referral_option: onlyPlan.referral_option,
          };
          setEnrollmentData((prev) => ({
            ...prev,
            selectedPayment: preselected,
          }));
        } catch {
          // ignore parse errors and continue normal flow
        }
      }
      setCurrentStep(2);
      return;
    }

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
      } else if (
        currentStep === 0 &&
        paymentType !== "DONATION" &&
        (inviteData?.package_session_to_payment_options?.[0]?.payment_option
          ?.payment_plans?.length || 0) === 1
      ) {
        setCurrentStep(2); // Skip selection when only one plan
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
      } else if (
        currentStep === 2 &&
        paymentType !== "DONATION" &&
        (inviteData?.package_session_to_payment_options?.[0]?.payment_option
          ?.payment_plans?.length || 0) === 1
      ) {
        setCurrentStep(0); // Skip selection on back when only one plan
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
          package_session_ids:
            inviteData?.package_session_to_payment_options.map(
              (ps: { package_session_id: string }) => ps?.package_session_id
            ) || [""],
          allowLearnersToCreateCourses:
            JSON.parse(instituteData?.setting)?.setting?.COURSE_SETTING?.data
              ?.permissions?.allowLearnersToCreateCourses || false,
          referRequest: referRequest,
          paymentVendor: "STRIPE", // Default for FREE payments
          isUsingInstituteCustomFields: isUsingInstituteCustomFields,
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

    // Determine payment vendor
    const vendor = getPaymentVendor(inviteData);
    // For EWAY payments
    if (vendor === "EWAY") {
      if (!ewayEncryptedData) {
        setError("Please complete the payment form");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const paymentResponse = await handleEnrollLearnerForPayment({
          registrationData: form.getValues(),
          enrollmentData: enrollmentData,
          instituteId,
          enrollInviteId: inviteData?.id,
          payment_option_id:
            inviteData?.package_session_to_payment_options[0].payment_option.id,
          package_session_ids:
            inviteData?.package_session_to_payment_options.map(
              (ps: { package_session_id: string }) => ps?.package_session_id
            ) || [""],
          allowLearnersToCreateCourses:
            JSON.parse(instituteData?.setting)?.setting?.COURSE_SETTING?.data
              ?.permissions?.allowLearnersToCreateCourses || false,
          referRequest: referRequest,
          ewayPaymentData: ewayEncryptedData,
          paymentVendor: "EWAY",
          isUsingInstituteCustomFields: isUsingInstituteCustomFields,
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
        console.error(err);
      } finally {
        setLoading(false);
      }
      return;
    }

    // For RAZORPAY payments
    if (vendor === "RAZORPAY") {
      setLoading(true);
      setError(null);

      try {
        // Step 1: Call enrollment API to create order (without payment data)
        const paymentResponse = await handleEnrollLearnerForPayment({
          registrationData: form.getValues(),
          enrollmentData: enrollmentData,
          instituteId,
          enrollInviteId: inviteData?.id,
          payment_option_id:
            inviteData?.package_session_to_payment_options[0].payment_option.id,
          package_session_ids:
            inviteData?.package_session_to_payment_options.map(
              (ps: { package_session_id: string }) => ps?.package_session_id
            ) || [""],
          allowLearnersToCreateCourses:
            JSON.parse(instituteData?.setting)?.setting?.COURSE_SETTING?.data
              ?.permissions?.allowLearnersToCreateCourses || false,
          referRequest: referRequest,
          razorpayPaymentData: razorpayPaymentData || undefined, // Will be undefined on first call
          paymentVendor: "RAZORPAY",
          isUsingInstituteCustomFields: isUsingInstituteCustomFields,
        });

        // Step 2: Extract order details from response
        const orderDetails = paymentResponse?.payment_response?.response_data;

        if (
          !orderDetails ||
          !orderDetails.razorpayKeyId ||
          !orderDetails.razorpayOrderId
        ) {
          throw new Error("Failed to create Razorpay order");
        }

        // Store order ID for later use
        setOrderId(paymentResponse?.payment_response?.order_id);
        setPaymentCompletionResponse(paymentResponse);

        // Step 3: Open Razorpay payment modal
        if (razorpayRef.current) {
          razorpayRef.current.openPayment({
            razorpayKeyId: orderDetails.razorpayKeyId,
            razorpayOrderId: orderDetails.razorpayOrderId,
            amount: orderDetails.amount,
            currency: orderDetails.currency || "INR",
            contact: orderDetails.contact || "",
            email: orderDetails.email || "",
          });
        } else {
          throw new Error("Razorpay component not ready");
        }

        setLoading(false);
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        setError(err?.response?.data?.ex || "Failed to initiate payment");
        console.error("Razorpay enrollment error:", err);
        setLoading(false);
      }
      return;
    }

    if (
      !stripePaymentProcessor ||
      typeof stripePaymentProcessor !== "function"
    ) {
      setError("Stripe payment is not ready yet. Please wait and try again.");
      console.error("Stripe payment processor not ready:", {
        value: stripePaymentProcessor,
        type: typeof stripePaymentProcessor,
      });
      return;
    }

    setLoading(true);
    setError(null);

    // Process Stripe payment
    const stripeResult = await stripePaymentProcessor();

    if (!stripeResult.success || !stripeResult.paymentMethodId) {
      setError(stripeResult.error || "Payment processing failed");
      setLoading(false);
      return;
    }

    try {
      const paymentResponse = await handleEnrollLearnerForPayment({
        registrationData: form.getValues(),
        enrollmentData: enrollmentData,
        paymentMethodId: stripeResult.paymentMethodId,
        instituteId,
        enrollInviteId: inviteData?.id,
        payment_option_id:
          inviteData?.package_session_to_payment_options[0].payment_option.id,
        package_session_ids: inviteData?.package_session_to_payment_options.map(
          (ps: { package_session_id: string }) => ps?.package_session_id
        ) || [""],
        allowLearnersToCreateCourses:
          JSON.parse(instituteData?.setting)?.setting?.COURSE_SETTING?.data
            ?.permissions?.allowLearnersToCreateCourses || false,
        referRequest: referRequest,
        paymentVendor: "STRIPE",
        isUsingInstituteCustomFields: isUsingInstituteCustomFields,
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Complete enrollment after Razorpay payment is successful
  useEffect(() => {
    const vendor = propVendor || getPaymentVendor(inviteData);

    if (
      vendor === "RAZORPAY" &&
      razorpayPaymentData &&
      !loading &&
      currentStep === 3
    ) {
      // Call API again with payment details to complete the enrollment
      const completeRazorpayEnrollment = async () => {
        setLoading(true);
        setError(null);

        try {
          const paymentResponse = await handleEnrollLearnerForPayment({
            registrationData: form.getValues(),
            enrollmentData: enrollmentData,
            instituteId,
            enrollInviteId: inviteData?.id,
            payment_option_id:
              inviteData?.package_session_to_payment_options[0].payment_option
                .id,
            package_session_ids:
              inviteData?.package_session_to_payment_options.map(
                (ps: { package_session_id: string }) => ps?.package_session_id
              ) || [""],
            allowLearnersToCreateCourses:
              JSON.parse(instituteData?.setting)?.setting?.COURSE_SETTING?.data
                ?.permissions?.allowLearnersToCreateCourses || false,
            referRequest: referRequest,
            razorpayPaymentData: razorpayPaymentData, // Now includes payment details
            paymentVendor: "RAZORPAY",
            isUsingInstituteCustomFields: isUsingInstituteCustomFields,
          });

          setPaymentCompletionResponse(paymentResponse);

          // Check payment status and navigate accordingly
          setTimeout(() => {
            if (
              paymentResponse?.payment_response?.response_data
                ?.paymentStatus === "PAID"
            ) {
              setCurrentStep(5);
            } else {
              setCurrentStep(4);
            }
          }, 100);
        } catch (err) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          setError(err?.response?.data?.ex || "Failed to complete enrollment");
          console.error("Razorpay completion error:", err);
        } finally {
          setLoading(false);
        }
      };

      completeRazorpayEnrollment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [razorpayPaymentData]);

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
          const paymentOptionMeta =
            inviteData?.package_session_to_payment_options[0]?.payment_option;
          const plans = paymentOptionMeta?.payment_plans || [];
          const defaultPaymentPlan = plans[0];
          if (defaultPaymentPlan) {
            // Get the unit from payment option metadata to format duration correctly
            const paymentOptionMetadata = JSON.parse(
              paymentOptionMeta?.payment_option_metadata_json || "{}"
            );
            const unit = paymentOptionMetadata?.unit || "days";

            const duration =
              unit === "days"
                ? `${defaultPaymentPlan.validity_in_days} days`
                : `${Math.floor(
                    defaultPaymentPlan.validity_in_days / 30
                  )} months`;

            // @ts-expect-error // TODO:fix this
            const preselectedPayment: SelectedPayment = {
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
              selectedPayment: preselectedPayment,
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

  // Helper function to get user details from registration data
  const getUserDetails = () => {
    const registrationData = form.getValues();

    // Find email field
    const emailEntry = Object.entries(registrationData).find(([key]) => {
      const lowerKey = key.toLowerCase();
      return (
        lowerKey.includes("email") ||
        lowerKey.includes("mail") ||
        lowerKey.includes("mailid")
      );
    });

    // Find phone/contact field
    const phoneEntry = Object.entries(registrationData).find(([key]) => {
      const lowerKey = key.toLowerCase();
      return (
        lowerKey.includes("phone") ||
        lowerKey.includes("mobile") ||
        lowerKey.includes("contact") ||
        lowerKey.includes("tel")
      );
    });

    // Find name field
    const nameEntry = Object.entries(registrationData).find(([key]) => {
      const lowerKey = key.toLowerCase();
      return (
        lowerKey.includes("name") ||
        lowerKey.includes("full_name") ||
        lowerKey.includes("fullname")
      );
    });

    return {
      email: emailEntry ? String(emailEntry[1]?.value || "") : "",
      contact: phoneEntry ? String(phoneEntry[1]?.value || "") : "",
      name: nameEntry ? String(nameEntry[1]?.value || "") : "",
    };
  };

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
      case 3: {
        const vendor = propVendor || getPaymentVendor(inviteData);
        const userDetails = getUserDetails();
        return (
          <PaymentInfoStep
            error={error}
            vendor={vendor}
            amount={
              enrollmentData.selectedPayment?.actual_price ||
              enrollmentData.selectedPayment?.amount
            }
            currency={enrollmentData.selectedPayment?.currency}
            onEwayPaymentReady={setEwayEncryptedData}
            onEwayError={setError}
            onStripePaymentReady={(processor) => {
              setStripePaymentProcessor(() => processor);
            }}
            onRazorpayPaymentReady={setRazorpayPaymentData}
            onRazorpayError={setError}
            isProcessing={loading}
            userName={userDetails.name}
            userEmail={userDetails.email}
            userContact={userDetails.contact}
            courseName={
              courseData.aboutCourse ||
              enrollmentData.selectedPayment?.name ||
              "Course Enrollment"
            }
            courseDescription={
              courseData.description ||
              enrollmentData.selectedPayment?.description ||
              "Payment for course enrollment"
            }
            razorpayRef={razorpayRef}
          />
        );
      }
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
          institute_name:
            instituteData?.institute_name ?? instituteData?.name ?? "",
          institute_logo_file_id: instituteData?.institute_logo_file_id ?? null,
          institute_theme_code:
            instituteData?.institute_theme_code ??
            (instituteData?.theme as string) ??
            "primary",
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
          tabText:
            instituteData?.tabText ?? instituteData?.institute_name ?? null,
          tabIconFileId:
            instituteData?.tabIconFileId ??
            instituteData?.institute_logo_file_id ??
            null,
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
        await Preferences.set({
          key: learnerKey,
          value: JSON.stringify(learnerSettings),
        });

        // Apply tab title, favicon, and font
        await applyTabBranding(document.title);
      } catch (e) {
        // best-effort; do not block invitation flow
        console.warn("[Invite] Branding sync failed", e);
      }
    };

    void syncBranding();
  }, [instituteId, instituteData]);

  // Load policy URLs from per-institute learner settings stored by domain resolution
  useEffect(() => {
    const loadPolicyLinks = async () => {
      try {
        if (!instituteId) return;
        const key = `LEARNER_${instituteId}`;
        const stored = await Preferences.get({ key });
        if (stored?.value) {
          const parsed = JSON.parse(stored.value);
          setPrivacyPolicyUrl(parsed?.privacyPolicyUrl || null);
          setTermsAndConditionUrl(parsed?.termsAndConditionUrl || null);
        }
      } catch {
        // ignore
      }
    };
    void loadPolicyLinks();
  }, [instituteId]);

  if (isLoading || isInstituteLoading) return <DashboardLoader />;

  // Helper to extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  return (
    <div className={`w-full h-auto bg-gradient-to-br from-slate-50 to-blue-50`}>
      {/* Navbar Header - Only show institute logo if includeInstituteLogo is true */}
      {courseData.includeInstituteLogo && (
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-6">
            <div className="flex items-center justify-start h-18 sm:h-16 py-3 p-3 sm:py-4">
              <InstituteBrandingComponent
                branding={{
                  instituteId: instituteId || null,
                  instituteName:
                    instituteData?.institute_name ??
                    instituteData?.name ??
                    null,
                  instituteLogoFileId:
                    instituteData?.institute_logo_file_id ?? null,
                  instituteThemeCode:
                    (instituteData?.institute_theme_code as string) ||
                    (instituteData?.theme as string) ||
                    null,
                  homeIconClickRoute: domainRouting.homeIconClickRoute ?? null,
                }}
                size="medium"
                showName={true}
                className="!flex-row !items-center !gap-3 sm:!gap-4"
              />
            </div>
          </div>
        </nav>
      )}

      {/* Hero Section with Banner and Course Media */}
      <div
        className="relative w-full bg-cover bg-center flex items-center"
        style={{
          backgroundImage: courseData.courseBanner
            ? `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${courseData.courseBanner})`
            : "linear-gradient(to right, #667eea 0%, #764ba2 100%)",
          minHeight: "500px",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Left Side: Course Info and Enroll Button */}
            <div
              className={`text-white flex flex-col ${
                courseData.description
                  ? "justify-start"
                  : "justify-center items-start"
              }`}
            >
              <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                {inviteData?.name || courseData.course}
              </h1>

              {courseData.description && (
                <div
                  className="text-lg text-gray-100 leading-relaxed mt-6 flex-grow"
                  dangerouslySetInnerHTML={{ __html: courseData.description }}
                />
              )}

              {/* Enroll Button */}
              {currentStep === 0 && (
                <div className={courseData.description ? "mt-8" : "mt-6"}>
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

            {/* Right Side: Course Media (YouTube Video) */}
            {courseData.courseMedia &&
              courseData.courseMediaId?.type === "youtube" && (
                <div className="w-full">
                  <div
                    className="relative rounded-lg overflow-hidden shadow-2xl"
                    style={{ paddingBottom: "56.25%" }}
                  >
                    <iframe
                      className="absolute top-0 left-0 w-full h-full"
                      src={`https://www.youtube.com/embed/${getYouTubeVideoId(
                        courseData.courseMediaId.id
                      )}`}
                      title={courseData.course}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-11/12 mx-auto space-y-8">
          {/* Main Grid Layout - Full width if no right section content */}
          <div
            className={`grid grid-cols-1 ${
              hasRightSectionContent ? "lg:grid-cols-3" : ""
            } gap-8`}
          >
            {/* Left: Course Structure Preview & Step Content (Subscription Model) */}
            <div
              className={`${
                hasRightSectionContent ? "lg:col-span-2" : "w-full"
              } space-y-4 sm:space-y-6`}
            >
              {/* Course Structure Section - Above Subscription - Only show on step 0 */}

              {/* Subscription/Registration Form */}
              {renderCurrentStep()}

              {currentStep === 0 &&
                isBundledInvite &&
                bundledPackageSessions.length > 0 && (
                  <ModernCard
                    variant="glass"
                    padding="lg"
                    rounded="lg"
                    className="border border-white/40 bg-white/90 backdrop-blur-md shadow-lg"
                  >
                    <ModernCardHeader className="p-0 mb-2 ">
                      <ModernCardTitle
                        size="md"
                        className="text-neutral-800 text-xl sm:text-2xl"
                      >
                        Course Structure Preview
                      </ModernCardTitle>
                    </ModernCardHeader>
                    {/* <p className="text-xs sm:text-sm text-neutral-500 mb-3 sm:mb-4">
                  Review what&apos;s included in each bundled course before you enroll.
                </p> */}

                    {bundledPackageSessions.length > 1 ? (
                      <Tabs
                        value={
                          activePackageSessionId ??
                          bundledPackageSessions[0]?.packageSessionId
                        }
                        onValueChange={setActivePackageSessionId}
                      >
                        <div className="bg-neutral-100/70 rounded-lg p-3 mb-4">
                          {/* <h3 className="text-sm font-semibold text-neutral-700 mb-3 px-1">
                        Select a Course:
                      </h3> */}
                          <TabsList className="flex flex-wrap w-full gap-2 bg-transparent p-0 h-auto">
                            {bundledPackageSessions.map((session, index) => (
                              <TabsTrigger
                                key={session.packageSessionId}
                                value={session.packageSessionId}
                                className="flex-1 min-w-[calc(50%-0.25rem)] sm:min-w-[calc(50%-0.5rem)] md:min-w-[calc(33.333%-0.5rem)] border-1 border-gray-300 rounded-md px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-neutral-700 bg-white transition-all duration-200 cursor-pointer hover:bg-primary-50 hover:border-primary-400 data-[state=active]:bg-gray-400 data-[state=active]:text-white data-[state=active]:border-gray-700 data-[state=active]:shadow-md"
                              >
                                {resolvePackageSessionLabel(
                                  session.packageSessionId,
                                  index
                                )}
                              </TabsTrigger>
                            ))}
                          </TabsList>
                        </div>

                        {bundledPackageSessions.map((session) => (
                          <TabsContent
                            key={session.packageSessionId}
                            value={session.packageSessionId}
                            className="focus-visible:outline-none focus-visible:ring-0"
                          >
                            {activePackageSessionId ===
                            session.packageSessionId ? (
                              (() => {
                                const sessionDetails =
                                  getDetailsFromPackageSessionId({
                                    packageSessionId: session.packageSessionId,
                                  });
                                const previewCourseId =
                                  sessionDetails?.package_dto?.id ?? "";
                                const previewLevelId =
                                  sessionDetails?.level?.id ?? undefined;

                                if (!previewCourseId) {
                                  return (
                                    <div className="rounded-lg border border-dashed border-neutral-200 p-3 sm:p-4 text-xs text-neutral-500">
                                      Course structure will appear once the
                                      institute shares the full course catalog.
                                    </div>
                                  );
                                }

                                return (
                                  <div className="rounded-lg border border-neutral-100 bg-white/70 p-2 sm:p-3">
                                    <CatalogCourseStructureDetails
                                      key={session.packageSessionId}
                                      courseDepth={5}
                                      courseId={previewCourseId}
                                      instituteId={instituteId ?? ""}
                                      packageSessionId={
                                        session.packageSessionId
                                      }
                                      levelId={previewLevelId}
                                    />
                                  </div>
                                );
                              })()
                            ) : (
                              <div className="rounded-lg border border-dashed border-neutral-200 p-3 sm:p-4 text-xs text-neutral-500">
                                Select a course above to preview its structure.
                              </div>
                            )}
                          </TabsContent>
                        ))}
                      </Tabs>
                    ) : (
                      <div>
                        {(() => {
                          const singleSessionId =
                            bundledPackageSessions[0]?.packageSessionId ?? "";
                          if (!singleSessionId) {
                            return (
                              <div className="rounded-lg border border-dashed border-neutral-200 p-3 sm:p-4 text-xs text-neutral-500">
                                Course structure preview will appear shortly.
                              </div>
                            );
                          }
                          const sessionDetails = getDetailsFromPackageSessionId(
                            {
                              packageSessionId: singleSessionId,
                            }
                          );
                          const previewCourseId =
                            sessionDetails?.package_dto?.id ?? "";
                          const previewLevelId =
                            sessionDetails?.level?.id ?? undefined;

                          if (!previewCourseId) {
                            return (
                              <div className="rounded-lg border border-dashed border-neutral-200 p-3 sm:p-4 text-xs text-neutral-500">
                                Course structure will appear once the institute
                                shares the full course catalog.
                              </div>
                            );
                          }

                          return (
                            <div className="rounded-lg border border-neutral-100 bg-white/70 p-2 sm:p-3">
                              <CatalogCourseStructureDetails
                                courseDepth={5}
                                courseId={previewCourseId}
                                instituteId={instituteId ?? ""}
                                packageSessionId={singleSessionId}
                                levelId={previewLevelId}
                              />
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </ModernCard>
                )}

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
                    paymentVendor={
                      currentStep === 3
                        ? getPaymentVendor(inviteData)
                        : undefined
                    }
                    isPaymentDataReady={
                      currentStep === 3
                        ? getPaymentVendor(inviteData) === "EWAY"
                          ? !!ewayEncryptedData
                          : getPaymentVendor(inviteData) === "STRIPE"
                          ? !!stripePaymentProcessor
                          : getPaymentVendor(inviteData) === "RAZORPAY"
                          ? !!razorpayPaymentData
                          : false
                        : false
                    }
                  />
                )}
            </div>

            {/* Right: Course Info Sidebar - Only show if there's meaningful content */}
            {hasRightSectionContent && (
              <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-6 self-start">
                <CourseInfoCard
                  courseData={{
                    ...courseData,
                    instituteLogo: "",
                    course: inviteData?.name || courseData.course,
                  }}
                  levelName={
                    getDetailsFromPackageSessionId({
                      packageSessionId:
                        activePackageSessionId ??
                        inviteData?.package_session_to_payment_options?.[0]
                          ?.package_session_id ??
                        "",
                    })?.level?.level_name || "-"
                  }
                />
              </div>
            )}
          </div>

          {/* Policy Links */}
          <div className="flex items-center justify-center gap-4 text-sm text-gray-600 pb-8">
            <a
              href={privacyPolicyUrl || "/privacy-policy"}
              target={privacyPolicyUrl ? "_blank" : undefined}
              rel={privacyPolicyUrl ? "noopener noreferrer" : undefined}
              className="hover:underline"
            >
              Privacy Policy
            </a>
            <span className="text-gray-300">•</span>
            <a
              href={termsAndConditionUrl || "/terms-and-conditions"}
              target={termsAndConditionUrl ? "_blank" : undefined}
              rel={termsAndConditionUrl ? "noopener noreferrer" : undefined}
              className="hover:underline"
            >
              Terms & Conditions
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnrollByInvite;
