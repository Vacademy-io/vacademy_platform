import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { removeTokensAndLogout } from "@/lib/auth/sessionUtility";
import { pushNotificationService } from "@/services/push-notifications/push-notification-service";
import { useNavigate } from "@tanstack/react-router";
import { NAMING_SETTINGS_KEY } from "@/types/naming-settings";
import { useDomainRouting } from "@/hooks/use-domain-routing";
import { useDripConditionStore } from "@/stores/study-library/drip-conditions-store";

export const Route = createFileRoute("/logout/")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    return {
      redirect:
        typeof search.redirect === "string" ? search.redirect : undefined,
    };
  },
});

function RouteComponent() {
  const navigate = useNavigate();
  const domainRouting = useDomainRouting();
  const { redirect } = Route.useSearch();
  const { clearAll } = useDripConditionStore();

  // Perform logout side-effects once on mount
  useEffect(() => {
    localStorage.removeItem(NAMING_SETTINGS_KEY);
    clearAll(); // Clear drip conditions on logout
    pushNotificationService.deactivateToken().catch(() => {});
    removeTokensAndLogout();
  }, [clearAll]);

  // After logout, navigate once domain routing has resolved (or honor explicit redirect)
  useEffect(() => {
    // Prefer explicit redirect param if provided
    if (redirect && typeof redirect === "string") {
      if (/^https?:\/\//.test(redirect)) {
        window.location.assign(redirect);
      } else {
        navigate({ to: redirect });
      }
      return;
    }

    // Wait until domain routing finishes resolving to avoid defaulting to /login prematurely
    if (domainRouting.isLoading) {
      return;
    }

    const target = domainRouting.redirectPath || "/login";
    if (/^https?:\/\//.test(target)) {
      window.location.assign(target);
    } else {
      navigate({ to: target });
    }
  }, [redirect, domainRouting.isLoading, domainRouting.redirectPath, navigate]);
  return <div>Loging out ....</div>;
}
