import { QueryClient } from "@tanstack/react-query";
import {
    createRootRouteWithContext,
    Outlet,
    redirect,
} from "@tanstack/react-router";
import { useEffect } from "react";
import {
    AppUpdate,
    AppUpdateAvailability,
} from "@capawesome/capacitor-app-update";

import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { useUpdate } from "@/stores/useUpdate";
import Favicon from "react-favicon";
import useStore from "@/components/common/layout-container/sidebar/useSidebar";
import { Preferences } from "@capacitor/preferences";
import { useTheme } from "@/providers/theme/theme-provider";
import { HOLISTIC_INSTITUTE_ID } from "@/constants/urls";
import { useInstituteFeatureStore } from "@/stores/insititute-feature-store";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { getSubdomain } from "@/helpers/helper";
import { getStudentDisplaySettings } from "@/services/student-display-settings";

// Define public routes that don't require authentication
const PUBLIC_ROUTES = [
    "/login",
    "/signup",
    "/register",
    "/login/forgot-password",
    "/login/oauth",
    "/signup/oauth",
    "/privacy-policy",
    "/terms-and-conditions",
    "/referral",
    "/live-class-guest",
    "/learner-invitation-response",
    "/institute-selection",
    "/notifications-test",
    "/delete-user",
    "/change-password",
    "/logout",
    "/courses", // Course catalog should be public
    "/courses/course-details", // Course details should be public for browsing
];

const isAuthenticated = async () => {
    const token = await getTokenFromStorage(TokenKey.accessToken);
    const studentDetails = await Preferences.get({
        key: "StudentDetails",
    });
    const instituteDetails = await Preferences.get({
        key: "InstituteDetails",
    });

    const hasToken = !isNullOrEmptyOrUndefined(token);
    const hasStudentDetails = !isNullOrEmptyOrUndefined(studentDetails);
    const hasInstituteDetails = !isNullOrEmptyOrUndefined(instituteDetails);

    console.log(`🔍 Authentication check:`, {
        hasToken,
        hasStudentDetails,
        hasInstituteDetails,
        tokenLength: token ? token.length : 0,
        studentDetailsLength: studentDetails?.value
            ? studentDetails.value.length
            : 0,
        instituteDetailsLength: instituteDetails?.value
            ? instituteDetails.value.length
            : 0,
    });

    return hasToken && hasStudentDetails && hasInstituteDetails;
};

// Helper function to check if a route is public
const isPublicRoute = (pathname: string): boolean => {
    return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
};

const RootComponent = () => {
    const { setUpdateAvailable } = useUpdate();
    const { instituteLogoFileUrl } = useStore();
    const vacademyUrl = "/vacademy-logo.svg";
    const { setPrimaryColor } = useTheme();
    const { setInstituteId } = useInstituteFeatureStore();

    const setPrimaryColorFromStorage = async () => {
        const details = await Preferences.get({ key: "InstituteDetails" });
        const parsedDetails = details.value ? JSON.parse(details.value) : null;
        const themeCode = parsedDetails?.institute_theme_code;
        const instituteId = parsedDetails?.id;
        setInstituteId(instituteId);
        if (instituteId === HOLISTIC_INSTITUTE_ID) {
            setPrimaryColor("holistic");
        } else {
            setPrimaryColor(themeCode ?? "primary");
        }
    };

    const getFallbackLogoUrl = (logoUrl: string | null | undefined): string => {
        return logoUrl && logoUrl.trim() !== "" ? logoUrl : vacademyUrl;
    };

    useEffect(() => {
        const checkForUpdate = async () => {
            if (Capacitor.getPlatform() === "web") return;

            try {
                const result = await AppUpdate.getAppUpdateInfo();
                if (
                    result.updateAvailability ===
                    AppUpdateAvailability.UPDATE_AVAILABLE
                ) {
                    toast.warning("Update available, please update app...");
                    setUpdateAvailable(true);
                    if (result.immediateUpdateAllowed) {
                        await AppUpdate.performImmediateUpdate();
                    }
                }
            } catch (error) {
                console.error("Error checking app update:", error);
            }
        };

        checkForUpdate();
        setPrimaryColorFromStorage();
        // We intentionally skip deps here to avoid re-running in StrictMode
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <>
            <Outlet />
            <Favicon url={getFallbackLogoUrl(instituteLogoFileUrl)} />
        </>
    );
};

export const Route = createRootRouteWithContext<{
    queryClient: QueryClient;
}>()({
    beforeLoad: async ({ location }) => {
        // Handle root path redirect
    if (location.pathname === "/") {
      try {
        // If already authenticated, redirect to settings.postLoginRedirectRoute
        const authenticated = await isAuthenticated();
        if (authenticated) {
          const settings = await getStudentDisplaySettings(true);
          const route = settings?.postLoginRedirectRoute || "/dashboard";
          console.log("[Root beforeLoad] Authenticated at '/'. Redirecting to:", route);
          // Support external absolute URLs
          if (/^https?:\/\//.test(route)) {
            // Can't external-redirect from beforeLoad; fall back to internal default
            throw redirect({ to: "/dashboard" });
          }
          throw redirect({ to: route as never });
        }
      } catch {
        // fallthrough to public handling
      }

      // Special case: if subdomain is "code-circle", redirect to courses instead of login
      const subdomain = getSubdomain(window.location.hostname);
      if (subdomain === "code-circle") {
          throw redirect({
              to: "/courses",
          });
      }

      throw redirect({
          to: "/login",
      });
        }

    // If authenticated and directly on /dashboard, honor settings route
    try {
      const authenticated = await isAuthenticated();
      if (authenticated && location.pathname === "/dashboard") {
        const settings = await getStudentDisplaySettings(false);
        const route = settings?.postLoginRedirectRoute || "/dashboard";
        console.log("[Root beforeLoad] On '/dashboard'. Settings route:", route);
        if (route !== "/dashboard" && !/^https?:\/\//.test(route)) {
          throw redirect({ to: route as never });
        }
      }
    } catch {
        // ignore
    }

        // Skip authentication check for public routes
        if (isPublicRoute(location.pathname)) {
            return;
        }

        // Check authentication for all other routes
        const authenticated = await isAuthenticated();
        if (!authenticated) {
            // Special case: if subdomain is "code-circle", redirect to courses instead of login
            const subdomain = getSubdomain(window.location.hostname);
            if (subdomain === "code-circle") {
                throw redirect({
                    to: "/courses",
                });
            }

            // Store the current path as redirect URL for after login
            const redirectUrl = location.pathname + location.search;
            throw redirect({
                to: "/login",
                search: { redirect: redirectUrl },
            });
        }
    },
    component: RootComponent,
});
