import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { setToStorage } from "@/components/common/auth/login/forms/page/login-form";
import {
  getTokenDecodedData,
  setTokenInStorage,
} from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { fetchAndStoreInstituteDetails } from "@/services/fetchAndStoreInstituteDetails";
import { fetchAndStoreStudentDetails } from "@/services/studentDetails";
import { useTheme } from "@/providers/theme/theme-provider";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { createFileRoute } from "@tanstack/react-router";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import { identifyUser } from "@/lib/analytics";

export const Route = createFileRoute("/login/oauth/learner")({
  component: OAuthRedirectHandler,
});

function OAuthRedirectHandler() {
  const navigate = useNavigate();
  const { setPrimaryColor } = useTheme();

  useEffect(() => {
    handleOAuthCallback(
      navigate,
      setPrimaryColor
    );
  }, [navigate, setPrimaryColor]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <DashboardLoader />
    </div>
  );
}

const handleOAuthCallback = async (
  navigate: ReturnType<typeof useNavigate>,
  setPrimaryColor: (color: string) => void
) => {
  const urlParams = new URLSearchParams(window.location.search);
  const accessToken = urlParams.get("accessToken");
  const refreshToken = urlParams.get("refreshToken");
  const error = urlParams.get("error");
  const state = urlParams.get("state");
   
  // Parse state to get redirect information
  let redirectTo = "/dashboard";
  let currentUrl = "";
   
  if (state) {
    try {
      // Use a more robust decoding approach
      const decodedState = decodeURIComponent(escape(atob(state)));
      const stateObj = JSON.parse(decodedState);
      redirectTo = stateObj.redirectTo || "/dashboard";
      currentUrl = stateObj.currentUrl || "";
    } catch {
      // Error parsing state - continue with default values
    }
  }

  if (error) {
    toast.error("We couldn't find an account with these details. Please create an account before logging in.");
    // Redirect to signup page with parameters instead of just signup page for failed OAuth
    const signupUrl = new URL(window.location.origin + "/signup");
    signupUrl.searchParams.set("fromOAuth", "true");
    
    navigate({ to: signupUrl.pathname + signupUrl.search });
    return;
  }

  if (accessToken && refreshToken) {
    try {
      await setToStorage("accessToken", accessToken);
      await setToStorage("refreshToken", refreshToken);
      await setTokenInStorage(TokenKey.accessToken, accessToken);
      await setTokenInStorage(TokenKey.refreshToken, refreshToken);

      await handleSuccessfulLogin(
        accessToken,
        refreshToken,
        navigate,
        setPrimaryColor,
        redirectTo,
        currentUrl
      );
    } catch {
      toast.error("Failed to store authentication tokens");
      // Redirect to signup page with parameters when token storage fails
      const signupUrl = new URL(window.location.origin + "/signup");
      signupUrl.searchParams.set("fromOAuth", "true");
      
      navigate({ to: signupUrl.pathname + signupUrl.search });
    }
  } else {
    toast.error("Missing tokens in redirect URL");
    // Redirect to signup page with parameters when tokens are missing
    const signupUrl = new URL(window.location.origin + "/signup");
    signupUrl.searchParams.set("fromOAuth", "true");
    
    navigate({ to: signupUrl.pathname + signupUrl.search });
  }
};

const handleSuccessfulLogin = async (
  accessToken: string,
  refreshToken: string,
  navigate: ReturnType<typeof useNavigate>,
  setPrimaryColor?: (color: string) => void,
  redirectTo?: string,
  currentUrl?: string
) => {
  try {
    const decodedData = getTokenDecodedData(accessToken);
    const authorities = decodedData?.authorities;
    const userId = decodedData?.user;

    // Identify user in analytics immediately after successful OAuth login
    if (userId) {
      try {
        identifyUser(userId, {
          username: decodedData?.username,
          email: decodedData?.email,
        });
      } catch {}
    }

    const authorityKeys = authorities ? Object.keys(authorities) : [];

    if (!userId || authorityKeys.length === 0) {
      toast.error("Invalid user or institute data.");
      return;
    }

    if (authorityKeys.length === 1) {
      const instituteId = authorityKeys[0];

      const details = await fetchAndStoreInstituteDetails(instituteId, userId);
      if (setPrimaryColor) {
        setPrimaryColor(details?.institute_theme_code ?? "#E67E22");
      }
      await fetchAndStoreStudentDetails(instituteId, userId);

      // Handle redirection for OAuth login
      // Since we're now handling OAuth in same tab, redirect to study-library page directly
      if (redirectTo && redirectTo !== "/dashboard" && currentUrl && 
          (currentUrl.includes("/courses") || currentUrl.includes("/course-details"))) {
        // Redirect in same tab instead of opening new tab
        window.location.href = redirectTo;
        return;
      }
      
      // Navigate using Student Display Settings post-login route (force refresh)
      try {
        const settings = await getStudentDisplaySettings(true);
        const redirectRoute = settings?.postLoginRedirectRoute || "/dashboard";

        console.group("[Post-Login Redirect | OAuth]");
        console.log("Fetched settings:", settings);
        console.log("Resolved redirectRoute:", redirectRoute);
        console.groupEnd();

        if (/^https?:\/\//.test(redirectRoute)) {
          window.location.assign(redirectRoute);
        } else {
          navigate({ to: redirectRoute as string });
        }
      } catch (e) {
        console.error("[Post-Login Redirect | OAuth] Falling back to /dashboard due to error:", e);
        navigate({ to: "/dashboard" });
      }
    } else {
      // For multiple institutes, use the existing logic
      navigate({
        to: "/institute-selection",
        search: { redirect: "/dashboard/" },
      });
    }
  } catch {
    toast.error("Failed to process user data.");
  }
};
 