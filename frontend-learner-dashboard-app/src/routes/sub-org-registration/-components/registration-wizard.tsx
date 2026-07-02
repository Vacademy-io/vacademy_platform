import { Suspense, useEffect, useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Preferences } from "@capacitor/preferences";
import { Check } from "@phosphor-icons/react";
import { applyTabBranding } from "@/utils/branding";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { useInstituteDetailsStore } from "@/stores/study-library/useInstituteDetails";
import { handleGetPublicInstituteDetails } from "@/components/common/enroll-by-invite/-services/enroll-invite-services";
import { InstituteBrandingComponent } from "@/components/common/institute-branding";
import { PaymentGatewayWrapper } from "@/components/common/enroll-by-invite/-components/payment-gateway-wrapper";
import type { PaymentVendor } from "@/components/common/enroll-by-invite/-utils/payment-vendor-helper";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { cn } from "@/lib/utils";
import type {
  SubOrgRegistrationTemplate,
  CustomFieldValuePayload,
} from "../-services/sub-org-registration-services";
import {
  startSubOrgRegistration,
  verifySubOrgRegistrationOtp,
  resendSubOrgRegistrationOtp,
  completeSubOrgRegistration,
  getSubOrgApiErrorMessage,
} from "../-services/sub-org-registration-services";
import DetailsStep, { DetailsStepValues } from "./details-step";
import OtpStep from "./otp-step";
import CustomFieldsStep from "./custom-fields-step";
import TncStep from "./tnc-step";
import PaymentStep from "./payment-step";
import SuccessStep from "./success-step";

type WizardPhase =
  | "DETAILS"
  | "OTP"
  | "CUSTOM_FIELDS"
  | "TNC"
  | "PAYMENT"
  | "SUCCESS";

interface RegistrationWizardProps {
  template: SubOrgRegistrationTemplate;
  instituteId: string;
  code: string;
}

/**
 * Public sub-org self-registration wizard, driven by the template's `steps`:
 * DETAILS → OTP verify → CUSTOM_FIELDS (if present) → TNC (if present) →
 * PAYMENT (paid templates; always last) → SUCCESS. registration_id lives in
 * component state.
 *
 * FREE templates call POST /complete from the last non-payment step. Paid
 * templates call /complete exactly once — from the PAYMENT step, with
 * plan_id + payment_initiation_request; earlier steps only collect state.
 */
const RegistrationWizard = ({
  template,
  instituteId,
  code,
}: RegistrationWizardProps) => {
  const domainRouting = useDomainRouting();
  const { setInstituteDetails } = useInstituteDetailsStore();

  const { data: instituteData } = useSuspenseQuery(
    handleGetPublicInstituteDetails({ instituteId })
  );

  // ─── Template-driven step configuration ────────────────────────────────────
  const templateSteps = useMemo(
    () => (template.steps ?? []).map((s) => String(s).toUpperCase()),
    [template.steps]
  );
  const hasCustomFieldsStep =
    templateSteps.includes("CUSTOM_FIELDS") &&
    (template.custom_fields?.length ?? 0) > 0;
  const hasTncStep = templateSteps.includes("TNC");
  // Payment requires the payment section with at least one plan to pay with.
  const hasPaymentStep =
    templateSteps.includes("PAYMENT") &&
    !!template.payment &&
    (template.payment.payment_plans?.length ?? 0) > 0;

  /** Ordered post-OTP steps, honoring the template's ordering. */
  const postOtpSteps = useMemo(
    () =>
      templateSteps.filter(
        (step): step is "CUSTOM_FIELDS" | "TNC" | "PAYMENT" =>
          (step === "CUSTOM_FIELDS" && hasCustomFieldsStep) ||
          (step === "TNC" && hasTncStep) ||
          (step === "PAYMENT" && hasPaymentStep)
      ),
    [templateSteps, hasCustomFieldsStep, hasTncStep, hasPaymentStep]
  );

  // ─── Wizard state ──────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<WizardPhase>("DETAILS");
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [detailsValues, setDetailsValues] = useState<DetailsStepValues | null>(
    null
  );
  const [customFieldValues, setCustomFieldValues] = useState<
    CustomFieldValuePayload[]
  >([]);
  const [completedEmail, setCompletedEmail] = useState<string | null>(null);

  const [isStarting, setIsStarting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // ─── Branding (same sync as audience-response) ─────────────────────────────
  useEffect(() => {
    if (instituteData) {
      setInstituteDetails(instituteData);
    }
  }, [instituteData, setInstituteDetails]);

  useEffect(() => {
    const syncBranding = async () => {
      try {
        if (!instituteId || !instituteData) return;

        await Preferences.set({ key: "InstituteId", value: instituteId });

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

        await applyTabBranding(document.title);
      } catch (e) {
        console.warn("[Sub-Org Registration] Branding sync failed", e);
      }
    };

    void syncBranding();
  }, [instituteId, instituteData]);

  // ─── Flow handlers ─────────────────────────────────────────────────────────

  const runComplete = async (
    values: CustomFieldValuePayload[],
    tncAccepted: boolean
  ) => {
    if (!registrationId) {
      toast.error("Registration session missing. Please start again");
      setPhase("DETAILS");
      return;
    }
    setIsCompleting(true);
    try {
      const response = await completeSubOrgRegistration({
        registration_id: registrationId,
        tnc_accepted: tncAccepted,
        custom_field_values: values,
      });
      setCompletedEmail(
        response?.admin_email || detailsValues?.adminEmail || ""
      );
      setPhase("SUCCESS");
    } catch (error) {
      toast.error(
        getSubOrgApiErrorMessage(
          error,
          "Failed to complete registration. Please try again"
        )
      );
    } finally {
      setIsCompleting(false);
    }
  };

  /**
   * Advances past a completed step; runs /complete when nothing remains.
   * Paid templates never hit runComplete here: PAYMENT is always their last
   * step, so this only ever advances INTO it — the payment step then issues
   * the single /complete with the payment initiation payload.
   */
  const advanceAfter = async (
    completedStep: "OTP" | "CUSTOM_FIELDS" | "TNC",
    values: CustomFieldValuePayload[]
  ) => {
    const startIndex =
      completedStep === "OTP"
        ? 0
        : postOtpSteps.indexOf(completedStep) + 1;
    const nextStep = postOtpSteps[startIndex];
    if (nextStep) {
      setPhase(nextStep);
    } else {
      // No further wizard steps — the just-finished action is the final one.
      // TNC (when present) is always acceptance-gated before reaching here.
      await runComplete(values, hasTncStep);
    }
  };

  const handleDetailsSubmit = async (values: DetailsStepValues) => {
    setIsStarting(true);
    try {
      const response = await startSubOrgRegistration({
        institute_id: instituteId,
        code,
        org_name: values.orgName.trim(),
        org_logo_file_id: values.orgLogoFileId,
        admin_name: values.adminName.trim(),
        admin_email: values.adminEmail.trim(),
        admin_phone: values.adminPhone?.trim() || null,
      });
      setRegistrationId(response.registration_id);
      setDetailsValues(values);
      setPhase("OTP");
      toast.success("Verification code sent to your email");
    } catch (error) {
      // Duplicate email (and other 4xx) messages come from the backend
      toast.error(
        getSubOrgApiErrorMessage(
          error,
          "Failed to start registration. Please try again"
        )
      );
    } finally {
      setIsStarting(false);
    }
  };

  const handleVerifyOtp = async (otp: string) => {
    if (!registrationId) {
      toast.error("Registration session missing. Please start again");
      setPhase("DETAILS");
      return;
    }
    setIsVerifying(true);
    try {
      await verifySubOrgRegistrationOtp({ registrationId, otp });
      toast.success("Email verified successfully!");
      await advanceAfter("OTP", customFieldValues);
    } catch (error) {
      toast.error(getSubOrgApiErrorMessage(error, "Invalid or expired OTP"));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (!registrationId) return;
    setIsResending(true);
    try {
      await resendSubOrgRegistrationOtp({ registrationId });
      toast.success("Verification code resent");
    } catch (error) {
      toast.error(
        getSubOrgApiErrorMessage(error, "Failed to resend. Please try again")
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleCustomFieldsContinue = async (
    values: CustomFieldValuePayload[]
  ) => {
    setCustomFieldValues(values);
    await advanceAfter("CUSTOM_FIELDS", values);
  };

  const handleTncContinue = async () => {
    await advanceAfter("TNC", customFieldValues);
  };

  // ─── Progress indicator ────────────────────────────────────────────────────
  const progressSteps = useMemo(() => {
    const labels: { key: WizardPhase; label: string }[] = [
      { key: "DETAILS", label: "Details" },
      { key: "OTP", label: "Verify Email" },
    ];
    postOtpSteps.forEach((step) => {
      labels.push(
        step === "CUSTOM_FIELDS"
          ? { key: "CUSTOM_FIELDS", label: "Additional Info" }
          : step === "TNC"
            ? { key: "TNC", label: "Terms" }
            : { key: "PAYMENT", label: "Payment" }
      );
    });
    return labels;
  }, [postOtpSteps]);

  const currentStepIndex = progressSteps.findIndex((s) => s.key === phase);

  // Previously collected custom field values keyed by id (for back/forward)
  const customFieldValueMap = useMemo(
    () =>
      customFieldValues.reduce<Record<string, string>>((map, entry) => {
        map[entry.custom_field_id] = entry.value;
        return map;
      }, {}),
    [customFieldValues]
  );

  const isFinalPostOtpStep = (step: "CUSTOM_FIELDS" | "TNC" | "PAYMENT") =>
    postOtpSteps[postOtpSteps.length - 1] === step;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-neutral-50 to-primary-50">
      {/* Navbar Header */}
      <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-6">
          <div className="flex h-18 items-center justify-start p-3 py-3 sm:h-16 sm:py-4">
            <InstituteBrandingComponent
              branding={{
                instituteId: instituteId || null,
                instituteName:
                  instituteData?.institute_name ?? instituteData?.name ?? null,
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

      {/* Main Content */}
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Header + progress */}
          {phase !== "SUCCESS" && (
            <div className="space-y-5">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-neutral-700 sm:text-3xl">
                  {template.template_name || "Organization Registration"}
                </h1>
                <p className="mt-1 text-sm text-neutral-500">
                  Register your organization with{" "}
                  {instituteData?.institute_name ?? "the institute"}
                </p>
              </div>

              {/* Step progress */}
              <ol className="flex items-center justify-center gap-2 sm:gap-3">
                {progressSteps.map((step, index) => {
                  const isDone = currentStepIndex > index;
                  const isActive = currentStepIndex === index;
                  return (
                    <li key={step.key} className="flex items-center gap-2 sm:gap-3">
                      {index > 0 && (
                        <span
                          className={cn(
                            "h-px w-4 sm:w-8",
                            isDone || isActive
                              ? "bg-primary-400"
                              : "bg-neutral-300"
                          )}
                        />
                      )}
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "flex size-6 items-center justify-center rounded-full text-caption font-semibold",
                            isDone && "bg-success-500 text-white",
                            isActive && "bg-primary-500 text-white",
                            !isDone &&
                              !isActive &&
                              "border border-neutral-300 bg-white text-neutral-400"
                          )}
                        >
                          {isDone ? <Check className="size-3.5" /> : index + 1}
                        </span>
                        <span
                          className={cn(
                            "hidden text-caption sm:inline",
                            isActive
                              ? "font-semibold text-neutral-700"
                              : "text-neutral-500"
                          )}
                        >
                          {step.label}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Step content */}
          {phase === "DETAILS" && (
            <DetailsStep
              initialValues={detailsValues}
              onSubmit={handleDetailsSubmit}
              isSubmitting={isStarting}
            />
          )}

          {phase === "OTP" && detailsValues && (
            <OtpStep
              email={detailsValues.adminEmail}
              onVerify={handleVerifyOtp}
              onResend={handleResendOtp}
              onEditDetails={() => setPhase("DETAILS")}
              isVerifying={isVerifying || isCompleting}
              isResending={isResending}
            />
          )}

          {phase === "CUSTOM_FIELDS" && (
            <CustomFieldsStep
              customFields={template.custom_fields ?? []}
              initialValues={customFieldValueMap}
              isFinalStep={isFinalPostOtpStep("CUSTOM_FIELDS")}
              isSubmitting={isCompleting}
              onContinue={handleCustomFieldsContinue}
            />
          )}

          {phase === "TNC" && (
            <TncStep
              tncFileId={template.tnc_file_id}
              isSubmitting={isCompleting}
              onContinue={handleTncContinue}
              continueLabel={
                isFinalPostOtpStep("TNC") ? undefined : "Continue"
              }
            />
          )}

          {phase === "PAYMENT" && template.payment && detailsValues && (
            <Suspense fallback={<DashboardLoader />}>
              <PaymentGatewayWrapper
                vendor={
                  (template.payment.vendor || "").toUpperCase() as PaymentVendor
                }
                instituteId={instituteId}
              >
                <PaymentStep
                  payment={template.payment}
                  templateName={
                    template.template_name || "Organization Registration"
                  }
                  instituteId={instituteId}
                  registrationId={registrationId}
                  tncAccepted={hasTncStep}
                  customFieldValues={customFieldValues}
                  adminName={detailsValues.adminName}
                  adminEmail={detailsValues.adminEmail}
                  adminPhone={detailsValues.adminPhone ?? ""}
                  onRegistered={(email) => {
                    setCompletedEmail(email || detailsValues.adminEmail || "");
                    setPhase("SUCCESS");
                  }}
                  onSessionMissing={() => setPhase("DETAILS")}
                />
              </PaymentGatewayWrapper>
            </Suspense>
          )}

          {phase === "SUCCESS" && (
            <SuccessStep
              orgName={detailsValues?.orgName ?? ""}
              adminEmail={completedEmail ?? detailsValues?.adminEmail ?? ""}
              paid={hasPaymentStep}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default RegistrationWizard;
