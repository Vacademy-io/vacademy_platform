import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { removeTokensAndLogout } from "@/lib/auth/sessionUtility";
import { pushNotificationService } from "@/services/push-notifications/push-notification-service";
import { useNavigate } from "@tanstack/react-router";
import { NAMING_SETTINGS_KEY } from "@/types/naming-settings";
import { useDomainRouting } from "@/hooks/use-domain-routing";

export const Route = createFileRoute("/logout/")({
    component: RouteComponent,
    validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
        return {
            redirect: (typeof search.redirect === "string" ? search.redirect : undefined),
        };
    },
});

function RouteComponent() {
    const navigate = useNavigate();
    const domainRouting = useDomainRouting();
    const { redirect } = Route.useSearch();

    useEffect(() => {
        // Remove naming settings but keep InstituteId
        localStorage.removeItem(NAMING_SETTINGS_KEY);
        // Deactivate push token for this device on logout
        pushNotificationService.deactivateToken().catch(() => {});
        removeTokensAndLogout();

        // Prefer explicit redirect param if provided
        if (redirect && typeof redirect === "string") {
            if (/^https?:\/\//.test(redirect)) {
                window.location.assign(redirect);
            } else {
                navigate({ to: redirect });
            }
            return;
        }

        // Fallback to domain routing's resolved redirect path
        const fallback = domainRouting.redirectPath || "/login";
        navigate({ to: fallback });
    }, [navigate, redirect, domainRouting.redirectPath]);
    return <div>Loging out ....</div>;
}
