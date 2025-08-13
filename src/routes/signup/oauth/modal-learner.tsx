import { useEffect } from "react";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { createFileRoute } from "@tanstack/react-router";
import { processModalOAuthSignup } from "@/components/common/auth/signup/oauth/modal-oauth-signup-flow";

export const Route = createFileRoute("/signup/oauth/modal-learner")({
  component: ModalOAuthSignupRedirectHandler,
});

function ModalOAuthSignupRedirectHandler() {
  useEffect(() => {
    processModalOAuthSignup();
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <DashboardLoader />
    </div>
  );
}
