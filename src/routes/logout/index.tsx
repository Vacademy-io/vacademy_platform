import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { removeTokensAndLogout } from "@/lib/auth/sessionUtility";
import { useNavigate } from "@tanstack/react-router";
import { NAMING_SETTINGS_KEY } from "@/types/naming-settings";
import { getSubdomain } from "@/helpers/helper";

export const Route = createFileRoute("/logout/")({
    component: RouteComponent,
});

function RouteComponent() {
    const navigate = useNavigate();

    useEffect(() => {
        localStorage.removeItem(NAMING_SETTINGS_KEY);
        removeTokensAndLogout();

        // Special case: if subdomain is "code-circle", redirect to courses instead of login
        const subdomain = getSubdomain(window.location.hostname);
        if (subdomain === "code-circle") {
            navigate({
                to: "/courses",
            });
        } else {
            navigate({
                to: "/login",
            });
        }
    }, []);
    return <div>Loging out ....</div>;
}
