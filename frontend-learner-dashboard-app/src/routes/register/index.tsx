import { createFileRoute, type ErrorComponentProps } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { z } from "zod";
import AssessmentRegistrationForm from "./-component/AssessmentRegistrationForm";
import AssessmentClosedExpiredComponent from "./-component/AssessmentClosedExpiredComponent";
import { utmSearchSchema } from "@/lib/utm-search-params";
import {
  classifyRequestError,
  isAssessmentNotFoundError,
} from "./-utils/request-error";
import { OPEN_REGISTRATION_DETAILS_QUERY_KEY } from "./-services/open-registration-services";

const registerParamsSchema = z.object({
  code: z.union([z.string(), z.number()]),
  // Declared so the router does not strip them off the URL — see utmSearchSchema.
  ...utmSearchSchema,
});

/**
 * Everything thrown while rendering this route lands here: the suspense
 * lookup failing (bad share code, backend down, offline) as well as a plain
 * render bug. Each gets its own screen — none of them may claim the
 * assessment has expired, because at this point we don't know its state.
 */
const RegisterErrorComponent = ({ error, reset }: ErrorComponentProps) => {
  const queryClient = useQueryClient();
  const classified = classifyRequestError(error);

  useEffect(() => {
    console.error("[register] failed to load:", classified, error);
  }, [error, classified]);

  const retry = () => {
    // Drop the failed query so the remounted form fetches fresh instead of
    // re-throwing the cached error.
    queryClient.removeQueries({ queryKey: [OPEN_REGISTRATION_DETAILS_QUERY_KEY] });
    reset();
  };

  if (isAssessmentNotFoundError(error)) {
    return <AssessmentClosedExpiredComponent variant="notFound" />;
  }

  return (
    <AssessmentClosedExpiredComponent
      variant={classified.kind === "network" ? "network" : "error"}
      // Only surface backend sentences; axios/JS messages are noise to a learner.
      detail={classified.kind === "business" ? classified.message : undefined}
      onRetry={retry}
    />
  );
};

export const Route = createFileRoute("/register/")({
  validateSearch: registerParamsSchema,
  component: RouteComponent,
  errorComponent: RegisterErrorComponent,
});

function RouteComponent() {
  return <AssessmentRegistrationForm />;
}
