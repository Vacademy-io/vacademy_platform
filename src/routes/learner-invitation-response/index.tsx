import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import EnrollByInvite from "@/components/common/enroll-by-invite/enroll-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleGetStripeKeys } from "@/components/common/enroll-by-invite/-services/enroll-invite-services";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";

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
  const { instituteId } = Route.useSearch();
  const { data: stripeKeys } = useSuspenseQuery(
    handleGetStripeKeys(instituteId)
  );
  // Replace with your own publishable key
  const stripePromise = loadStripe(stripeKeys.publishableKey);
  return (
    <Elements stripe={stripePromise}>
      <EnrollByInvite />
    </Elements>
  );
}
