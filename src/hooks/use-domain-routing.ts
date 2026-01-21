import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Preferences } from "@capacitor/preferences";
import {
  resolveDomainRouting,
  getCurrentDomainInfo,
  DomainRoutingResponse,
  setCachedInstituteBranding,
} from "@/services/domain-routing";
import { useTheme } from "@/providers/theme/theme-provider";
import { useInstituteFeatureStore } from "@/stores/insititute-feature-store";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { applyTabBranding } from "@/utils/branding";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";

export interface DomainRoutingState {
  isLoading: boolean;
  instituteId: string | null;
  instituteName: string | null;
  instituteLogoFileId: string | null;
  instituteThemeCode: string | null;
  redirectPath: string;
  error: string | null;
  homeIconClickRoute: string | null;
  convertUsernamePasswordToLowercase: boolean | null;
}

// Global state to prevent multiple simultaneous domain routing calls
let isResolvingGlobally = false;
let globalDomainRoutingState: DomainRoutingState | null = null;

export const useDomainRouting = () => {
  const navigate = useNavigate();
  const { setPrimaryColor } = useTheme();
  const { setInstituteId } = useInstituteFeatureStore();

  const [state, setState] = useState<DomainRoutingState>(() => {
    // Initialize from cached global state if available to prevent flash on navigation
    if (globalDomainRoutingState && globalDomainRoutingState.instituteId) {
      return {
        ...globalDomainRoutingState,
        isLoading: false,
      };
    }
    // Default initial state
    return {
      isLoading: true,
      instituteId: null,
      instituteName: null,
      instituteLogoFileId: null,
      instituteThemeCode: null,
      redirectPath: "/login",
      error: null,
      homeIconClickRoute: null,
      convertUsernamePasswordToLowercase: null,
    };
  });

  const applyInstituteTheme = (themeCode: string | null) => {
    // Use the existing theme system - the themeCode from API should match the codes in theme.json
    if (themeCode) {
      setPrimaryColor(themeCode);
    } else {
      // If no theme code provided, use default primary theme
      setPrimaryColor("primary");
    }
  };

  const storeInstituteData = async (data: DomainRoutingResponse) => {
    try {
      // Store institute ID in preferences for future use
      await Preferences.set({
        key: "InstituteId",
        value: data.instituteId,
      });

      // Store institute details
      await Preferences.set({
        key: "InstituteDetails",
        value: JSON.stringify({
          id: data.instituteId,
          name: data.instituteName,
          logo_file_id: data.instituteLogoFileId,
          institute_logo_file_id: data.instituteLogoFileId,
          institute_theme_code: data.instituteThemeCode,
          home_icon_click_route: data.homeIconClickRoute ?? null,
          homeIconClickRoute: data.homeIconClickRoute ?? null,
          playStoreAppLink: data.playStoreAppLink ?? null,
          appStoreAppLink: data.appStoreAppLink ?? null,
          windowsAppLink: data.windowsAppLink ?? null,
          macAppLink: data.macAppLink ?? null,
          learnerPortalUrl: data.learnerPortalUrl ?? null,
          instructorPortalUrl: data.instructorPortalUrl ?? null,
        }),
      });

      // Store per-institute learner settings for quick access
      // Key: LEARNER_<instituteId>, Values: privacyPolicyUrl, termsAndConditionUrl
      const learnerKey = `LEARNER_${data.instituteId}`;
      const learnerSettings = {
        privacyPolicyUrl: data.privacyPolicyUrl || null,
        termsAndConditionUrl: data.termsAndConditionUrl || null,
        theme: data.theme || data.instituteThemeCode || null,
        fontFamily: data.fontFamily || null,
        allowSignup:
          typeof data.allowSignup === "boolean" ? data.allowSignup : null,
        tabText: data.tabText || null,
        tabIconFileId: data.tabIconFileId || null,
        allowGoogleAuth:
          typeof data.allowGoogleAuth === "boolean"
            ? data.allowGoogleAuth
            : null,
        allowGithubAuth:
          typeof data.allowGithubAuth === "boolean"
            ? data.allowGithubAuth
            : null,
        allowEmailOtpAuth:
          typeof data.allowEmailOtpAuth === "boolean"
            ? data.allowEmailOtpAuth
            : null,
        allowUsernamePasswordAuth:
          typeof data.allowUsernamePasswordAuth === "boolean"
            ? data.allowUsernamePasswordAuth
            : null,
        convertUsernamePasswordToLowercase:
          typeof data.convertUsernamePasswordToLowercase === "boolean"
            ? data.convertUsernamePasswordToLowercase
            : null,
      } as const;
      await Preferences.set({
        key: learnerKey,
        value: JSON.stringify(learnerSettings),
      });

      // Update tab title and favicon immediately after storing
      await applyTabBranding(document.title);

      // Mirror branding into localStorage for earliest-possible application on next load
      try {
        const tabIconUrl = data.tabIconFileId
          ? await getPublicUrlWithoutLogin(data.tabIconFileId)
          : null;
        const brandingMirror = {
          tabText: data.tabText || null,
          tabIconUrl,
        };
        localStorage.setItem("TabBranding", JSON.stringify(brandingMirror));
      } catch (error) {
        console.error("[Domain Routing] Error storing tab branding:", error);
      }

      setCachedInstituteBranding({
        instituteId: data.instituteId,
        instituteName: data.instituteName,
        instituteLogoFileId: data.instituteLogoFileId,
        instituteThemeCode: data.instituteThemeCode,
        homeIconClickRoute: data.homeIconClickRoute ?? null,
      });

      // Update global state
      setInstituteId(data.instituteId);
    } catch (error) {
      console.error("[Domain Routing] Error storing institute data:", error);
    }
  };

  const getFallbackInstituteId = async (): Promise<string | null> => {
    try {
      // Try to get institute ID from localStorage (current logic)
      const { value } = await Preferences.get({ key: "InstituteId" });
      if (!isNullOrEmptyOrUndefined(value)) {
        return value;
      }

      // Try to get from InstituteDetails
      const instituteDetails = await Preferences.get({
        key: "InstituteDetails",
      });
      if (!isNullOrEmptyOrUndefined(instituteDetails.value)) {
        try {
          const parsed = JSON.parse(instituteDetails.value);
          if (parsed.id) {
            return parsed.id;
          }
        } catch (e) {
          console.error("[Domain Routing] Error parsing institute details:", e);
        }
      }

      return null;
    } catch (error) {
      console.error(
        "[Domain Routing] Error getting fallback institute ID:",
        error
      );
      return null;
    }
  };

  const resolveRouting = async () => {
    // If already resolving globally, use the cached result
    if (isResolvingGlobally && globalDomainRoutingState) {
      setState(globalDomainRoutingState);
      return;
    }

    // If we already have a cached result, use it
    if (globalDomainRoutingState && globalDomainRoutingState.instituteId) {
      setState(globalDomainRoutingState);
      return;
    }

    isResolvingGlobally = true;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const { domain, subdomain } = await getCurrentDomainInfo();

      // Use actual domain and subdomain (or "*" if no subdomain)
      const testSubdomain = subdomain || "*";
      const testDomain = domain;

      // Resolving with domain: ${testDomain} subdomain: ${testSubdomain}

      // Try API first
      const apiResult = await resolveDomainRouting(testDomain, testSubdomain);

      if (apiResult) {
        // API returned valid institute data
        // API resolved institute successfully

        await storeInstituteData(apiResult);
        applyInstituteTheme(apiResult.instituteThemeCode);

        const newState = {
          isLoading: false,
          instituteId: apiResult.instituteId,
          instituteName: apiResult.instituteName,
          instituteLogoFileId: apiResult.instituteLogoFileId,
          instituteThemeCode: apiResult.instituteThemeCode,
          redirectPath: apiResult.redirect || "/login",
          error: null,
          homeIconClickRoute: apiResult.homeIconClickRoute ?? null,
          convertUsernamePasswordToLowercase: apiResult.convertUsernamePasswordToLowercase ?? null,
        };

        // Cache the result globally
        globalDomainRoutingState = newState;
        isResolvingGlobally = false;
        setState(newState);

        return;
      }

      // API returned 404, trying fallback
      const fallbackInstituteId = await getFallbackInstituteId();

      if (fallbackInstituteId) {
        // Using fallback institute ID
        const newState = {
          isLoading: false,
          instituteId: fallbackInstituteId,
          instituteName: null,
          instituteLogoFileId: null,
          instituteThemeCode: null,
          redirectPath: "/login",
          error: null,
          homeIconClickRoute: null,
          convertUsernamePasswordToLowercase: null,
        };

        globalDomainRoutingState = newState;
        isResolvingGlobally = false;
        setState(newState);
        return;
      }

      // No institute found anywhere
      const isInvitationRoute = window.location.pathname.startsWith("/learner-invitation-response");
      const newState = {
        isLoading: false,
        instituteId: null,
        instituteName: null,
        instituteLogoFileId: null,
        instituteThemeCode: null,
        // Stay on page for invitation route; otherwise fall back to /login
        redirectPath: isInvitationRoute ? "" : "/login",
        error: null,
        homeIconClickRoute: null,
        convertUsernamePasswordToLowercase: null,
      };

      globalDomainRoutingState = newState;
      isResolvingGlobally = false;
      setState(newState);
    } catch (error: unknown) {
      console.error("[Domain Routing] Error in resolveRouting:", error);

      // On API error, try fallback
      try {
        const fallbackInstituteId = await getFallbackInstituteId();

        if (fallbackInstituteId) {
          // Using fallback after API error
          const newState = {
            isLoading: false,
            instituteId: fallbackInstituteId,
            instituteName: null,
            instituteLogoFileId: null,
            instituteThemeCode: null,
            redirectPath: "/login",
            error: null,
            homeIconClickRoute: null,
            convertUsernamePasswordToLowercase: null,
          };

          globalDomainRoutingState = newState;
          isResolvingGlobally = false;
          setState(newState);
          return;
        }
      } catch (fallbackError) {
        console.error("[Domain Routing] Fallback also failed:", fallbackError);
      }

      // All fallbacks failed
      const isInvitationRoute = window.location.pathname.startsWith("/learner-invitation-response");
      const newState = {
        isLoading: false,
        instituteId: null,
        instituteName: null,
        instituteLogoFileId: null,
        instituteThemeCode: null,
        // Stay on page for invitation route; otherwise fall back to /login
        redirectPath: isInvitationRoute ? "" : "/login",
        error: error instanceof Error ? error.message : "Unknown error",
        homeIconClickRoute: null,
        convertUsernamePasswordToLowercase: null,
      };

      globalDomainRoutingState = newState;
      isResolvingGlobally = false;
      setState(newState);
    }
  };

  const redirectToResolvedPath = () => {
    if (state.redirectPath) {
      // Redirecting to resolved path: ${state.redirectPath}
      navigate({ to: state.redirectPath as never });
    } else if (state.instituteId) {
      // Don't automatically redirect to courses if we're on a public route or course details page
      const currentPath = window.location.pathname;
      const publicRoutes = [
        "/login",
        "/signup",
        "/register",
        "/privacy-policy",
        "/terms-and-conditions",
        "/learner-invitation-response",
        "/un",
      ];
      const isOnPublicRoute = publicRoutes.some((route) =>
        currentPath.startsWith(route)
      );

      // Don't redirect if we're on course details page
      const isOnCourseDetailsPage = currentPath.startsWith(
        "/courses/course-details"
      ) || /^\/[^/]+\/[^/]+\/?$/.test(currentPath);

      // Don't redirect if we're on live-class dynamic route
      const isOnLiveClassDynamicRoute =
        /^\/study-library\/live-class\/[^/]+\/?$/.test(currentPath);

      if (
        isOnPublicRoute ||
        isOnCourseDetailsPage ||
        isOnLiveClassDynamicRoute
      ) {
        return;
      }

      // Redirecting to courses catalog for institute
      navigate({ to: "/courses" });
    } else {
      // Redirecting to default login
      navigate({ to: "/login" });
    }
  };

  useEffect(() => {
    // Only resolve routing if we haven't already resolved it or if we don't have institute data
    if (!state.instituteId && state.isLoading) {
      resolveRouting();
    }
  }, []);

  // Handle redirect when state changes
  useEffect(() => {
    if (!state.isLoading && state.redirectPath) {
      // State updated, redirecting to: ${state.redirectPath}

      // Don't redirect if we're on public routes or course details page
      const currentPath = window.location.pathname;
      const publicRoutes = [
        "/login",
        "/signup",
        "/register",
        "/privacy-policy",
        "/terms-and-conditions",
        "/learner-invitation-response",
        "/un",
      ];
      const isOnPublicRoute = publicRoutes.some((route) =>
        currentPath.startsWith(route)
      );

      // Don't redirect if we're on course details page
      const isOnCourseDetailsPage = currentPath.startsWith(
        "/courses/course-details"
      ) || /^\/[^/]+\/[^/]+\/?$/.test(currentPath);

      // Don't redirect if we're on live-class dynamic route
      const isOnLiveClassDynamicRoute =
        /^\/study-library\/live-class\/[^/]+\/?$/.test(currentPath);

      if (
        isOnPublicRoute ||
        isOnCourseDetailsPage ||
        isOnLiveClassDynamicRoute
      ) {
        return;
      }

      // Only redirect if we're not on the root route (to avoid conflicts with root route logic)
      // and not on a public route like /{tagName}
      const currentPathForRedirect = window.location.pathname;
      const isPublicRouteForRedirect = /^\/[^/]+\/?$/.test(currentPathForRedirect) &&
        !currentPathForRedirect.startsWith('/login') &&
        !currentPathForRedirect.startsWith('/signup') &&
        !currentPathForRedirect.startsWith('/register') &&
        !currentPathForRedirect.startsWith('/privacy-policy') &&
        !currentPathForRedirect.startsWith('/terms-and-conditions') &&
        !currentPathForRedirect.startsWith('/referral') &&
        !currentPathForRedirect.startsWith('/live-class-guest') &&
        !currentPathForRedirect.startsWith('/study-library') &&
        !currentPathForRedirect.startsWith('/learner-invitation-response') &&
        !currentPathForRedirect.startsWith('/institute-selection') &&
        !currentPathForRedirect.startsWith('/delete-user') &&
        !currentPathForRedirect.startsWith('/change-password') &&
        !currentPathForRedirect.startsWith('/logout') &&
        !currentPathForRedirect.startsWith('/un') &&
        !currentPathForRedirect.startsWith('/courses') &&
        !currentPathForRedirect.startsWith('/assessment') &&
        !currentPathForRedirect.startsWith('/dashboard') &&
        !currentPathForRedirect.startsWith('/homework') &&
        !currentPathForRedirect.startsWith('/learning-centre') &&
        !currentPathForRedirect.startsWith('/user-profile') &&
        !currentPathForRedirect.startsWith('/Coursetile');

      if (window.location.pathname !== "/" && !isPublicRouteForRedirect) {
        // Executing redirect to: ${state.redirectPath}
        redirectToResolvedPath();
      } else if (isPublicRouteForRedirect) {
        console.log("[Domain Routing] On public route, skipping redirect to:", state.redirectPath);
      }
    }
  }, [state.isLoading, state.redirectPath]);

  return {
    ...state,
    resolveRouting,
    redirectToResolvedPath,
  };
};
