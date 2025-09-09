import { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { applyTabBranding } from "@/utils/branding";
import { useInstituteFeatureStore } from "@/stores/insititute-feature-store";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { getSubdomain } from "@/helpers/helper";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import {
  resolveDomainRouting,
  getCurrentDomainInfo,
} from "@/services/domain-routing";

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
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);

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
    // Apply tab branding from Preferences (tabText and tabIconFileId) with fallback title
    (async () => {
      const result = await applyTabBranding(document.title);
      if (result?.iconUrl) {
        // Bust cache to ensure latest icon displays
        setFaviconUrl(`${result.iconUrl}?v=${Date.now()}`);
      }
    })();
    const checkForUpdate = async () => {
      if (Capacitor.getPlatform() === "web") return;

      try {
        const result = await AppUpdate.getAppUpdateInfo();
        if (
          result.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE
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
      <Favicon url={getFallbackLogoUrl(faviconUrl || instituteLogoFileUrl)} />
    </>
  );
};

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  beforeLoad: async ({ location }) => {
    // Skip all logic for public routes - they should work without any redirects
    if (isPublicRoute(location.pathname)) {
      return;
    }

    // Handle root path redirect
    if (location.pathname === "/") {
      try {
        // If already authenticated, redirect to settings.postLoginRedirectRoute
        const authenticated = await isAuthenticated();
        if (authenticated) {
          const settings = await getStudentDisplaySettings(true);
          const route = settings?.postLoginRedirectRoute || "/dashboard";
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

      // New domain routing logic for unauthenticated users
      try {
        const { domain, subdomain } = await getCurrentDomainInfo();

        // Use actual domain and subdomain (or "*" if no subdomain)
        const testSubdomain = subdomain || "*";

        // Try to resolve domain routing
        const domainRoutingResult = await resolveDomainRouting(
          domain,
          testSubdomain
        );

        if (domainRoutingResult) {
          // API returned valid institute data, use the redirect field from API response
          const redirectPath = domainRoutingResult.redirect || "/courses";
          throw redirect({ to: redirectPath as never });
        }

        // Fallback to old logic for backward compatibility
        const fallbackSubdomain = getSubdomain(window.location.hostname);
        if (fallbackSubdomain === "code-circle") {
          throw redirect({ to: "/courses" });
        }
      } catch (error) {
        if (error instanceof Response && [301, 302, 303, 307, 308].includes(error.status)) {
          console.log("[__root] Caught redirect Response in root block. Rethrowing.", {
            status: error.status,
          });
          throw error;
        }
        console.error("Error resolving domain routing:", error);
        // Domain routing error, continuing to fallback logic
      }

      console.log("[__root] Redirecting unauthenticated user to /login");
      throw redirect({ to: "/login" });
    }

    // If authenticated and directly on /dashboard, honor settings route
    try {
      const authenticated = await isAuthenticated();
      if (authenticated && location.pathname === "/dashboard") {
        const settings = await getStudentDisplaySettings(false);
        const route = settings?.postLoginRedirectRoute || "/dashboard";
        // On '/dashboard'. Settings route: ${route}
        if (route !== "/dashboard" && !/^https?:\/\//.test(route)) {
          throw redirect({ to: route as never });
        }
      }
    } catch {
      // ignore
    }

    // Check authentication for all other routes
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      // New domain routing logic for unauthenticated users
      try {
        const { domain, subdomain } = await getCurrentDomainInfo();

        // Use actual domain and subdomain (or "*" if no subdomain)
        const testSubdomain = subdomain || "*";

        // Try to resolve domain routing
        const domainRoutingResult = await resolveDomainRouting(
          domain,
          testSubdomain
        );

        if (domainRoutingResult) {
          // API returned valid institute data, use the redirect field from API response
          const redirectPath = domainRoutingResult.redirect || "/courses";
          throw redirect({ to: redirectPath as never });
        }

        // Fallback to old logic for backward compatibility
        const fallbackSubdomain = getSubdomain(window.location.hostname);
        if (fallbackSubdomain === "code-circle") {
          throw redirect({ to: "/courses" });
        }
      } catch (error) {
        if (error instanceof Response && [301, 302, 303, 307, 308].includes(error.status)) {
          console.log("[__root] (protected) Caught redirect Response. Rethrowing.", {
            status: error.status,
          });
          throw error;
        }
        console.error("Error resolving domain routing:", error);
        // Domain routing error for protected route, continuing to fallback logic
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
