import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import EnrollByInvite from "@/components/common/enroll-by-invite/enroll-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleGetEnrollInviteData } from "@/components/common/enroll-by-invite/-services/enroll-invite-services";
import { PaymentGatewayWrapper } from "@/components/common/enroll-by-invite/-components/payment-gateway-wrapper";
import { getPaymentVendor } from "@/components/common/enroll-by-invite/-utils/payment-vendor-helper";
import { Link2Off, CreditCard, AlertTriangle } from "lucide-react";

const inviteParamsSchema = z.object({
  instituteId: z.string().uuid(),
  inviteCode: z.string(),
  ref: z.string().optional(),
});

function InviteNotFoundPage() {
  const router = useRouter();
  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col justify-center items-center px-4">
      <div className="max-w-md mx-auto text-center w-full">
        <div className="mb-8 flex justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-orange-100 border-4 border-white shadow-sm">
            <Link2Off className="h-12 w-12 text-orange-500" aria-hidden="true" />
          </div>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
          Enroll Invite Not Found
        </h1>
        <p className="mt-4 text-base text-gray-500 max-w-sm mx-auto">
          This enroll invite link is invalid or may have already expired. Please contact your institute for a new invite link.
        </p>
        <div className="mt-8">
          <button
            onClick={() => router.history.back()}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentGatewayNotConfiguredPage() {
  const router = useRouter();
  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col justify-center items-center px-4">
      <div className="max-w-md mx-auto text-center w-full">
        <div className="mb-8 flex justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-blue-100 border-4 border-white shadow-sm">
            <CreditCard className="h-12 w-12 text-blue-500" aria-hidden="true" />
          </div>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
          Payments Not Set Up
        </h1>
        <p className="mt-4 text-base text-gray-500 max-w-sm mx-auto">
          The institute has not configured a payment gateway for this enrollment. Please contact your institute to complete the setup.
        </p>
        <div className="mt-8">
          <button
            onClick={() => router.history.back()}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

function UnexpectedErrorPage() {
  const router = useRouter();
  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col justify-center items-center px-4">
      <div className="max-w-md mx-auto text-center w-full">
        <div className="mb-8 flex justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-red-100 border-4 border-white shadow-sm">
            <AlertTriangle className="h-12 w-12 text-red-500" aria-hidden="true" />
          </div>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
          Unable to Load
        </h1>
        <p className="mt-4 text-base text-gray-500 max-w-sm mx-auto">
          Something went wrong while loading this enrollment page. Please try again or contact your institute if the issue continues.
        </p>
        <div className="mt-8">
          <button
            onClick={() => router.history.back()}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteErrorComponent({ error }: { error: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const axiosError = error as any;
  const status = axiosError?.response?.status;
  const errorMessage: string = axiosError?.response?.data?.ex ?? "";

  if (status === 510 || status === 404) {
    if (errorMessage.toLowerCase().includes("configurar") || errorMessage.toLowerCase().includes("payment gateway")) {
      return <PaymentGatewayNotConfiguredPage />;
    }
    return <InviteNotFoundPage />;
  }
  return <UnexpectedErrorPage />;
}

export const Route = createFileRoute("/learner-invitation-response/")({
  validateSearch: inviteParamsSchema,
  component: RouteComponent,
  errorComponent: ({ error }) => <InviteErrorComponent error={error} />,
});

function RouteComponent() {
  const { instituteId, inviteCode } = Route.useSearch();
  // Fetch invite details FIRST to determine payment vendor
  const { data: inviteData } = useSuspenseQuery(
    handleGetEnrollInviteData({ instituteId, inviteCode })
  );
  // Determine which payment gateway to use based on invite data
  const paymentVendor = getPaymentVendor(inviteData);
  return (
    <PaymentGatewayWrapper vendor={paymentVendor} instituteId={instituteId}>
      <EnrollByInvite vendor={paymentVendor} />
    </PaymentGatewayWrapper>
  );
}