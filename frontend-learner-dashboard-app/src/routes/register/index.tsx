import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import AssessmentRegistrationForm from "./-component/AssessmentRegistrationForm";
import AssessmentClosedExpiredComponent from "./-component/AssessmentClosedExpiredComponent";

const registerParamsSchema = z.object({
  code: z.union([z.string(), z.number()]),
});

export const Route = createFileRoute("/register/")({
  validateSearch: registerParamsSchema,
  component: RouteComponent,
  // The open-registration lookup throws when the assessment row is missing
  // (deleted, never existed, or the share code is wrong). Render the
  // same expired UI instead of bubbling up to the generic catch boundary.
  errorComponent: () => {
    const { t } = useTranslation("registrationA");
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
