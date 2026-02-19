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
  submitEnrollmentForm,
  getEnrollmentPolicy,
  getPasswordField,
} from "./-services/enroll-invite-services";
import { handleGetInstituteCustomFields } from "./-services/custom-fields-setup";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { GraduationCap } from "lucide-react";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { loginEnrolledUser } from "@/services/signup-api";
import { performFullAuthCycle } from "@/services/auth-cycle-service";
import { BASE_URL_LEARNER_DASHBOARD } from "@/constants/urls";
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
import { toast } from "sonner";
import { RazorpayCheckoutFormRef } from "./-components/razorpay-checkout-form";
import { InstituteBrandingComponent } from "@/components/common/institute-branding";
import {
  initiateCashfreePayment,
  getCashfreeReturnUrl,
} from "@/services/cashfree-payment";
import { load as loadCashfree } from "@cashfreepayments/cashfree-js";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";

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
  EnrollmentPolicyDialog,
  EnrollmentPolicyResponse,
  EnrollmentPolicyDialogType,
} from "./-components";
import {
  getPaymentVendor,
  PaymentVendor,
} from "./-utils/payment-vendor-helper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourseStructureDetails as CatalogCourseStructureDetails } from "@/routes/$tagName/-components/CourseStructureDetails";

// SUBSCRIPTION, FREE, UPFRONT, DONATION

// Helper function to check if HTML content has actual visible text
// Returns false for empty HTML like "<p></p>", "<p> </p>", or just whitespace
const hasContent = (htmlString: string | undefined | null): boolean => {
  if (!htmlString) return false;
  // Strip HTML tags and decode HTML entities
  const textContent = htmlString
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/gi, ' ') // Replace &nbsp; with space
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  return textContent.length > 0;
};

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
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);
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
  const [cashfreeSessionData, setCashfreeSessionData] = useState<{
    paymentSessionId: string;
    orderId: string;
  } | null>(null);
  const [cashfreeInitLoading, setCashfreeInitLoading] = useState(false);
  const cashfreeInitAttemptedRef = useRef(false);
  // Ref to prevent double auto-enrollment for FREE courses
  const hasAutoEnrolledRef = useRef(false);
  // Ref to track if prefill data has been applied (prevents double reset)
  const hasPrefillAppliedRef = useRef(false);
  const [activePackageSessionId, setActivePackageSessionId] = useState<
    string | null
  >(null);
  const [submittedUserId, setSubmittedUserId] = useState<string | null>(null);

  // Enrollment Policy Dialog state
  const [enrollmentPolicyDialogOpen, setEnrollmentPolicyDialogOpen] = useState(false);
  const [enrollmentPolicyDialogType, setEnrollmentPolicyDialogType] = useState<EnrollmentPolicyDialogType>("success_with_actions");
  const [enrollmentPolicyResponse, setEnrollmentPolicyResponse] = useState<EnrollmentPolicyResponse | null>(null);

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
  // Ref to track the latest referRequest value (to avoid closure issues)
  const referRequestRef = useRef<ReferRequest | null>(null);
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
  
  // Keep ref in sync with state for referRequest (to avoid closure issues)
  useEffect(() => {
    referRequestRef.current = referRequest;
    console.log("[enroll-form] referRequest state updated:", referRequest);
  }, [referRequest]);

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

  // Helper to safely get allowLearnersToCreateCourses from instituteData settings
  const getAllowLearnersToCreateCourses = useCallback(() => {
    try {
      if (!instituteData?.setting) return false;
      const parsed = JSON.parse(instituteData.setting);
      return parsed?.setting?.COURSE_SETTING?.data?.permissions?.allowLearnersToCreateCourses || false;
    } catch {
      console.warn("Failed to parse institute settings, defaulting to false");
      return false;
    }
  }, [instituteData?.setting]);

  const form = useForm<FormValues>({
    resolver: zodResolver(zodSchema),
    defaultValues: generateDefaultValues(finalCustomFields || []),
    mode: "onChange",
  });

  // Update form when finalCustomFields changes (e.g., when instituteCustomFields loads)
  useEffect(() => {
    if (finalCustomFields && finalCustomFields.length > 0) {
      const newDefaultValues = generateDefaultValues(finalCustomFields);
      let shouldResetForm = false;
      let hasPrefillData = false;

      // Check for prefill data from previous upgrade flow
      try {
        const prefillDataStr = localStorage.getItem("enrollment_prefill_data");
        if (prefillDataStr) {
          console.log("[Prefill] Found prefill data in LocalStorage");
          const prefillData = JSON.parse(prefillDataStr);
          hasPrefillData = true;

          Object.keys(prefillData).forEach((key) => {
            // value is the string value
            const val = prefillData[key];

            // 1. Try exact key match
            if (newDefaultValues[key]) {
              console.log(`[Prefill] Exact match for ${key}`);
              newDefaultValues[key].value = val;
            }
            // 2. Try Smart Matching for standard fields if not a "smart" key itself
            else if (!key.startsWith('__smart_')) {
              // Skip non-matching standard keys
            }
          });

          // 3. Apply Smart Keys if exist and target field is empty
          if (prefillData['__smart_email']) {
            const emailKey = Object.keys(newDefaultValues).find(k =>
              k.toLowerCase().includes('email') || k.toLowerCase().includes('mail')
            );
            if (emailKey && !newDefaultValues[emailKey].value) {
              console.log(`[Prefill] Smart match for Email -> ${emailKey}`);
              newDefaultValues[emailKey].value = prefillData['__smart_email'];
            }
          }

          if (prefillData['__smart_phone']) {
            const phoneKey = Object.keys(newDefaultValues).find(k =>
              k.toLowerCase().includes('phone') || k.toLowerCase().includes('mobile') || k.toLowerCase().includes('contact')
            );
            if (phoneKey && !newDefaultValues[phoneKey].value) {
              console.log(`[Prefill] Smart match for Phone -> ${phoneKey}`);
              newDefaultValues[phoneKey].value = prefillData['__smart_phone'];
            }
          }

          if (prefillData['__smart_name']) {
            const nameKey = Object.keys(newDefaultValues).find(k =>
              k.toLowerCase().includes('name') || k.toLowerCase().includes('full_name')
            );
            if (nameKey && !newDefaultValues[nameKey].value) {
              console.log(`[Prefill] Smart match for Name -> ${nameKey}`);
              newDefaultValues[nameKey].value = prefillData['__smart_name'];
            }
          }

          // Remove from localStorage after reading
          localStorage.removeItem("enrollment_prefill_data");

          // Mark that prefill has been applied
          hasPrefillAppliedRef.current = true;
          shouldResetForm = true;
        } else {
          console.log("[Prefill] No prefill data found");
          // Only reset form with empty values if prefill was never applied before
          // This prevents React Strict Mode / double-render from clearing prefilled values
          if (!hasPrefillAppliedRef.current) {
            shouldResetForm = true;
          } else {
            console.log("[Prefill] Skipping form reset to preserve prefilled values");
          }
        }
      } catch (e) {
        console.error("Error applying prefill data", e);
        // On error, still allow form reset if no prefill was applied
        if (!hasPrefillAppliedRef.current) {
          shouldResetForm = true;
        }
      }

      if (shouldResetForm) {
        console.log("[Prefill] Resetting form with values:", newDefaultValues);
        form.reset(newDefaultValues);
      }
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

  const currentLevelName = useMemo(() => {
    const pId =
      activePackageSessionId ??
      inviteData?.package_session_to_payment_options?.[0]?.package_session_id ??
      "";
    return (
      getDetailsFromPackageSessionId({ packageSessionId: pId })?.level
        ?.level_name || "-"
    );
  }, [
    activePackageSessionId,
    inviteData?.package_session_to_payment_options,
    getDetailsFromPackageSessionId,
  ]);

  const hasLevelName = useMemo(() => {
    const normalized = (currentLevelName || "").trim().toLowerCase();
    return normalized && normalized !== "default" && normalized !== "-";
  }, [currentLevelName]);

  // Check if right section (CourseInfoCard) has meaningful data beyond just the course name
  const hasRightSectionContent = useMemo(() => {
    return (
      hasContent(courseData.aboutCourse) ||
      hasContent(courseData.learningOutcome) ||
      hasLevelName
    );
  }, [courseData.aboutCourse, courseData.learningOutcome, hasLevelName]);

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

  async function onSubmit(values: FormValues) {
    setEnrollmentData((prev) => ({
      ...prev,
      registrationData: values,
    }));

    // Detect single plan (non-donation)
    const paymentOptionMeta =
      inviteData?.package_session_to_payment_options?.[0]?.payment_option;
    const plans = paymentOptionMeta?.payment_plans || [];
    const hasSinglePlan = plans.length === 1;

    let targetStep = 1;

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
      targetStep = 2;
    } else if (paymentType === "FREE") {
      targetStep = 2; // For FREE payments, go directly to review step
    }

    // Step 1: Submit Form API (Abandoned Cart Tracking) - SKIP for FREE courses
    if (paymentType !== "FREE") {
      setLoading(true);
      try {
        const packageSessionIds =
          inviteData?.package_session_to_payment_options.map(
            (ps: { package_session_id: string }) => ps?.package_session_id
          ) || [""];

        const response = await submitEnrollmentForm({
          registrationData: values,
          instituteId,
          enrollInviteId: inviteData?.id,
          package_session_ids: packageSessionIds,
          isUsingInstituteCustomFields,
        });

        if (response?.user_id) {
          setSubmittedUserId(response.user_id);
        }
      } catch (error) {
        console.error("Form submission failed (non-blocking):", error);
        // We do not block the user; they can proceed to payment step without this
      } finally {
        setLoading(false);
      }
    }

    setCurrentStep(targetStep);
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
      // Reset auto-enroll flag when going back from review step or success step
      if (currentStep === 2 || currentStep === 5) {
        hasAutoEnrolledRef.current = false;
      }
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

  const handleAutoLogin = async (response: any) => {
    // Check for direct tokens first (most automatic flow)
    const directAccessToken = response?.payment_response?.response_data?.accessToken;
    const directRefreshToken = response?.payment_response?.response_data?.refreshToken;

    if (directAccessToken && directRefreshToken) {
      try {
        setIsAutoLoggingIn(true);
        console.log("[EnrollByInvite] Using direct tokens from response");
        await performFullAuthCycle({ accessToken: directAccessToken, refreshToken: directRefreshToken }, instituteId);

        toast.success("Enrollment successful! Redirecting to dashboard...");
        setTimeout(() => {
          window.location.href = `${BASE_URL_LEARNER_DASHBOARD}/study-library/courses`;
        }, 1500);
        return;
      } catch (error) {
        console.error("[EnrollByInvite] Auth cycle with direct tokens failed:", error);
        // Fallback to credential-based login if token login fails
      }
    }

    const userEmail = response?.user?.email;
    const userPassword = response?.user?.password;

    if (userEmail && userPassword) {
      try {
        setIsAutoLoggingIn(true);
        console.log("[EnrollByInvite] Performing auto-login using credentials");
        const loginResponse = await loginEnrolledUser(userEmail, userPassword, instituteId);
        await performFullAuthCycle(loginResponse, instituteId);

        toast.success("Login successful! Redirecting to dashboard...");
        setTimeout(() => {
          window.location.href = `${BASE_URL_LEARNER_DASHBOARD}/study-library/courses`;
        }, 1500);
      } catch (error) {
        console.error("[EnrollByInvite] Auto-login failed:", error);
        setIsAutoLoggingIn(false);
      }
    } else {
      // If no credentials, user might be already logged in or it's an existing user
      // We still wait a bit then redirect
      setTimeout(() => {
        window.location.href = `${BASE_URL_LEARNER_DASHBOARD}/study-library/courses`;
      }, 2000);
    }
  };

  // Helper function to fetch enrollment policy and show appropriate dialog
  // Helper function to fetch enrollment policy and show appropriate dialog
  const fetchAndHandleEnrollmentPolicy = async (
    scenario: "success" | "error_already_enrolled" = "success"
  ) => {
    try {
      const packageSessionId =
        inviteData?.package_session_to_payment_options?.[0]?.package_session_id;

      if (!packageSessionId) {
        console.log(
          "[EnrollByInvite] No package session ID available for enrollment policy"
        );
        return;
      }

      const policyResponse = await getEnrollmentPolicy({ packageSessionId });
      console.log(
        "[EnrollByInvite] Enrollment policy response:",
        policyResponse
      );

      if (policyResponse && Object.keys(policyResponse).length > 0) {
        setEnrollmentPolicyResponse(policyResponse);

        if (scenario === "success") {
          // Check if there are frontend actions to show
          const hasFrontendActions =
            policyResponse?.workflow?.enabled &&
            policyResponse?.workflow?.frontendActions &&
            Object.keys(policyResponse.workflow.frontendActions).length > 0;

          if (hasFrontendActions) {
            setEnrollmentPolicyDialogType("success_with_actions");
            setEnrollmentPolicyDialogOpen(true);
          }
        } else if (scenario === "error_already_enrolled") {
          // Determine strictness and type of blockage
          let dialogType: EnrollmentPolicyDialogType = "already_enrolled";

          // If there are upgrade options, it's likely a re-enrollment block with upsell
          if (
            policyResponse?.reenrollmentPolicy?.upgradeOptions?.paid_upgrade
          ) {
            dialogType = "reenrollment_blocked";
          }
          // If explicitly checking for paid member block (this usually requires specific error code,
          // but we can fallback to checking if onEnrollment block message exists and looks relevant)
          // For now, we prioritize reenrollment/already_enrolled for 510 errors.

          setEnrollmentPolicyDialogType(dialogType);
          setEnrollmentPolicyDialogOpen(true);
        }
      }
    } catch (err) {
      console.error("[EnrollByInvite] Failed to fetch enrollment policy:", err);
      // Non-blocking - we don't prevent the enrollment flow if policy fetch fails
    }
  };

  const handleUpgrade = (url: string) => {
    // Save form data to LocalStorage for prefilling the next form
    const formData = form.getValues();
    const prefillData: Record<string, string> = {};

    console.log("[Prefill] Saving form data for upgrade:", formData);

    // First, save all form values with their original keys for exact matching
    Object.keys(formData).forEach((key) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const field = formData[key];
      const val = field?.value;

      if (val) {
        prefillData[key] = val;
      }
    });

    // Use getUserDetails for reliable extraction of Name, Email, and Phone
    // This ensures smart keys are set correctly regardless of field key variations
    const userDetails = getUserDetails();

    if (userDetails.email) {
      prefillData['__smart_email'] = userDetails.email;
      console.log("[Prefill] Smart Email:", userDetails.email);
    }
    if (userDetails.contact) {
      prefillData['__smart_phone'] = userDetails.contact;
      console.log("[Prefill] Smart Phone:", userDetails.contact);
    }
    if (userDetails.name) {
      prefillData['__smart_name'] = userDetails.name;
      console.log("[Prefill] Smart Name:", userDetails.name);
    }

    try {
      localStorage.setItem("enrollment_prefill_data", JSON.stringify(prefillData));
      console.log("[Prefill] Saved to LocalStorage:", prefillData);
    } catch (e) {
      console.error("Failed to save prefill data", e);
    }

    if (url) {
      window.open(url, "_blank");
    }
  };

  const handleSubmitEnrollment = async () => {
    // For FREE payments, skip payment processing and go directly to success
    if (paymentType === "FREE") {
      setLoading(true);
      try {
        // Use ref to get the latest referRequest value (avoids closure issues)
        const currentReferRequest = referRequestRef.current;
        console.log("[FREE Enrollment] Using referRequest:", currentReferRequest);
        
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
          allowLearnersToCreateCourses: getAllowLearnersToCreateCourses(),
          referRequest: currentReferRequest,
          paymentVendor: "STRIPE", // Default for FREE payments
          isUsingInstituteCustomFields: isUsingInstituteCustomFields,
          // userId: submittedUserId || undefined,
        });
        setPaymentCompletionResponse(paymentResponse);
        setCurrentStep(5); // Go directly to success for FREE payments

        // Fetch and handle enrollment policy (shows dialog if needed)
        await fetchAndHandleEnrollmentPolicy();
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const errorData = err?.response?.data;
        if (errorData?.responseCode?.includes("510")) {
          toast.error(errorData?.ex || "Enrollment failed");
          await fetchAndHandleEnrollmentPolicy("error_already_enrolled");
        }
        setError(errorData?.ex);
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
          allowLearnersToCreateCourses: getAllowLearnersToCreateCourses(),
          referRequest: referRequest,
          ewayPaymentData: ewayEncryptedData,
          paymentVendor: "EWAY",
          isUsingInstituteCustomFields: isUsingInstituteCustomFields,
          // userId: submittedUserId || undefined,
        });
        setOrderId(paymentResponse?.payment_response?.order_id);
        setPaymentCompletionResponse(paymentResponse);
        setTimeout(async () => {
          if (
            paymentResponse?.payment_response?.response_data?.paymentStatus ===
            "PAID"
          ) {
            setCurrentStep(5);
            // Fetch and handle enrollment policy (shows dialog if needed)
            await fetchAndHandleEnrollmentPolicy();
          } else setCurrentStep(4);
        }, 100);
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const errorData = err?.response?.data;
        if (errorData?.responseCode?.includes("510")) {
          toast.error(errorData?.ex || "Payment failed");
          await fetchAndHandleEnrollmentPolicy("error_already_enrolled");
        }
        setError(errorData?.ex);
        console.error(err);
      } finally {
        setLoading(false);
      }
      return;
    }

    // For CASHFREE payments - inline card flow (order created when entering step 3)
    if (vendor === "CASHFREE") {
      if (cashfreeSessionData || cashfreeInitLoading) {
        return; // Payment is via inline Pay Now; or still initializing
      }
      setLoading(true);
      setError(null);

      try {
        // Step 1: Create enrollment (user + user plan with payment pending)
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
          allowLearnersToCreateCourses: getAllowLearnersToCreateCourses(),
          referRequest: referRequest,
          paymentVendor: "CASHFREE",
          isUsingInstituteCustomFields: isUsingInstituteCustomFields,
        });

        // Extract userPlanId from response (backend creates enrollment and returns it)
        const userPlanId =
          paymentResponse?.payment_response?.user_plan_id ||
          paymentResponse?.user_plan_id ||
          paymentResponse?.learner_package_session_enroll?.user_plan_id;

        if (!userPlanId) {
          throw new Error(
            "Enrollment created but user plan ID not received. Please contact support."
          );
        }

        const userEmail = getUserDetails().email;
        if (!userEmail) {
          throw new Error("Email is required for payment.");
        }

        const token = await getTokenFromStorage(TokenKey.accessToken);
        if (!token) {
          throw new Error("Please log in to complete payment.");
        }

        const returnUrl = getCashfreeReturnUrl();
        const amount =
          enrollmentData.selectedPayment?.actual_price ??
          enrollmentData.selectedPayment?.amount ??
          0;
        const currency =
          enrollmentData.selectedPayment?.currency || "INR";

        // Step 2: Call user-plan-payment API to get paymentSessionId
        const cfResponse = await initiateCashfreePayment(
          instituteId,
          userPlanId,
          {
            amount,
            currency,
            email: userEmail,
            returnUrl,
            token,
          }
        );

        const paymentSessionId =
          cfResponse?.responseData?.paymentSessionId ??
          cfResponse?.responseData?.payment_session_id;

        if (!paymentSessionId) {
          throw new Error(
            "Failed to initialize payment. Please try again or contact support."
          );
        }

        setOrderId(cfResponse.orderId);
        setPaymentCompletionResponse(paymentResponse);

        // Step 3: Launch Cashfree checkout (redirects to return_url on success/failure)
        // For now always use sandbox (incl. production) for testing; set VITE_CASHFREE_SANDBOX=false when ready for prod keys
        const isSandbox = import.meta.env.VITE_CASHFREE_SANDBOX !== "false";
        const cashfree = await loadCashfree({ mode: isSandbox ? "sandbox" : "production" });

        if (!cashfree) {
          throw new Error("Failed to load Cashfree payment gateway.");
        }

        const checkoutResult = await cashfree.checkout({
          paymentSessionId,
          returnUrl: `${returnUrl}?orderId=${cfResponse.orderId}&instituteId=${instituteId}`,
        });

        if (checkoutResult?.error) {
          throw new Error(checkoutResult.error.message || "Payment initialization failed.");
        }
        // On success, checkout redirects to return_url - no further action needed
      } catch (err) {
        const errorData = (err as { response?: { data?: { ex?: string; responseCode?: string } } })?.response?.data;
        if (errorData?.responseCode?.includes("510")) {
          toast.error(errorData?.ex || "Payment failed");
          await fetchAndHandleEnrollmentPolicy("error_already_enrolled");
        }
        setError(
          (err as Error)?.message ||
            errorData?.ex ||
            "Failed to initiate Cashfree payment"
        );
        console.error("Cashfree enrollment error:", err);
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
          allowLearnersToCreateCourses: getAllowLearnersToCreateCourses(),
          referRequest: referRequest,
          razorpayPaymentData: razorpayPaymentData || undefined, // Will be undefined on first call
          paymentVendor: "RAZORPAY",
          isUsingInstituteCustomFields: isUsingInstituteCustomFields,
          // userId: submittedUserId || undefined,
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
        const errorData = err?.response?.data;
        if (errorData?.responseCode?.includes("510")) {
          toast.error(errorData?.ex || "Failed to initiate payment");
          await fetchAndHandleEnrollmentPolicy("error_already_enrolled");
        }
        setError(errorData?.ex || "Failed to initiate payment");
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
        allowLearnersToCreateCourses: getAllowLearnersToCreateCourses(),
        referRequest: referRequest,
        paymentVendor: "STRIPE",
        isUsingInstituteCustomFields: isUsingInstituteCustomFields,
        // userId: submittedUserId || undefined,
      });
      setOrderId(paymentResponse?.payment_response?.order_id);
      setPaymentCompletionResponse(paymentResponse);
      setTimeout(async () => {
        if (
          paymentResponse?.payment_response?.response_data?.paymentStatus ===
          "PAID"
        ) {
          setCurrentStep(5);
          // Fetch and handle enrollment policy (shows dialog if needed)
          await fetchAndHandleEnrollmentPolicy();
        } else setCurrentStep(4);
      }, 100);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      const errorData = err?.response?.data;
      if (errorData?.responseCode?.includes("510")) {
        toast.error(errorData?.ex || "Payment failed");
        await fetchAndHandleEnrollmentPolicy("error_already_enrolled");
      }
      setError(errorData?.ex);
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
            allowLearnersToCreateCourses: getAllowLearnersToCreateCourses(),
            referRequest: referRequest,
            razorpayPaymentData: razorpayPaymentData, // Now includes payment details
            paymentVendor: "RAZORPAY",
            isUsingInstituteCustomFields: isUsingInstituteCustomFields,
            // userId: submittedUserId || undefined,
          });

          setPaymentCompletionResponse(paymentResponse);

          // Check payment status and navigate accordingly
          setTimeout(async () => {
            if (
              paymentResponse?.payment_response?.response_data
                ?.paymentStatus === "PAID"
            ) {
              setCurrentStep(5);
              // Fetch and handle enrollment policy (shows dialog if needed)
              await fetchAndHandleEnrollmentPolicy();
            } else {
              setCurrentStep(4);
            }
          }, 100);
        } catch (err) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          const errorData = err?.response?.data;
          if (errorData?.responseCode?.includes("510")) {
            toast.error(errorData?.ex || "Failed to complete enrollment");
            await fetchAndHandleEnrollmentPolicy("error_already_enrolled");
          }
          setError(errorData?.ex || "Failed to complete enrollment");
          console.error("Razorpay completion error:", err);
        } finally {
          setLoading(false);
        }
      };

      completeRazorpayEnrollment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [razorpayPaymentData]);

  // Initialize Cashfree payment (create enrollment + get paymentSessionId) when entering step 3
  useEffect(() => {
    const vendor = propVendor || getPaymentVendor(inviteData);
    if (
      vendor !== "CASHFREE" ||
      currentStep !== 3 ||
      cashfreeSessionData ||
      cashfreeInitLoading ||
      cashfreeInitAttemptedRef.current
    ) {
      return;
    }

    cashfreeInitAttemptedRef.current = true;
    setCashfreeInitLoading(true);
    setError(null);

    const init = async () => {
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
          allowLearnersToCreateCourses: getAllowLearnersToCreateCourses(),
          referRequest: referRequestRef.current,
          paymentVendor: "CASHFREE",
          isUsingInstituteCustomFields: isUsingInstituteCustomFields,
        });

        const userPlanId =
          paymentResponse?.user_plan_id ||
          paymentResponse?.payment_response?.user_plan_id ||
          paymentResponse?.learner_package_session_enroll?.user_plan_id;

        const responseData = paymentResponse?.payment_response?.response_data;
        let paymentSessionId =
          responseData?.paymentSessionId ?? responseData?.payment_session_id;
        // Use top-level orderId (paymentLogId) for status API – backend looks up by payment_log.id
        let cfOrderId =
          paymentResponse?.orderId ??
          paymentResponse?.payment_response?.order_id ??
          responseData?.orderId ??
          responseData?.order_id;

        if (!paymentSessionId) {
          if (!userPlanId) throw new Error("User plan ID not received.");
          const token = await getTokenFromStorage(TokenKey.accessToken);
          if (!token) {
            throw new Error(
              "Payment session not in response. Please log in to complete payment."
            );
          }
          const userEmail = getUserDetails().email;
          if (!userEmail) throw new Error("Email is required.");

          const amount =
            enrollmentData.selectedPayment?.actual_price ??
            enrollmentData.selectedPayment?.amount ??
            0;
          const cfResponse = await initiateCashfreePayment(
            instituteId,
            userPlanId,
            {
              amount,
              currency: enrollmentData.selectedPayment?.currency || "INR",
              email: userEmail,
              returnUrl: getCashfreeReturnUrl(),
              token,
            }
          );

          paymentSessionId =
            cfResponse?.responseData?.paymentSessionId ??
            cfResponse?.responseData?.payment_session_id;
          cfOrderId = cfResponse?.orderId ?? cfOrderId;
        }

        if (!paymentSessionId) throw new Error("Failed to initialize payment.");

        const ordId =
          cfOrderId ??
          paymentResponse?.orderId ??
          paymentResponse?.payment_response?.order_id ??
          "";
        setCashfreeSessionData({
          paymentSessionId,
          orderId: ordId,
        });
        setOrderId(ordId);
        setPaymentCompletionResponse(paymentResponse);
        // Store username and password from enrollment response for post-payment login
        // Prefer user.username (required by login API), fallback to user.email or form data
        const username =
          paymentResponse?.user?.username ??
          paymentResponse?.user?.email ??
          getUserDetails().email;
        const userPassword =
          paymentResponse?.user?.password ??
          getPasswordField(form.getValues());
        if (ordId && username && userPassword) {
          try {
            sessionStorage.setItem(
              `enroll_payment_creds_${ordId}`,
              JSON.stringify({ username, password: userPassword })
            );
          } catch {
            /* ignore */
          }
        }
      } catch (err) {
        const errData = (err as { response?: { data?: { ex?: string; responseCode?: string } } })?.response?.data;
        if (errData?.responseCode?.includes("510")) {
          toast.error(errData?.ex || "Payment failed");
          fetchAndHandleEnrollmentPolicy("error_already_enrolled");
        }
        setError(
          (err as Error)?.message || errData?.ex || "Failed to initialize payment"
        );
      } finally {
        setCashfreeInitLoading(false);
      }
    };

    init();
  }, [
    currentStep,
    inviteData,
    enrollmentData,
    instituteId,
    cashfreeSessionData,
    cashfreeInitLoading,
  ]);

  useEffect(() => {
    if (currentStep !== 3) {
      cashfreeInitAttemptedRef.current = false;
    }
  }, [currentStep]);

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

  // State to track if there is unapplied referral code text
  const [hasUnappliedReferral, setHasUnappliedReferral] = useState(false);

  // Wrapper function to update both state and ref for referRequest
  const updateReferRequest = (newReferRequest: ReferRequest | null) => {
    console.log("[enroll-form] updateReferRequest called with:", newReferRequest);
    referRequestRef.current = newReferRequest; // Update ref immediately
    setReferRequest(newReferRequest); // Also update state
  };

  // Handler for when referral is successfully applied - auto-enroll for FREE courses
  const handleReferralApplied = () => {
    // For FREE courses, auto-submit enrollment after referral is applied
    if (paymentType === "FREE" && currentStep === 2 && !hasAutoEnrolledRef.current) {
      hasAutoEnrolledRef.current = true;
      // Small delay to ensure UI has updated
      setTimeout(() => {
        console.log("[handleReferralApplied] Triggering auto-enrollment, referRequestRef.current:", referRequestRef.current);
        handleSubmitEnrollment();
      }, 500);
    }
  };

  // Auto-enroll for FREE courses when there's no referral option
  // (when ref code is in URL and referral is applied, handleReferralApplied handles it)
  useEffect(() => {
    if (
      paymentType === "FREE" &&
      currentStep === 2 &&
      enrollmentData.selectedPayment &&
      !loading &&
      !hasAutoEnrolledRef.current
    ) {
      // Check if there's a referral option available
      const hasReferralOption =
        enrollmentData.selectedPayment?.referral_option &&
        enrollmentData.selectedPayment?.referral_option !== null;

      // If no referral option exists, auto-proceed immediately for FREE courses
      if (!hasReferralOption) {
        hasAutoEnrolledRef.current = true;
        setTimeout(() => {
          handleSubmitEnrollment();
        }, 300);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentType, currentStep, enrollmentData.selectedPayment, loading]);

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
              setReferRequest={updateReferRequest}
              refCode={ref || ""}
              onUnappliedCodeChange={setHasUnappliedReferral}
              onReferralApplied={handleReferralApplied}
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
            setReferRequest={updateReferRequest}
            refCode={ref || ""}
            onUnappliedCodeChange={setHasUnappliedReferral}
            onReferralApplied={handleReferralApplied}
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
            cashfreePaymentSessionId={cashfreeSessionData?.paymentSessionId}
            cashfreeReturnUrl={getCashfreeReturnUrl()}
            cashfreeOrderId={cashfreeSessionData?.orderId}
            cashfreeInitLoading={cashfreeInitLoading}
            cashfreeInstituteId={instituteId}
            onCashfreePayClick={() => setLoading(true)}
            onCashfreePayError={() => setLoading(false)}
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
            isAutoLoggingIn={isAutoLoggingIn}
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

  if (isLoading || isInstituteLoading || (loading && paymentType === "FREE"))
    return <DashboardLoader />;

  // Helper to extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  return (
    <div className="min-h-screen w-full bg-gray-50">
      {/* Compact Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Left: Institute Branding */}
            {courseData.includeInstituteLogo ? (
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
                size="small"
                showName={true}
                className="!flex-row !items-center !gap-2"
              />
            ) : (
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary" />
                <span className="font-medium text-sm text-gray-900 truncate max-w-[200px]">
                  {inviteData?.name || courseData.course || "Course Enrollment"}
                </span>
              </div>
            )}

            {/* Step count badge - minimal, right-aligned */}
            <div className="text-xs text-gray-400 sm:hidden">
              {paymentType !== "FREE"
                ? `Step ${Math.min(currentStep + 1, 3)} of 3`
                : `Step ${currentStep === 0 ? 1 : 2} of 2`}
            </div>
          </div>
        </div>
      </header>

      {/* Compact Course Info Bar */}
      {currentStep === 0 && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Course Thumbnail */}
              {courseData.courseBanner && (
                <div className="w-full sm:w-32 h-20 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                  <img
                    src={courseData.courseBanner}
                    alt={courseData.course}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Course Title & Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                  {inviteData?.name || courseData.course}
                </h1>
                {courseData.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                    {courseData.description.replace(/<[^>]*>/g, '')}
                  </p>
                )}
                {courseData.tags && courseData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {courseData.tags.map((tag, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Price Badge - Show only if not FREE */}
              {paymentType !== "FREE" && enrollmentData.selectedPayment && (
                <div className="flex-shrink-0 text-right">
                  <div className="text-lg font-semibold text-gray-900">
                    {enrollmentData.selectedPayment.currency?.toUpperCase()}{" "}
                    {enrollmentData.selectedPayment.amount ?? enrollmentData.selectedPayment.actual_price}
                  </div>
                  {enrollmentData.selectedPayment.duration && (
                    <div className="text-xs text-gray-500">
                      {enrollmentData.selectedPayment.duration}
                    </div>
                  )}
                </div>
              )}
              {paymentType === "FREE" && (
                <div className="flex-shrink-0">
                  <span className="px-3 py-1 bg-green-50 text-green-700 text-sm font-medium rounded-full">
                    Free
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Progress Steps - Centered above content */}
        {currentStep < 5 && (
          <div className="mb-6">
            {paymentType !== "FREE" ? (
              <div className="flex items-center justify-center gap-0">
                {/* Step 1: Details */}
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold ${
                    currentStep >= 0 ? "bg-primary text-white" : "bg-gray-200 text-gray-500"
                  }`}>
                    {currentStep > 0 ? "✓" : "1"}
                  </div>
                  <span className={`text-xs sm:text-sm font-medium ${
                    currentStep === 0 ? "text-primary" : currentStep > 0 ? "text-gray-700" : "text-gray-400"
                  }`}>
                    Details
                  </span>
                </div>
                {/* Connector */}
                <div className={`w-8 sm:w-16 h-0.5 mx-1 sm:mx-2 ${currentStep > 0 ? "bg-primary" : "bg-gray-200"}`} />
                {/* Step 2: Plan */}
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold ${
                    currentStep >= 1 ? "bg-primary text-white" : "bg-gray-200 text-gray-500"
                  }`}>
                    {currentStep > 1 ? "✓" : "2"}
                  </div>
                  <span className={`text-xs sm:text-sm font-medium ${
                    currentStep === 1 ? "text-primary" : currentStep > 1 ? "text-gray-700" : "text-gray-400"
                  }`}>
                    Plan
                  </span>
                </div>
                {/* Connector */}
                <div className={`w-8 sm:w-16 h-0.5 mx-1 sm:mx-2 ${currentStep > 1 ? "bg-primary" : "bg-gray-200"}`} />
                {/* Step 3: Pay */}
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold ${
                    currentStep >= 2 ? "bg-primary text-white" : "bg-gray-200 text-gray-500"
                  }`}>
                    {currentStep > 4 ? "✓" : "3"}
                  </div>
                  <span className={`text-xs sm:text-sm font-medium ${
                    currentStep >= 2 && currentStep < 5 ? "text-primary" : currentStep >= 5 ? "text-gray-700" : "text-gray-400"
                  }`}>
                    Pay
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-0">
                {/* Step 1: Details */}
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold ${
                    currentStep >= 0 ? "bg-primary text-white" : "bg-gray-200 text-gray-500"
                  }`}>
                    {currentStep > 0 ? "✓" : "1"}
                  </div>
                  <span className={`text-xs sm:text-sm font-medium ${
                    currentStep === 0 ? "text-primary" : currentStep > 0 ? "text-gray-700" : "text-gray-400"
                  }`}>
                    Details
                  </span>
                </div>
                {/* Connector */}
                <div className={`w-8 sm:w-16 h-0.5 mx-1 sm:mx-2 ${currentStep >= 2 ? "bg-primary" : "bg-gray-200"}`} />
                {/* Step 2: Confirm */}
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold ${
                    currentStep >= 2 ? "bg-primary text-white" : "bg-gray-200 text-gray-500"
                  }`}>
                    {currentStep > 2 ? "✓" : "2"}
                  </div>
                  <span className={`text-xs sm:text-sm font-medium ${
                    currentStep >= 2 ? "text-primary" : "text-gray-400"
                  }`}>
                    Confirm
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className={`grid grid-cols-1 ${hasRightSectionContent && currentStep === 0 ? "lg:grid-cols-3" : ""} gap-6`}>
          {/* Main Form Area */}
          <div className={`${hasRightSectionContent && currentStep === 0 ? "lg:col-span-2" : "w-full max-w-2xl mx-auto"} space-y-4`}>
            {/* Step Content */}
            {renderCurrentStep()}

            {/* Course Structure Preview - Bundled Courses */}
            {currentStep === 0 && isBundledInvite && bundledPackageSessions.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-base font-medium text-gray-900 mb-3">
                  What's Included
                </h3>

                {bundledPackageSessions.length > 1 ? (
                  <Tabs
                    value={activePackageSessionId ?? bundledPackageSessions[0]?.packageSessionId}
                    onValueChange={setActivePackageSessionId}
                  >
                    <TabsList className="flex flex-wrap w-full gap-1.5 bg-gray-50 p-1 rounded-md mb-3 h-auto">
                      {bundledPackageSessions.map((session, index) => (
                        <TabsTrigger
                          key={session.packageSessionId}
                          value={session.packageSessionId}
                          className="flex-1 min-w-[120px] px-3 py-1.5 text-xs font-medium rounded text-gray-600 bg-transparent data-[state=active]:bg-white data-[state=active]:text-gray-900"
                        >
                          {resolvePackageSessionLabel(session.packageSessionId, index)}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {bundledPackageSessions.map((session) => (
                      <TabsContent
                        key={session.packageSessionId}
                        value={session.packageSessionId}
                        className="focus-visible:outline-none focus-visible:ring-0 mt-0"
                      >
                        {activePackageSessionId === session.packageSessionId ? (
                          (() => {
                            const sessionDetails = getDetailsFromPackageSessionId({
                              packageSessionId: session.packageSessionId,
                            });
                            const previewCourseId = sessionDetails?.package_dto?.id ?? "";
                            const previewLevelId = sessionDetails?.level?.id ?? undefined;

                            if (!previewCourseId) {
                              return (
                                <p className="text-sm text-gray-500 py-4 text-center">
                                  Course details loading...
                                </p>
                              );
                            }

                            return (
                              <CatalogCourseStructureDetails
                                key={session.packageSessionId}
                                courseDepth={5}
                                courseId={previewCourseId}
                                instituteId={instituteId ?? ""}
                                packageSessionId={session.packageSessionId}
                                levelId={previewLevelId}
                              />
                            );
                          })()
                        ) : null}
                      </TabsContent>
                    ))}
                  </Tabs>
                ) : (
                  (() => {
                    const singleSessionId = bundledPackageSessions[0]?.packageSessionId ?? "";
                    if (!singleSessionId) return null;

                    const sessionDetails = getDetailsFromPackageSessionId({
                      packageSessionId: singleSessionId,
                    });
                    const previewCourseId = sessionDetails?.package_dto?.id ?? "";
                    const previewLevelId = sessionDetails?.level?.id ?? undefined;

                    if (!previewCourseId) return null;

                    return (
                      <CatalogCourseStructureDetails
                        courseDepth={5}
                        courseId={previewCourseId}
                        instituteId={instituteId ?? ""}
                        packageSessionId={singleSessionId}
                        levelId={previewLevelId}
                      />
                    );
                  })()
                )}
              </div>
            )}

            {/* YouTube Video - Compact */}
            {currentStep === 0 && courseData.courseMedia && courseData.courseMediaId?.type === "youtube" && (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                  <iframe
                    className="absolute top-0 left-0 w-full h-full"
                    src={`https://www.youtube.com/embed/${getYouTubeVideoId(courseData.courseMediaId.id)}`}
                    title={courseData.course}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            {currentStep > 0 && currentStep < 4 && !(currentStep === 1 && paymentType === "FREE") && (
              <NavigationButtons
                currentStep={currentStep}
                selectedPayment={enrollmentData.selectedPayment}
                onPrevious={handlePrevious}
                onNext={handleNext}
                onSubmitEnrollment={handleSubmitEnrollment}
                loading={loading}
                paymentType={paymentType}
                donationAmountValid={donationAmountValid}
                paymentVendor={currentStep === 3 ? getPaymentVendor(inviteData) : undefined}
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
                hasUnappliedReferral={hasUnappliedReferral}
                hidePrimaryButton={
                  currentStep === 3 &&
                  getPaymentVendor(inviteData) === "CASHFREE" &&
                  !!cashfreeSessionData
                }
              />
            )}
          </div>

          {/* Sidebar - Course Details */}
          {hasRightSectionContent && currentStep === 0 && (
            <div className="lg:col-span-1">
              <div className="bg-white border border-gray-200 rounded-lg p-4 lg:sticky lg:top-20">
                <CourseInfoCard
                  courseData={{
                    ...courseData,
                    instituteLogo: "",
                    course: inviteData?.name || courseData.course,
                  }}
                  levelName={currentLevelName}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Links */}
        <div className="flex items-center justify-center gap-3 text-xs text-gray-400 mt-8 pt-6 border-t border-gray-100">
          <a
            href={privacyPolicyUrl || "/privacy-policy"}
            target={privacyPolicyUrl ? "_blank" : undefined}
            rel={privacyPolicyUrl ? "noopener noreferrer" : undefined}
            className="hover:text-gray-600"
          >
            Privacy Policy
          </a>
          <span>•</span>
          <a
            href={termsAndConditionUrl || "/terms-and-conditions"}
            target={termsAndConditionUrl ? "_blank" : undefined}
            rel={termsAndConditionUrl ? "noopener noreferrer" : undefined}
            className="hover:text-gray-600"
          >
            Terms & Conditions
          </a>
        </div>
      </main>

      {/* Enrollment Policy Dialog */}
      <EnrollmentPolicyDialog
        open={enrollmentPolicyDialogOpen}
        onOpenChange={setEnrollmentPolicyDialogOpen}
        dialogType={enrollmentPolicyDialogType}
        policyResponse={enrollmentPolicyResponse}
        courseName={courseData.course || inviteData?.name || "this course"}
        onContinue={() => {
          // Navigate to dashboard after dialog is closed
          window.location.href = `${BASE_URL_LEARNER_DASHBOARD}/study-library/courses`;
        }}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
};

export default EnrollByInvite;
