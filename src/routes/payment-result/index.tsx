import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPaymentCompletionStatus } from "@/components/common/enroll-by-invite/-services/enroll-invite-services";
import { getCashfreePaymentStatus } from "@/services/cashfree-payment";
import { performFullAuthCycle } from "@/services/auth-cycle-service";
import { loginEnrolledUser } from "@/services/signup-api";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { BASE_URL_LEARNER_DASHBOARD } from "@/constants/urls";

const paymentResultSearchSchema = z.object({
  orderId: z.string().optional(),
  instituteId: z.string().optional(),
  status: z.enum(["success", "failed", "cancelled"]).optional(),
});

export const Route = createFileRoute("/payment-result/")({
  validateSearch: paymentResultSearchSchema,
  component: PaymentResultPage,
});

function PaymentResultPage() {
  const { orderId, instituteId, status: queryStatus } = Route.useSearch();
  const isCashfreeFlow = !!orderId && !!instituteId;
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
      ? ["CASHFREE_PAYMENT_STATUS", orderId, instituteId]
      : ["GET_PAYMENT_COMPLETION_STATUS", orderId],
    queryFn: () =>
      isCashfreeFlow && orderId && instituteId
        ? getCashfreePaymentStatus(orderId, instituteId)
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
      return 3000;
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

  // When payment is successful: use username/password to call login API, save tokens, redirect to courses
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
      accessToken?: string;
      refreshToken?: string;
      user?: { email?: string; username?: string; password?: string };
      response_data?: { accessToken?: string; refreshToken?: string };
    };
    const accessToken =
      data?.accessToken ?? data?.response_data?.accessToken;
    const refreshToken =
      data?.refreshToken ?? data?.response_data?.refreshToken;
    const userEmail = data?.user?.email ?? data?.user?.username;
    const userPassword = data?.user?.password;

    const runLoginAndRedirect = async () => {
      try {
        const credsFromStorage =
          orderId &&
          (() => {
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
          })();

        const username =
          credsFromStorage?.username ?? userEmail ?? "";
        const password = credsFromStorage?.password ?? userPassword ?? "";

        if (instituteId && accessToken && refreshToken) {
          await performFullAuthCycle(
            { accessToken, refreshToken },
            instituteId
          );
          doRedirect("/study-library/courses");
          return;
        }

        if (username && password && instituteId) {
          const loginResponse = await loginEnrolledUser(
            username,
            password,
            instituteId
          );
          await performFullAuthCycle(loginResponse, instituteId);
          doRedirect("/study-library/courses");
          return;
        }
      } catch {
        /* login failed, fallback to login page */
      }
      doRedirect("/login?redirect=/study-library/courses");
    };

    runLoginAndRedirect();
  }, [isPaid, paymentStatus, orderId, instituteId]);

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
              href={`${BASE_URL_LEARNER_DASHBOARD}/study-library/courses`}
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
