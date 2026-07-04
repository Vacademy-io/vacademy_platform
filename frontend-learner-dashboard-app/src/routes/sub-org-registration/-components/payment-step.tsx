import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  CreditCard,
  HourglassHigh,
  SpinnerGap,
  WarningCircle,
} from "@phosphor-icons/react";
import { ModernCard } from "@/components/design-system/modern-card";
import { MyButton } from "@/components/design-system/button";
import PaymentSelectionStep from "@/components/common/enroll-by-invite/-components/payment-selection-step";
import PaymentInfoStep from "@/components/common/enroll-by-invite/-components/payment-info-step";
import PaymentPendingStep, {
  UserPaymentResponse,
} from "@/components/common/enroll-by-invite/-components/payment-pending-step";
import type { RazorpayCheckoutFormRef } from "@/components/common/enroll-by-invite/-components/razorpay-checkout-form";
import {
  getSelectedPaymentPrice,
  type SelectedPayment,
} from "@/components/common/enroll-by-invite/-components/types";
import type { PaymentPlan } from "@/components/common/enroll-by-invite/-utils/helper";
import type { PaymentVendor } from "@/components/common/enroll-by-invite/-utils/payment-vendor-helper";
import {
  getCashfreeReturnUrl,
  initiateCashfreePayment,
} from "@/services/cashfree-payment";
import { getPhonePeReturnUrl } from "@/services/phonepe-payment";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { getCurrencySymbol } from "@/utils/currency";
import {
  buildPaymentInitiationRequest,
  type EwayEncryptedCardData,
  type PaymentInitiationRequest,
} from "../-services/build-payment-initiation-request";
import {
  completeSubOrgRegistration,
  getSubOrgApiErrorMessage,
  type CompleteRegistrationResponse,
  type CustomFieldValuePayload,
  type TemplatePaymentInfo,
  type TemplatePaymentPlan,
} from "../-services/sub-org-registration-services";

type PaymentPhase =
  | "SELECT_PLAN"
  | "GATEWAY"
  | "PENDING"
  | "ALREADY_IN_PROGRESS";

type StripeProcessor = () => Promise<{
  success: boolean;
  paymentMethodId?: string;
  error?: string;
}>;

/** Maps a template plan onto the PaymentPlan shape the enroll plan sections render. */
const toPaymentPlan = (
  plan: TemplatePaymentPlan,
  fallbackCurrency: string
): PaymentPlan => ({
  id: plan.id,
  name: plan.name,
  status: "ACTIVE",
  validity_in_days: plan.validity_in_days ?? 0,
  actual_price: plan.actual_price,
  elevated_price: plan.elevated_price ?? plan.actual_price,
  currency: plan.currency || fallbackCurrency,
  description: plan.description ?? "",
  tag: "",
  feature_json: "[]",
  referral_option: { id: "", referee_discount_json: "" },
  referral_option_smapping_status: null,
});

/** Matches the backend's 4xx rejection when /complete is re-called mid-payment. */
const isPaymentInProgressMessage = (message: string) =>
  /already in progress/i.test(message);

interface PaymentStepProps {
  payment: TemplatePaymentInfo;
  templateName: string;
  instituteId: string;
  registrationId: string | null;
  /** TNC step (when present) is acceptance-gated before payment is reached. */
  tncAccepted: boolean;
  customFieldValues: CustomFieldValuePayload[];
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  /** Payment confirmed (or immediately PAID) → wizard shows the success step. */
  onRegistered: (email: string | null) => void;
  /** Registration session lost → wizard restarts at DETAILS. */
  onSessionMissing: () => void;
}

/**
 * Final step for paid templates: plan selection → gateway checkout. This step
 * owns the single POST /complete call (with plan_id + payment_initiation_request);
 * earlier wizard steps only collect state. For STRIPE/EWAY the gateway result
 * comes back synchronously; RAZORPAY opens its modal and then polls (the
 * webhook is authoritative); CASHFREE/PHONEPE redirect to hosted pages and the
 * /payment-result page takes over. Credentials always arrive by email.
 */
const PaymentStep = ({
  payment,
  templateName,
  instituteId,
  registrationId,
  tncAccepted,
  customFieldValues,
  adminName,
  adminEmail,
  adminPhone,
  onRegistered,
  onSessionMissing,
}: PaymentStepProps) => {
  const vendor = (payment.vendor || "").toUpperCase() as PaymentVendor;

  const [phase, setPhase] = useState<PaymentPhase>("SELECT_PLAN");
  const [selectedPayment, setSelectedPayment] =
    useState<SelectedPayment | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState("");
  const [completeResponse, setCompleteResponse] =
    useState<CompleteRegistrationResponse | null>(null);
  const [stripeProcessor, setStripeProcessor] =
    useState<StripeProcessor | null>(null);
  const [ewayData, setEwayData] = useState<EwayEncryptedCardData | null>(null);
  const [cashfreeSession, setCashfreeSession] = useState<{
    paymentSessionId: string;
    orderId: string;
    /** "sandbox" | "production" from the backend — must match the session. */
    environment: string | null;
  } | null>(null);
  const [cashfreeInitLoading, setCashfreeInitLoading] = useState(false);

  const razorpayRef = useRef<RazorpayCheckoutFormRef>(null);
  // Latest /complete response, readable from gateway callbacks (which capture
  // stale render closures) — /complete must only ever run once.
  const completeResponseRef = useRef<CompleteRegistrationResponse | null>(null);
  const cashfreeInitAttemptedRef = useRef(false);

  const currency = selectedPayment?.currency || payment.currency;
  const amount = getSelectedPaymentPrice(selectedPayment);

  const paymentOptions = useMemo(
    () => ({
      id: "template-payment",
      name: templateName,
      description: "",
      currency: payment.currency,
      type: payment.type,
      payment_options: (payment.payment_plans ?? []).map((plan) =>
        toPaymentPlan(plan, payment.currency)
      ),
      discount_json: null,
      option_metadata: undefined,
    }),
    [payment, templateName]
  );

  const handlePaymentSelect = useCallback((selection: SelectedPayment) => {
    setSelectedPayment({
      ...selection,
      amount: getSelectedPaymentPrice(selection),
    });
  }, []);

  /**
   * The one-and-only POST /complete for paid registrations. Re-entry after a
   * successful call is prevented by callers reusing completeResponseRef.
   */
  const runComplete = useCallback(
    async (
      paymentInitiationRequest: PaymentInitiationRequest,
      planId: string
    ): Promise<CompleteRegistrationResponse | null> => {
      if (!registrationId) {
        toast.error("Registration session missing. Please start again");
        onSessionMissing();
        return null;
      }
      const response = await completeSubOrgRegistration({
        registration_id: registrationId,
        tnc_accepted: tncAccepted,
        custom_field_values: customFieldValues,
        plan_id: planId,
        payment_initiation_request: paymentInitiationRequest,
      });
      completeResponseRef.current = response;
      setCompleteResponse(response);
      return response;
    },
    [registrationId, tncAccepted, customFieldValues, onSessionMissing]
  );

  const handlePaymentFailure = useCallback(
    (err: unknown, fallback: string) => {
      const fallbackMessage =
        err instanceof Error && err.message ? err.message : fallback;
      const message = getSubOrgApiErrorMessage(err, fallbackMessage);
      if (isPaymentInProgressMessage(message)) {
        setPhase("ALREADY_IN_PROGRESS");
        return;
      }
      setError(message);
      toast.error(message);
    },
    []
  );

  /** STRIPE/EWAY: gateway result is synchronous on /complete. */
  const finishAfterComplete = useCallback(
    (response: CompleteRegistrationResponse) => {
      setOrderId(response.payment_response?.order_id ?? "");
      if (response.payment_response?.response_data?.paymentStatus === "PAID") {
        onRegistered(response.admin_email ?? null);
      } else {
        setPhase("PENDING");
      }
    },
    [onRegistered]
  );

  // ─── Razorpay checkout callbacks ───────────────────────────────────────────

  const handleRazorpaySuccess = useCallback(() => {
    // Webhook is authoritative — NO second /complete call. Poll until PAID.
    setError(null);
    setPhase("PENDING");
  }, []);

  const handleRazorpayClosed = useCallback((message: string) => {
    if (completeResponseRef.current) {
      // Order already exists — the payment may still land; keep polling.
      setPhase("PENDING");
    } else {
      setError(message);
    }
  }, []);

  // ─── Cashfree: create the order + hosted session on entering the gateway ───

  const initCashfreeSession = useCallback(async () => {
    if (!selectedPayment) return;
    setCashfreeInitLoading(true);
    setError(null);
    try {
      const response =
        completeResponseRef.current ??
        (await runComplete(
          buildPaymentInitiationRequest({
            vendor: "CASHFREE",
            amount: getSelectedPaymentPrice(selectedPayment),
            currency: selectedPayment.currency || payment.currency,
            instituteId,
            email: adminEmail,
            contact: adminPhone,
            returnUrl: getCashfreeReturnUrl(),
          }),
          selectedPayment.id
        ));
      if (!response) return;

      const responseData = response.payment_response?.response_data;
      let paymentSessionId =
        (typeof responseData?.paymentSessionId === "string" &&
          responseData.paymentSessionId) ||
        (typeof responseData?.payment_session_id === "string" &&
          responseData.payment_session_id) ||
        "";
      let cfOrderId = response.payment_response?.order_id ?? "";
      let cfEnvironment =
        typeof responseData?.environment === "string"
          ? responseData.environment
          : null;

      if (!paymentSessionId) {
        const userPlanId = response.user_plan_id;
        if (!userPlanId) {
          throw new Error(
            "Could not prepare the payment session. Please contact support"
          );
        }
        // Public flow — a token exists only if the visitor is already logged in.
        const token = (await getTokenFromStorage(TokenKey.accessToken)) ?? "";
        const cfResponse = await initiateCashfreePayment(
          instituteId,
          userPlanId,
          {
            amount: getSelectedPaymentPrice(selectedPayment),
            currency: selectedPayment.currency || payment.currency,
            email: adminEmail,
            returnUrl: getCashfreeReturnUrl(),
            token,
          }
        );
        paymentSessionId =
          cfResponse?.responseData?.paymentSessionId ??
          cfResponse?.responseData?.payment_session_id ??
          "";
        cfOrderId = cfResponse?.orderId ?? cfOrderId;
        cfEnvironment =
          typeof cfResponse?.responseData?.environment === "string"
            ? cfResponse.responseData.environment
            : cfEnvironment;
      }

      if (!paymentSessionId) {
        throw new Error(
          "Failed to initialize payment. Please try again or contact support"
        );
      }
      setOrderId(cfOrderId);
      setCashfreeSession({
        paymentSessionId,
        orderId: cfOrderId,
        environment: cfEnvironment,
      });
    } catch (err) {
      handlePaymentFailure(
        err,
        "Failed to initialize payment. Please try again"
      );
    } finally {
      setCashfreeInitLoading(false);
    }
  }, [
    selectedPayment,
    payment.currency,
    instituteId,
    adminEmail,
    adminPhone,
    runComplete,
    handlePaymentFailure,
  ]);

  useEffect(() => {
    if (vendor !== "CASHFREE" || phase !== "GATEWAY") return;
    if (cashfreeSession || cashfreeInitLoading) return;
    if (cashfreeInitAttemptedRef.current) return;
    cashfreeInitAttemptedRef.current = true;
    void initCashfreeSession();
  }, [vendor, phase, cashfreeSession, cashfreeInitLoading, initCashfreeSession]);

  // ─── Confirm & Pay (STRIPE / EWAY / RAZORPAY / PHONEPE) ────────────────────

  const handleConfirmAndPay = async () => {
    if (isProcessing || !selectedPayment) return;
    setError(null);
    setIsProcessing(true);
    let redirecting = false;
    try {
      if (vendor === "STRIPE") {
        if (!stripeProcessor) {
          setError(
            "The payment form is still loading. Please wait a moment and try again"
          );
          return;
        }
        const result = await stripeProcessor();
        if (!result.success || !result.paymentMethodId) {
          setError(
            result.error ||
              "Payment processing failed. Please check your card details"
          );
          return;
        }
        const response = await runComplete(
          buildPaymentInitiationRequest({
            vendor,
            amount,
            currency,
            instituteId,
            email: adminEmail,
            contact: adminPhone,
            paymentMethodId: result.paymentMethodId,
          }),
          selectedPayment.id
        );
        if (response) finishAfterComplete(response);
        return;
      }

      if (vendor === "EWAY") {
        if (!ewayData) {
          setError("Please complete the card details first");
          return;
        }
        const response = await runComplete(
          buildPaymentInitiationRequest({
            vendor,
            amount,
            currency,
            instituteId,
            email: adminEmail,
            contact: adminPhone,
            ewayPaymentData: ewayData,
          }),
          selectedPayment.id
        );
        if (response) finishAfterComplete(response);
        return;
      }

      if (vendor === "RAZORPAY") {
        // Reuse an already-created order (e.g. the modal was dismissed) —
        // /complete rejects re-entry while a payment is in progress.
        const response =
          completeResponseRef.current ??
          (await runComplete(
            buildPaymentInitiationRequest({
              vendor,
              amount,
              currency,
              instituteId,
              email: adminEmail,
              contact: adminPhone,
            }),
            selectedPayment.id
          ));
        if (!response) return;
        const responseData = response.payment_response?.response_data;
        const razorpayKeyId =
          typeof responseData?.razorpayKeyId === "string"
            ? responseData.razorpayKeyId
            : "";
        const razorpayOrderId =
          typeof responseData?.razorpayOrderId === "string"
            ? responseData.razorpayOrderId
            : "";
        if (!razorpayKeyId || !razorpayOrderId) {
          throw new Error("Failed to create the payment order. Please try again");
        }
        setOrderId(response.payment_response?.order_id ?? "");
        if (!razorpayRef.current) {
          throw new Error(
            "The payment gateway is not ready yet. Please try again"
          );
        }
        razorpayRef.current.openPayment({
          razorpayKeyId,
          razorpayOrderId,
          amount:
            typeof responseData?.amount === "number"
              ? responseData.amount
              : Number(responseData?.amount) || 0,
          currency:
            typeof responseData?.currency === "string"
              ? responseData.currency
              : currency || "INR",
          contact:
            typeof responseData?.contact === "string"
              ? responseData.contact
              : adminPhone || "",
          email:
            typeof responseData?.email === "string"
              ? responseData.email
              : adminEmail,
        });
        return;
      }

      if (vendor === "PHONEPE") {
        const response =
          completeResponseRef.current ??
          (await runComplete(
            buildPaymentInitiationRequest({
              vendor,
              amount,
              currency,
              instituteId,
              email: adminEmail,
              contact: adminPhone,
              returnUrl: getPhonePeReturnUrl(instituteId),
            }),
            selectedPayment.id
          ));
        if (!response) return;
        const responseData = response.payment_response?.response_data;
        const redirectUrl =
          (typeof responseData?.redirectUrl === "string" &&
            responseData.redirectUrl) ||
          (typeof responseData?.redirect_url === "string" &&
            responseData.redirect_url) ||
          "";
        if (!redirectUrl) {
          throw new Error(
            "Could not start PhonePe checkout. Please try again or contact support"
          );
        }
        const ordId = response.payment_response?.order_id ?? "";
        if (ordId) {
          try {
            localStorage.setItem(
              "phonepe_pending_order",
              JSON.stringify({ orderId: ordId, instituteId })
            );
          } catch {
            // Storage unavailable — /payment-result falls back to URL params.
          }
        }
        // Hand off to PhonePe's hosted checkout (full-page redirect); keep the
        // button in its processing state while the browser navigates away.
        redirecting = true;
        window.location.href = redirectUrl;
        return;
      }

      setError(
        `The payment gateway "${vendor}" is not supported yet. Please contact support`
      );
    } catch (err) {
      handlePaymentFailure(
        err,
        "Payment could not be processed. Please try again"
      );
    } finally {
      if (!redirecting) setIsProcessing(false);
    }
  };

  const handlePendingPaid = useCallback(() => {
    onRegistered(completeResponseRef.current?.admin_email ?? null);
  }, [onRegistered]);

  // Minimal adapter for PaymentPendingStep, which only reads
  // payment_response.response_data (via optional chaining).
  const pendingResponse = useMemo(
    () =>
      ({
        payment_response: completeResponse?.payment_response,
      }) as unknown as UserPaymentResponse,
    [completeResponse]
  );

  // Plan can only change before the one-shot /complete call locks it in.
  const canChangePlan =
    (payment.payment_plans?.length ?? 0) > 1 && !completeResponse;

  const confirmDisabled =
    isProcessing ||
    !selectedPayment ||
    (vendor === "STRIPE" && !stripeProcessor) ||
    (vendor === "EWAY" && !ewayData);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (phase === "ALREADY_IN_PROGRESS") {
    return (
      <ModernCard
        variant="glass"
        padding="lg"
        rounded="lg"
        className="border border-white/40 bg-white/90 shadow-lg backdrop-blur-md"
      >
        <div className="space-y-4 py-6 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-warning-50">
            <HourglassHigh className="size-8 text-warning-600" />
          </div>
          <h2 className="text-xl font-semibold text-neutral-700">
            Payment already in progress
          </h2>
          <p className="mx-auto max-w-md text-sm text-neutral-500">
            A payment for this registration is already being processed. If you
            completed it, your login credentials will be emailed to{" "}
            <span className="font-semibold text-neutral-700">{adminEmail}</span>{" "}
            shortly.
          </p>
          <p className="text-caption text-neutral-400">
            If the payment didn&apos;t go through, please reopen this
            registration link after a few minutes to try again.
          </p>
        </div>
      </ModernCard>
    );
  }

  if (phase === "PENDING") {
    return (
      <PaymentPendingStep
        orderId={orderId}
        paymentCompletionResponse={pendingResponse}
        selectedPayment={selectedPayment}
        setCurrentStep={handlePendingPaid}
      />
    );
  }

  if (phase === "SELECT_PLAN") {
    return (
      <div className="space-y-4">
        <PaymentSelectionStep
          paymentOptions={paymentOptions}
          selectedPayment={selectedPayment}
          onPaymentSelect={handlePaymentSelect}
        />
        <div className="flex justify-end">
          <MyButton
            type="button"
            buttonType="primary"
            scale="large"
            layoutVariant="default"
            onClick={() => setPhase("GATEWAY")}
            disable={!selectedPayment}
            className="w-full min-w-32 sm:w-auto"
          >
            Continue to Payment
          </MyButton>
        </div>
      </div>
    );
  }

  // GATEWAY phase
  return (
    <div className="space-y-4">
      {/* Selected plan summary */}
      <ModernCard
        variant="glass"
        padding="md"
        rounded="lg"
        className="border border-white/40 bg-white/90 shadow-lg backdrop-blur-md"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="flex-shrink-0 rounded-lg bg-primary-50 p-1.5 sm:p-2">
              <CreditCard className="size-5 text-primary-500 sm:size-6" />
            </div>
            <div>
              <p className="text-caption text-neutral-500">Selected plan</p>
              <p className="text-sm font-semibold text-neutral-700">
                {selectedPayment?.name}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <span className="text-lg font-bold text-neutral-700">
              {getCurrencySymbol(currency)}
              {amount}
            </span>
            {canChangePlan && (
              <MyButton
                type="button"
                buttonType="secondary"
                scale="small"
                layoutVariant="default"
                onClick={() => {
                  setError(null);
                  setPhase("SELECT_PLAN");
                }}
                disable={isProcessing || cashfreeInitLoading}
              >
                <ArrowLeft className="mr-1 size-3.5" />
                Change plan
              </MyButton>
            )}
          </div>
        </div>
      </ModernCard>

      {/* Gateway form (vendor-specific) */}
      <PaymentInfoStep
        error={error}
        vendor={vendor}
        amount={amount}
        currency={currency}
        instituteId={instituteId}
        onStripePaymentReady={(processPayment) =>
          setStripeProcessor(() => processPayment)
        }
        onEwayPaymentReady={setEwayData}
        onEwayError={setError}
        onRazorpayPaymentReady={handleRazorpaySuccess}
        onRazorpayError={handleRazorpayClosed}
        isProcessing={isProcessing}
        userName={adminName}
        userEmail={adminEmail}
        userContact={adminPhone}
        courseName={templateName}
        courseDescription={`Registration payment for ${templateName}`}
        razorpayRef={razorpayRef}
        cashfreePaymentSessionId={cashfreeSession?.paymentSessionId ?? null}
        cashfreeEnvironment={cashfreeSession?.environment}
        cashfreeReturnUrl={getCashfreeReturnUrl()}
        cashfreeOrderId={cashfreeSession?.orderId}
        cashfreeInitLoading={cashfreeInitLoading}
        cashfreeInstituteId={instituteId}
      />

      {/* Cashfree's inline form ignores the error prop — show init failures here */}
      {vendor === "CASHFREE" && error && (
        <div className="mx-auto w-full max-w-md space-y-3 rounded-lg border border-danger-200 bg-danger-50 p-4">
          <div className="flex items-start gap-2">
            <WarningCircle className="mt-0.5 size-5 flex-shrink-0 text-danger-600" />
            <p className="text-sm text-danger-700">{error}</p>
          </div>
          {!cashfreeSession && (
            <div className="flex justify-end">
              <MyButton
                type="button"
                buttonType="secondary"
                scale="small"
                layoutVariant="default"
                onClick={() => {
                  setError(null);
                  void initCashfreeSession();
                }}
                disable={cashfreeInitLoading}
              >
                <ArrowCounterClockwise className="mr-1 size-3.5" />
                Try again
              </MyButton>
            </div>
          )}
        </div>
      )}

      {/* Cashfree pays via its inline button; every other vendor confirms here */}
      {vendor !== "CASHFREE" && (
        <div className="flex justify-end">
          <MyButton
            type="button"
            buttonType="primary"
            scale="large"
            layoutVariant="default"
            onClick={() => void handleConfirmAndPay()}
            disable={confirmDisabled}
            className="w-full min-w-40 sm:w-auto"
          >
            {isProcessing ? (
              <>
                <SpinnerGap className="mr-2 size-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Confirm & Pay"
            )}
          </MyButton>
        </div>
      )}
    </div>
  );
};

export default PaymentStep;
