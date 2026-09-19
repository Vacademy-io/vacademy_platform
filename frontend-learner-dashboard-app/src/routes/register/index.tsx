import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import AssessmentRegistrationForm from "./-component/AssessmentRegistrationForm";
import AssessmentClosedExpiredComponent from "./-component/AssessmentClosedExpiredComponent";
import { utmSearchSchema } from "@/lib/utm-search-params";

const registerParamsSchema = z.object({
  code: z.union([z.string(), z.number()]),
  // Declared so the router does not strip them off the URL — see utmSearchSchema.
  ...utmSearchSchema,
});

export const Route = createFileRoute("/register/")({
  validateSearch: registerParamsSchema,
  component: RouteComponent,
  // The open-registration lookup throws when the assessment row is missing
  // (deleted, never existed, or the share code is wrong). Render the
  // same expired UI instead of bubbling up to the generic catch boundary.
  errorComponent: ({ error }) => {
    const { t } = useTranslation("registrationA");
    // Any render error in the route lands here and is shown as "Expired".
    // Log it so a real bug is not mistaken for a closed assessment.
    console.error("[register] route error rendered as Expired:", error);
    return (
      <AssessmentClosedExpiredComponent
        isExpired={true}
        assessmentName={t("closedExpired.defaultAssessmentName")}
      />
    );
  },
});

function RouteComponent() {
  return <AssessmentRegistrationForm />;
}
