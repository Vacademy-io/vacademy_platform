import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import EnrollByInvite from "@/components/common/enroll-by-invite/enroll-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleGetEnrollInviteData } from "@/components/common/enroll-by-invite/-services/enroll-invite-services";
import { PaymentGatewayWrapper } from "@/components/common/enroll-by-invite/-components/payment-gateway-wrapper";
import { getPaymentVendor } from "@/components/common/enroll-by-invite/-utils/payment-vendor-helper";

const inviteParamsSchema = z.object({
  instituteId: z.string().uuid(),
  inviteCode: z.string(),
  ref: z.string().optional(),
});

export const Route = createFileRoute("/learner-invitation-response/")({
  validateSearch: inviteParamsSchema,
  component: RouteComponent,
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
