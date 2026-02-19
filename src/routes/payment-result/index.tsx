import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPaymentCompletionStatus } from "@/components/common/enroll-by-invite/-services/enroll-invite-services";
import { getCashfreePaymentStatus } from "@/services/cashfree-payment";
import { performFullAuthCycle } from "@/services/auth-cycle-service";
import { loginByUsernameTrusted, loginEnrolledUser } from "@/services/signup-api";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { BASE_URL_LEARNER_DASHBOARD } from "@/constants/urls";

const paymentResultSearchSchema = z.object({
  orderId: z.string().optional(),
  order_id: z.string().optional(), // Cashfree may append this; prefer orderId (payment log ID)
  instituteId: z.string().optional(),
  institute_id: z.string().optional(), // snake_case fallback
  status: z.enum(["success", "failed", "cancelled"]).optional(),
});

export const Route = createFileRoute("/payment-result/")({
  validateSearch: paymentResultSearchSchema,
  component: PaymentResultPage,
});

function isValidInstituteId(id: string | undefined): id is string {
  return !!(id && id !== "null" && id.trim() !== "");
}

function PaymentResultPage() {
  const search = Route.useSearch();
  const {
    orderId: orderIdParam,
    order_id: orderIdSnake,
    instituteId: instituteIdParam,
    institute_id: instituteIdSnake,
    status: queryStatus,
  } = search;
  // Prefer orderId (payment log ID) from our return URL; order_id may be Cashfree's ID
  const orderId = orderIdParam ?? orderIdSnake ?? "";
  const instituteId = instituteIdParam ?? instituteIdSnake;
  const validInstituteId = isValidInstituteId(instituteId) ? instituteId : undefined;
  const isCashfreeFlow = !!orderId && !!validInstituteId;
  const hasRedirectedRef = useRef(false);

  // Extract status from various backend response shapes (payment_status, status, paymentStatus, nested)
  const getStatusFromResponse = (data: unknown): string | undefined => {
    if (!data || typeof data !== "object") return undefined;
    const d = data as Record<string, unknown>;
    const rd = d.response_data as Record<string, unknown> | undefined;
    const inner = (d.data ?? d.result) as Record<string, unknown> | undefined;
    const raw =
      (d.payment_status as string) ??
      (d.status as string) ??
      (d.paymentStatus as string) ??
      (rd?.payment_status as string) ??
      (rd?.status as string) ??
      (rd?.paymentStatus as string) ??
      (inner?.payment_status as string) ??
      (inner?.status as string) ??
      (inner?.paymentStatus as string);
    return typeof raw === "string" ? raw.toUpperCase() : undefined;
  };

  const { data: paymentStatus, isLoading } = useQuery({
    queryKey: isCashfreeFlow
      ? ["CASHFREE_PAYMENT_STATUS", orderId, validInstituteId]
      : ["GET_PAYMENT_COMPLETION_STATUS", orderId],
    queryFn: () =>
      isCashfreeFlow && orderId && validInstituteId
        ? getCashfreePaymentStatus(orderId, validInstituteId)
        : getPaymentCompletionStatus({ paymentLogId: orderId || "" }),
    enabled: !!orderId,
    refetchInterval: (query) => {
      const ps = getStatusFromResponse(query.state.data);
      if (
        ps === "PAID" ||
        ps === "SUCCESS" ||
        ps === "FLAGGED" ||
        ps === "FAILED"
      )
        return false;
      // Poll less frequently to reduce backend load
      return 12000; // 8 seconds
    },
  });

  const paymentStatusValue = getStatusFromResponse(paymentStatus);
  const isPaid =
    paymentStatusValue === "PAID" ||
    paymentStatusValue === "SUCCESS" ||
    paymentStatusValue === "FLAGGED";
  const isFailed =
    paymentStatusValue === "FAILED" ||
    paymentStatusValue === "CANCELLED" ||
    paymentStatusValue === "USER_DROPPED" ||
    queryStatus === "failed" ||
    queryStatus === "cancelled";
  const isPending = !isPaid && !isFailed && (!!orderId || isLoading);

  // When payment is successful: auto-login via tokens from status API, or fallback to stored creds + login API
  useEffect(() => {
    if (!isPaid || hasRedirectedRef.current) return;

    const doRedirect = (path = "/study-library/courses") => {
      if (hasRedirectedRef.current) return;
      hasRedirectedRef.current = true;
      const base =
        typeof window !== "undefined"
          ? window.location.origin
          : BASE_URL_LEARNER_DASHBOARD;
      window.location.href = `${base}${path}`;
    };

    const data = paymentStatus as {
      use_login_api?: boolean;
      login_username?: string;
      accessToken?: string;
      access_token?: string;
      refreshToken?: string;
      refresh_token?: string;
      user?: { email?: string; username?: string; password?: string };
      response_data?: {
        accessToken?: string;
        access_token?: string;
        refreshToken?: string;
        refresh_token?: string;
        institute_id?: string;
      };
      institute_id?: string;
    };
    const useLoginApi = data?.use_login_api === true;
    const loginUsername =
      data?.login_username ?? data?.user?.username ?? data?.user?.email;
    const instituteIdFromApi =
      data?.institute_id ?? data?.response_data?.institute_id;
    const effectiveInstituteId =
      validInstituteId ?? (typeof instituteIdFromApi === "string" && instituteIdFromApi ? instituteIdFromApi : undefined);

    // Tokens from status API (legacy – learner-invitation may still return them)
    const accessToken =
      data?.accessToken ??
      data?.access_token ??
      data?.response_data?.accessToken ??
      data?.response_data?.access_token;
    const refreshToken =
      data?.refreshToken ??
      data?.refresh_token ??
      data?.response_data?.refreshToken ??
      data?.response_data?.refresh_token;
    const userEmail = data?.user?.email ?? data?.user?.username;
    const userPassword = data?.user?.password;

    const runLoginAndRedirect = async () => {
      try {
        const credsFromStorage = orderId
          ? (() => {
              try {
                const raw = sessionStorage.getItem(
                  `enroll_payment_creds_${orderId}`
                );
                if (!raw) return null;
                const parsed = JSON.parse(raw) as {
                  username?: string;
                  password?: string;
                };
                sessionStorage.removeItem(`enroll_payment_creds_${orderId}`);
                return parsed;
              } catch {
                return null;
              }
            })()
          : null;

        const username = credsFromStorage?.username ?? userEmail ?? loginUsername ?? "";
        const password = credsFromStorage?.password ?? userPassword ?? "";

        // 1. Catalog post-payment: use_login_api + login_username – call login-by-username-trusted
        if (useLoginApi && loginUsername && effectiveInstituteId) {
          const loginResponse = await loginByUsernameTrusted(
            loginUsername,
            effectiveInstituteId
          );
          await performFullAuthCycle(loginResponse, effectiveInstituteId);
          doRedirect("/study-library/courses");
          return;
        }

        // 2. Legacy: tokens in status response (if backend still returns them)
        if (effectiveInstituteId && accessToken && refreshToken) {
          await performFullAuthCycle(
            { accessToken, refreshToken },
            effectiveInstituteId
          );
          doRedirect("/study-library/courses");
          return;
        }

        // 3. Learner-invitation: stored creds + standard login API
        if (username && password && effectiveInstituteId) {
          const loginResponse = await loginEnrolledUser(
            username,
            password,
            effectiveInstituteId
          );
          await performFullAuthCycle(loginResponse, effectiveInstituteId);
          doRedirect("/study-library/courses");
          return;
        }
      } catch {
        /* login failed, fallback to login page */
      }
      doRedirect("/login?redirect=/study-library/courses");
    };

    runLoginAndRedirect();
  }, [isPaid, paymentStatus, orderId, validInstituteId]);

  const useFullScreenLayout = isPending || isPaid;

  return (
    <div className="min-h-screen w-full bg-gray-50 flex items-center justify-center p-4">
      <div
        className={
          useFullScreenLayout
            ? "w-full min-h-screen flex flex-col items-center justify-center"
            : "max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center"
        }
      >
        {!orderId ? (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <XCircle className="w-10 h-10 text-amber-600" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Invalid Payment Link
            </h1>
            <p className="text-gray-600 mb-6">
              No order ID was provided. Please complete your payment from the
              enrollment page.
            </p>
          </>
        ) : isPaid ? (
          <div className="w-full flex flex-col items-center justify-center text-center px-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Payment Successful!
            </h1>
            <p className="text-gray-600 mb-6">
              Your enrollment has been confirmed. Redirecting you to your
              courses...
            </p>
            <a
              href={
                typeof window !== "undefined"
                  ? `${window.location.origin}/study-library/courses`
                  : `${BASE_URL_LEARNER_DASHBOARD}/study-library/courses`
              }
              className="inline-flex items-center justify-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 font-medium"
            >
              Go to My Courses
            </a>
          </div>
        ) : isFailed ? (
          <>
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Payment Failed or Cancelled
            </h1>
            <p className="text-gray-600 mb-6">
              Your payment could not be completed. Please try again or contact
              support if the issue persists.
            </p>
            <a
              href={
                typeof window !== "undefined"
                  ? `${window.location.origin}/study-library/courses`
                  : `${BASE_URL_LEARNER_DASHBOARD}/study-library/courses`
              }
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium"
            >
              Back to Dashboard
            </a>
          </>
        ) : (
          <div className="w-full flex flex-col items-center justify-center text-center px-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Processing Payment...
            </h1>
            <p className="text-gray-600">
              Please wait while we confirm your payment status. This usually
              takes a few seconds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
