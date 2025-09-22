import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Preferences } from "@capacitor/preferences";
import {
  resolveDomainRouting,
  getCurrentDomainInfo,
  DomainRoutingResponse,
} from "@/services/domain-routing";
import { useTheme } from "@/providers/theme/theme-provider";
import { useInstituteFeatureStore } from "@/stores/insititute-feature-store";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { applyTabBranding } from "@/utils/branding";
import { getPublicUrl } from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/excalidrawUtils";

export interface DomainRoutingState {
  isLoading: boolean;
  instituteId: string | null;
  instituteName: string | null;
  instituteLogoFileId: string | null;
  instituteThemeCode: string | null;
  redirectPath: string;
  error: string | null;
}

export const useDomainRouting = () => {
  const navigate = useNavigate();
  const { setPrimaryColor } = useTheme();
  const { setInstituteId } = useInstituteFeatureStore();

  const [state, setState] = useState<DomainRoutingState>({
    isLoading: true,
    instituteId: null,
    instituteName: null,
    instituteLogoFileId: null,
    instituteThemeCode: null,
    redirectPath: "/login",
    error: null,
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
          institute_theme_code: data.instituteThemeCode,
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
          ? await getPublicUrl(data.tabIconFileId)
          : null;
        const brandingMirror = {
          tabText: data.tabText || null,
          tabIconUrl,
        };
        localStorage.setItem("TabBranding", JSON.stringify(brandingMirror));
      } catch (error) {
        console.error("[Domain Routing] Error storing tab branding:", error);
      }

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

        setState({
          isLoading: false,
          instituteId: apiResult.instituteId,
          instituteName: apiResult.instituteName,
          instituteLogoFileId: apiResult.instituteLogoFileId,
          instituteThemeCode: apiResult.instituteThemeCode,
          redirectPath: apiResult.redirect || "/login",
          error: null,
        });

        return;
      }

      // API returned 404, trying fallback
      const fallbackInstituteId = await getFallbackInstituteId();

      if (fallbackInstituteId) {
        // Using fallback institute ID
        setState({
          isLoading: false,
          instituteId: fallbackInstituteId,
          instituteName: null,
          instituteLogoFileId: null,
          instituteThemeCode: null,
          redirectPath: "/login",
          error: null,
        });
        return;
      }

      // No institute found anywhere, redirecting to login
      setState({
        isLoading: false,
        instituteId: null,
        instituteName: null,
        instituteLogoFileId: null,
        instituteThemeCode: null,
        redirectPath: "/login",
        error: null,
      });
    } catch (error: unknown) {
      console.error("[Domain Routing] Error in resolveRouting:", error);

      // On API error, try fallback
      try {
        const fallbackInstituteId = await getFallbackInstituteId();

        if (fallbackInstituteId) {
          // Using fallback after API error
          setState({
            isLoading: false,
            instituteId: fallbackInstituteId,
            instituteName: null,
            instituteLogoFileId: null,
            instituteThemeCode: null,
            redirectPath: "/login",
            error: null,
          });
          return;
        }
      } catch (fallbackError) {
        console.error("[Domain Routing] Fallback also failed:", fallbackError);
      }

      // All fallbacks failed, redirect to login
      setState({
        isLoading: false,
        instituteId: null,
        instituteName: null,
        instituteLogoFileId: null,
        instituteThemeCode: null,
        redirectPath: "/login",
        error: error instanceof Error ? error.message : "Unknown error",
      });
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
      ];
      const isOnPublicRoute = publicRoutes.some((route) =>
        currentPath.startsWith(route)
      );

      // Don't redirect if we're on course details page
      const isOnCourseDetailsPage = currentPath.startsWith(
        "/courses/course-details"
      );

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
    resolveRouting();
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
      ];
      const isOnPublicRoute = publicRoutes.some((route) =>
        currentPath.startsWith(route)
      );

      // Don't redirect if we're on course details page
      const isOnCourseDetailsPage = currentPath.startsWith(
        "/courses/course-details"
      );

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
      if (window.location.pathname !== "/") {
        // Executing redirect to: ${state.redirectPath}
        redirectToResolvedPath();
      }
    }
  }, [state.isLoading, state.redirectPath]);

  return {
    ...state,
    resolveRouting,
    redirectToResolvedPath,
  };
};
