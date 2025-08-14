import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Preferences } from "@capacitor/preferences";
import { resolveDomainRouting, getCurrentDomainInfo, DomainRoutingResponse } from "@/services/domain-routing";
import { useTheme } from "@/providers/theme/theme-provider";
import { useInstituteFeatureStore } from "@/stores/insititute-feature-store";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";

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
    console.log("[Domain Routing] Applying institute theme:", themeCode);
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

      // Update global state
      setInstituteId(data.instituteId);
      
      console.log("[Domain Routing] Stored institute data:", data);
    } catch (error) {
      console.error("[Domain Routing] Error storing institute data:", error);
    }
  };

  const getFallbackInstituteId = async (): Promise<string | null> => {
    try {
      // Try to get institute ID from localStorage (current logic)
      const { value } = await Preferences.get({ key: "InstituteId" });
      if (!isNullOrEmptyOrUndefined(value)) {
        console.log("[Domain Routing] Found fallback institute ID:", value);
        return value;
      }
      
      // Try to get from InstituteDetails
      const instituteDetails = await Preferences.get({ key: "InstituteDetails" });
      if (!isNullOrEmptyOrUndefined(instituteDetails.value)) {
        try {
          const parsed = JSON.parse(instituteDetails.value);
          if (parsed.id) {
            console.log("[Domain Routing] Found fallback institute ID from details:", parsed.id);
            return parsed.id;
          }
        } catch (e) {
          console.error("[Domain Routing] Error parsing institute details:", e);
        }
      }
      
      return null;
    } catch (error) {
      console.error("[Domain Routing] Error getting fallback institute ID:", error);
      return null;
    }
  };

  const resolveRouting = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { domain, subdomain } = getCurrentDomainInfo();
      
      // Use actual domain and subdomain (or "*" if no subdomain)
      const testSubdomain = subdomain || "*";
      const testDomain = domain;
      
      console.log("[Domain Routing] Resolving with domain:", testDomain, "subdomain:", testSubdomain);

      // Try API first
      const apiResult = await resolveDomainRouting(testDomain, testSubdomain);
      
      if (apiResult) {
        // API returned valid institute data
        console.log("[Domain Routing] API resolved institute:", apiResult);
        
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

      // API returned 404, try fallback
      console.log("[Domain Routing] API returned 404, trying fallback");
      const fallbackInstituteId = await getFallbackInstituteId();
      
      if (fallbackInstituteId) {
        console.log("[Domain Routing] Using fallback institute ID:", fallbackInstituteId);
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

      // No institute found anywhere, redirect to login
      console.log("[Domain Routing] No institute found, redirecting to login");
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
          console.log("[Domain Routing] Using fallback after API error:", fallbackInstituteId);
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
      console.log("[Domain Routing] Redirecting to resolved path:", state.redirectPath);
      navigate({ to: state.redirectPath as never });
    } else if (state.instituteId) {
      console.log("[Domain Routing] Redirecting to courses catalog for institute:", state.instituteId);
      navigate({ to: "/courses" });
    } else {
      console.log("[Domain Routing] Redirecting to default login");
      navigate({ to: "/login" });
    }
  };

  useEffect(() => {
    resolveRouting();
  }, []);

  // Handle redirect when state changes
  useEffect(() => {
    if (!state.isLoading && state.redirectPath) {
      console.log("[Domain Routing] State updated, redirecting to:", state.redirectPath);
      // Only redirect if we're not on the root route (to avoid conflicts with root route logic)
      if (window.location.pathname !== "/") {
        console.log("[Domain Routing] Executing redirect to:", state.redirectPath);
        redirectToResolvedPath();
      } else {
        console.log("[Domain Routing] Skipping redirect on root route to avoid conflicts");
      }
    }
  }, [state.isLoading, state.redirectPath]);

  return {
    ...state,
    resolveRouting,
    redirectToResolvedPath,
  };
};
