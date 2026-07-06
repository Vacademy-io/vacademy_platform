import type { SubOrgRegistrationTemplate } from "../-services/sub-org-registration-services";
import CompletionPanel from "./completion-panel";

interface SuccessStepProps {
  orgName: string;
  adminEmail: string;
  /** Paid registration — payment was confirmed before completion. */
  paid?: boolean;
  /** Template completion settings (redirect / custom message / admin portal). */
  template: SubOrgRegistrationTemplate;
}

/**
 * Final step — registration completed. The template-driven completion
 * experience (auto-redirect, custom message, or the default admin-portal CTA)
 * lives in the shared CompletionPanel, which the /payment-result return page
 * reuses.
 */
const SuccessStep = ({
  orgName,
  adminEmail,
  paid = false,
  template,
}: SuccessStepProps) => {
  return (
    <CompletionPanel
      orgName={orgName}
      adminEmail={adminEmail}
      paid={paid}
      adminPortalUrl={template.admin_portal_url}
      completionMessage={template.completion_message}
      completionButtonLabel={template.completion_button_label}
      completionButtonUrl={template.completion_button_url}
      completionRedirectUrl={template.completion_redirect_url}
    />
  );
};

export default SuccessStep;
