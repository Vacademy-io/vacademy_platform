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
import type { StudentUIType } from "@/types/student-display-settings";
import {
  resolveDomainRouting,
  getCurrentDomainInfo,
} from "@/services/domain-routing";
import { ChatbotPanel } from "@/components/chatbot/ChatbotPanel";
import { ChatbotProvider } from "@/components/chatbot/ChatbotContext";
import { getChatbotSettings } from "@/services/chatbot-settings";

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
  "/planning/planning-logs",
  "/planning/activity-logs",
  "/live-class-guest",
  "/study-library/live-class/",
  "/learner-invitation-response",
  "/audience-response",
  "/institute-selection",
  "/delete-user",
  "/change-password",
  "/logout",
  "/courses", // Course catalog should be public
  "/courses/course-details", // Course details should be public for browsing
  "/un", // Public unsubscribe links
  "/m", // Public media hosting page
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
  const hasStudentDetails = !isNullOrEmptyOrUndefined(studentDetails?.value);
  const hasInstituteDetails = !isNullOrEmptyOrUndefined(
    instituteDetails?.value
  );

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
  // Check for exact matches and startsWith matches
  const directMatch = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  // Special handling for dynamic routes
  const isDynamicLiveClassRoute =
    /^\/study-library\/live-class\/[^/]+\/?$/.test(pathname);

  // Course catalogue dynamic routes - any single path segment (tagName)
  const isCourseCatalogueRoute =
    /^\/[^/]+\/?$/.test(pathname) &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/signup") &&
    !pathname.startsWith("/register") &&
    !pathname.startsWith("/privacy-policy") &&
    !pathname.startsWith("/terms-and-conditions") &&
    !pathname.startsWith("/referral") &&
    !pathname.startsWith("/live-class-guest") &&
    !pathname.startsWith("/study-library") &&
    !pathname.startsWith("/learner-invitation-response") &&
    !pathname.startsWith("/institute-selection") &&
    !pathname.startsWith("/delete-user") &&
    !pathname.startsWith("/change-password") &&
    !pathname.startsWith("/logout") &&
    !pathname.startsWith("/courses") &&
    !pathname.startsWith("/assessment") &&
    !pathname.startsWith("/dashboard") &&
    !pathname.startsWith("/homework") &&
    !pathname.startsWith("/learning-centre") &&
    !pathname.startsWith("/user-profile") &&
    !pathname.startsWith("/study-library") &&
    !pathname.startsWith("/Coursetile") &&
    !pathname.startsWith("/planning");

  // Course details dynamic routes - /{tagName}/{courseId}
  // Check if it's exactly two path segments and not a system route
  const pathSegments = pathname
    .split("/")
    .filter((segment) => segment.length > 0);
  const isCourseDetailsRoute =
    pathSegments.length === 2 &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/signup") &&
    !pathname.startsWith("/register") &&
    !pathname.startsWith("/privacy-policy") &&
    !pathname.startsWith("/terms-and-conditions") &&
    !pathname.startsWith("/referral") &&
    !pathname.startsWith("/live-class-guest") &&
    !pathname.startsWith("/study-library") &&
    !pathname.startsWith("/learner-invitation-response") &&
    !pathname.startsWith("/institute-selection") &&
    !pathname.startsWith("/delete-user") &&
    !pathname.startsWith("/change-password") &&
    !pathname.startsWith("/logout") &&
    !pathname.startsWith("/courses") &&
    !pathname.startsWith("/assessment") &&
    !pathname.startsWith("/dashboard") &&
    !pathname.startsWith("/homework") &&
    !pathname.startsWith("/learning-centre") &&
    !pathname.startsWith("/user-profile") &&
    !pathname.startsWith("/planning");

  const result =
    directMatch ||
    isDynamicLiveClassRoute ||
    isCourseCatalogueRoute ||
    isCourseDetailsRoute;

  console.log("[isPublicRoute] Debug:", {
    pathname,
    pathSegments,
    directMatch,
    isDynamicLiveClassRoute,
    isCourseCatalogueRoute,
    isCourseDetailsRoute,
    result,
  });

  return result;
};

const RootComponent = () => {
  const { setUpdateAvailable } = useUpdate();
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
      setPrimaryColor(
        themeCode ?? import.meta.env.VITE_DEFAULT_THEME_COLOR ?? "neutral"
      );
    }
  };

  useEffect(() => {
    // Apply tab branding from Preferences (tabText and tabIconFileId) with fallback title
    applyTabBranding(document.title);
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
    // Apply global ui-vibrant class based on override/settings and expose debug helpers
    const applyUiType = (t: StudentUIType) => {
      const root = document.documentElement;
      if (t === "vibrant") root.classList.add("ui-vibrant");
      else root.classList.remove("ui-vibrant");
    };

    const DEBUG_KEY = "DEBUG_UI_TYPE";
    try {
      const override = (localStorage.getItem(DEBUG_KEY) || "") as StudentUIType;
      if (override === "vibrant" || override === "default") {
        applyUiType(override);
      } else {
        getStudentDisplaySettings(false)
          .then((s) => applyUiType((s?.ui?.type as StudentUIType) || "default"))
          .catch(() => {
            /* ignore */
          });
      }
    } catch (e) {
      console.warn("Failed to read DEBUG_UI_TYPE", e);
    }

    // Debug console helpers
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      w.setStudentUIType = (type: StudentUIType) => {
        try {
          localStorage.setItem(DEBUG_KEY, type);
        } catch (e) {
          console.warn("setStudentUIType: failed to persist", e);
        }
        applyUiType(type);
      };
      w.getStudentUIType = () => {
        try {
          return localStorage.getItem(DEBUG_KEY) || "(using settings)";
        } catch (e) {
          console.warn("getStudentUIType: failed", e);
          return "(using settings)";
        }
      };
      w.clearStudentUIType = () => {
        try {
          localStorage.removeItem(DEBUG_KEY);
        } catch (e) {
          console.warn("clearStudentUIType: failed to clear", e);
        }
        getStudentDisplaySettings(false)
          .then((s) => applyUiType((s?.ui?.type as StudentUIType) || "default"))
          .catch(() => applyUiType("default"));
      };
    } catch (e) {
      console.warn("Failed to initialize UI debug helpers", e);
    }
    // We intentionally skip deps here to avoid re-running in StrictMode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global OAuth completion listener (storage/BroadcastChannel) to redirect parent
  useEffect(() => {
    // Skip in popup windows to avoid navigating inside the popup
    const isPopupWindow = (() => {
      try {
        if (window.opener && !window.opener.closed) return true;
      } catch {}
      try {
        if (window.name && window.name.toLowerCase() === "oauth_popup")
          return true;
      } catch {}
      try {
        const q = new URLSearchParams(window.location.search);
        if (q.get("popup") === "1") return true;
      } catch {}
      return false;
    })();

    if (isPopupWindow) {
      return;
    }

    let processed = false;

    const redirectWithTokens = (accessToken: string, refreshToken: string) => {
      if (processed) return;
      processed = true;
      try {
        const next = new URL("/login", window.location.origin);
        next.searchParams.set("accessToken", accessToken);
        next.searchParams.set("refreshToken", refreshToken);
        window.location.assign(next.toString());
      } catch (err) {
        void err;
      }
    };

    const storageHandler = (e: StorageEvent) => {
      if (!e) return;
      if (e.key === "OAUTH_RESULT" && e.newValue) {
        let parsed: {
          isModalLogin?: boolean;
          type?: string;
          data?: { accessToken?: string; refreshToken?: string };
        } | null = null;
        try {
          parsed = JSON.parse(e.newValue);
          // Only process page-level OAuth (isModalLogin === false), NOT modal OAuth
          if (
            parsed?.isModalLogin === false &&
            parsed?.type === "oauth_success" &&
            parsed?.data
          ) {
            const data: { accessToken?: string; refreshToken?: string } =
              parsed.data || {};
            const { accessToken, refreshToken } = data;
            if (accessToken && refreshToken) {
              redirectWithTokens(accessToken, refreshToken);
            }
          }
        } catch {
          // ignore
        } finally {
          // Clean up if it was a page-level login
          if (parsed?.isModalLogin === false) {
            try {
              localStorage.removeItem("OAUTH_RESULT");
            } catch (err) {
              void err;
            }
          }
        }
      }
    };

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("OAUTH_CHANNEL");
        bc.onmessage = (ev: MessageEvent) => {
          const msg = ev?.data;
          if (!msg || typeof msg !== "object") return;
          // Only process page-level OAuth (isModalLogin === false), NOT modal OAuth
          if (
            msg.isModalLogin === false &&
            msg.type === "oauth_success" &&
            msg.data
          ) {
            const data: { accessToken?: string; refreshToken?: string } =
              msg.data || {};
            const { accessToken, refreshToken } = data;
            if (accessToken && refreshToken) {
              redirectWithTokens(accessToken, refreshToken);
            }
          }
        };
      }
    } catch (err) {
      void err;
    }

    // Immediate check in case popup wrote before listeners attached
    try {
      const existing = localStorage.getItem("OAUTH_RESULT");
      if (existing) {
        const parsed = JSON.parse(existing);
        // Only process page-level OAuth (isModalLogin === false), NOT modal OAuth
        if (
          parsed?.isModalLogin === false &&
          parsed?.type === "oauth_success" &&
          parsed?.data
        ) {
          const data: { accessToken?: string; refreshToken?: string } =
            parsed.data || {};
          const { accessToken, refreshToken } = data;
          if (accessToken && refreshToken) {
            redirectWithTokens(accessToken, refreshToken);
          }
        }
        // Only remove if it was a page-level login
        if (parsed?.isModalLogin === false) {
          localStorage.removeItem("OAUTH_RESULT");
        }
      }
    } catch (err) {
      void err;
    }

    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("storage", storageHandler);
      try {
        if (bc) bc.close();
      } catch (err) {
        void err;
      }
    };
  }, []);

  return (
    <ChatbotProvider>
      <Outlet />
      <ChatbotPanel />
    </ChatbotProvider>
  );
};

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  beforeLoad: async ({ location }) => {
    console.log("[__root] Checking route:", location.pathname);
    console.log("[__root] Is public route:", isPublicRoute(location.pathname));

    // Global Auto-Login Support via URL Tokens
    const urlParams = new URL(window.location.href).searchParams;
    const urlAccessToken = urlParams.get("accessToken");
    const urlRefreshToken = urlParams.get("refreshToken");

    if (urlAccessToken && urlRefreshToken) {
      console.log("[__root] Detected tokens in URL, performing auto-login...");
      try {
        const { performFullAuthCycle } = await import(
          "@/services/auth-cycle-service"
        );
        // We'll need the instituteId. We can try to decode it from the token first.
        const { getTokenDecodedData } = await import(
          "@/lib/auth/sessionUtility"
        );
        const decoded = getTokenDecodedData(urlAccessToken);
        const instituteId = decoded?.authorities
          ? Object.keys(decoded.authorities)[0]
          : undefined;

        if (instituteId) {
          await performFullAuthCycle(
            { accessToken: urlAccessToken, refreshToken: urlRefreshToken },
            instituteId
          );

          // Remove tokens from URL and reload/redirect
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete("accessToken");
          newUrl.searchParams.delete("refreshToken");
          window.history.replaceState({}, document.title, newUrl.toString());

          console.log("[__root] Auto-login complete, reloading route...");
          // We can't easily "continue" here without a redirect or reload
          // For now, let's just let the rest of the logic proceed or throw a redirect
          throw redirect({
            to: location.pathname as never,
            search: Object.fromEntries(newUrl.searchParams) as any,
          });
        }
      } catch (error) {
        if (error instanceof Response) throw error;
        console.error("[__root] Auto-login via URL failed:", error);
      }
    }

    // Skip all logic for public routes - they should work without any redirects
    if (isPublicRoute(location.pathname)) {
      console.log("[__root] Route is public, skipping authentication check");
      return;
    }

    // Handle root path redirect
    if (location.pathname === "/") {
      try {
        // If already authenticated, redirect to settings.postLoginRedirectRoute
        const authenticated = await isAuthenticated();
        if (authenticated) {
          const settings = await getStudentDisplaySettings(true);
          await getChatbotSettings(true);
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
        if (
          error instanceof Response &&
          [301, 302, 303, 307, 308].includes(error.status)
        ) {
          console.log(
            "[__root] Caught redirect Response in root block. Rethrowing.",
            {
              status: error.status,
            }
          );
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
        await getChatbotSettings(true);
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
        if (
          error instanceof Response &&
          [301, 302, 303, 307, 308].includes(error.status)
        ) {
          console.log(
            "[__root] (protected) Caught redirect Response. Rethrowing.",
            {
              status: error.status,
            }
          );
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
