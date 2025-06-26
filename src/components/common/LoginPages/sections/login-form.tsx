import { useEffect, useState } from "react";
// import { SplashScreen } from "@/components/common/LoginPages/layout/splash-container";
// import { useAnimationStore } from "@/stores/login/animationStore";

// import { MyButton } from "@/components/design-system/button";
// import { loginSchema } from "@/schemas/login/login";
// import { z } from "zod";
import { Heading } from "@/components/common/LoginPages/ui/heading";
import { TokenKey } from "@/constants/auth/tokens";
import { useNavigate } from "@tanstack/react-router";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import {
  getTokenDecodedData,
  getTokenFromStorage,
  handleSSOLogin,
  setTokenInStorage,
} from "@/lib/auth/sessionUtility";
import { EmailLogin } from "./EmailOtpForm";
import { UsernameLogin } from "./UsernamePasswordForm";
import { Preferences } from "@capacitor/preferences";
import { FcGoogle } from "react-icons/fc";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { LOGIN_URL_GOOGLE_GITHUB } from "@/constants/urls";
import { toast } from "sonner";
import { useTheme } from "@/providers/theme/theme-provider";
import { fetchAndStoreInstituteDetails } from "@/services/fetchAndStoreInstituteDetails";
import { fetchAndStoreStudentDetails } from "@/services/studentDetails";
import ClipLoader from "react-spinners/ClipLoader";

export const getFromStorage = async (key: string) => {
  const result = await Preferences.get({ key });
  return result.value;
};

export const setToStorage = async (key: string, value: string) => {
  await Preferences.set({ key, value });
};

export function LoginForm() {
  const navigate = useNavigate();
  const { setPrimaryColor, getPrimaryColorCode } = useTheme();

  const urlParams = new URLSearchParams(window.location.search);
  const [isSSOLoading, setIsSSOLoading] = useState(false);
  const isPublic = urlParams.get("isPublicAssessment");
  const redirect = urlParams.get("redirect");
  const [isEmailLogin, setIsEmailLogin] = useState(
    isPublic === "true" ? true : false
  );

  // Handle OAuth callback
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const accessToken = urlParams.get("accessToken");
      const refreshToken = urlParams.get("refreshToken");
      const error = urlParams.get("error");

      if (error) {
        console.error("OAuth error:", error);
        toast.error("Authentication failed. Please try again.");
        return;
      }
      if (accessToken && refreshToken) {
        try {
          // Store tokens in Capacitor Preferences with specific keys
          await setToStorage("accessToken", accessToken);
          await setToStorage("refreshToken", refreshToken);

          // Also store in the regular token storage for compatibility
          await setTokenInStorage(TokenKey.accessToken, accessToken);
          await setTokenInStorage(TokenKey.refreshToken, refreshToken);

          console.log("Tokens stored successfully");

          // Execute the onSuccess logic
          await handleSuccessfulLogin(accessToken, redirect);
        } catch (error) {
          console.error("Error storing tokens:", error);
          toast.error("Failed to store authentication tokens");
        }
      }
    };

    handleOAuthCallback();
  }, []);

  useEffect(() => {
    // Handle SSO login from URL parameters
    const ssoLoginSuccess = handleSSOLogin();

    if (ssoLoginSuccess) {
      setIsSSOLoading(true);
      return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get("accessToken");
    const refreshToken = urlParams.get("refreshToken");
    if (
      isNullOrEmptyOrUndefined(accessToken) ||
      isNullOrEmptyOrUndefined(refreshToken)
    ) {
      return;
    }

    if (accessToken && refreshToken) {
      console.log("accessToken", accessToken);
      setTokenInStorage(TokenKey.accessToken, accessToken);
      setTokenInStorage(TokenKey.refreshToken, refreshToken);
      handleSuccessfulLogin(accessToken, redirect);
    }
  }, [navigate]);

  // Handle successful login logic
  const handleSuccessfulLogin = async (
    accessToken: string,
    redirect?: string | null
  ) => {
    try {
      // Decode token to get user data
      const decodedData = await getTokenDecodedData(accessToken);

      // Check authorities in decoded data
      const authorities = decodedData?.authorities;
      const userId = decodedData?.user;
      const authorityKeys = authorities ? Object.keys(authorities) : [];

      if (authorityKeys.length > 1) {
        // Redirect to InstituteSelection if multiple authorities are found
        navigate({
          to: "/institute-selection",
          search: { redirect: redirect || "/dashboard/" },
        });
        setIsSSOLoading(false);
      } else {
        // Get the single institute ID
        const instituteId = authorities
          ? Object.keys(authorities)[0]
          : undefined;

        if (instituteId && userId) {
          try {
            // Fetch and store institute details
            const details = await fetchAndStoreInstituteDetails(
              instituteId,
              userId
            );
            console.log("Institute color:", details?.institute_theme_code);
            setPrimaryColor(details?.institute_theme_code ?? "#E67E22");
          } catch (error) {
            console.error("Error fetching institute details:", error);
            toast.error("Failed to fetch institute details");
          }

          try {
            // Fetch and store student details
            await fetchAndStoreStudentDetails(instituteId, userId);
          } catch (error) {
            console.error("Error fetching student details:", error);
            toast.error("Failed to fetch student details");
          }
        } else {
          console.error("Institute ID or User ID is undefined");
          toast.error("Invalid user data received");
        }

        // Redirect to SessionSelectionPage
        navigate({
          to: "/SessionSelectionPage",
          search: { redirect: redirect || "/dashboard" },
        });
      }
    } catch (error) {
      console.error("Error processing decoded data:", error);
      toast.error("Failed to process user data");
    }
  };

  // Check for existing authentication
  useEffect(() => {
    const redirect = async () => {
      const token = await getTokenFromStorage(TokenKey.accessToken);
      const studentDetails = await getFromStorage("StudentDetails");
      const instituteDetails = await getFromStorage("InstituteDetails");

      if (
        !isNullOrEmptyOrUndefined(token) &&
        !isNullOrEmptyOrUndefined(studentDetails) &&
        !isNullOrEmptyOrUndefined(instituteDetails)
      ) {
        navigate({ to: "/dashboard" });
      }
    };

    redirect();
  }, [navigate]);

  // OAuth login handler
  const handleOAuthLogin = (provider: "google" | "github") => {
    try {
      // Create state object with redirect information
      const stateObj = {
        // from: "http://localhost:8100/login",
        from: "https://learner.vacademy.io/login",
        account_type: "",
      };

      // Encode state as base64
      const base64State = btoa(JSON.stringify(stateObj));

      // Construct OAuth URL
      const loginUrl = `${LOGIN_URL_GOOGLE_GITHUB}/${provider}?state=${encodeURIComponent(base64State)}`;

      // Redirect to OAuth provider
      window.location.href = loginUrl;
    } catch (error) {
      console.error("Error initiating OAuth login:", error);
      toast.error("Failed to initiate login. Please try again.");
    }
  };

  if (isSSOLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center w-full">
        <ClipLoader size={40} color={getPrimaryColorCode()} />
        <p className="mt-4 text-lg">Getting your details...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-white flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-sm mx-auto">
        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200/60 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-slate-900 mb-2">Welcome back</h1>
            <p className="text-slate-600 text-sm">Sign in to continue your learning journey</p>
          </div>

          {/* OAuth Login Buttons */}
          <div className="space-y-3 mb-6">
            <button
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-200 rounded-lg bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={() => handleOAuthLogin("google")}
              type="button"
            >
              <FcGoogle className="size-5" />
              Continue with Google
            </button>
            <button
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-200 rounded-lg bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={() => handleOAuthLogin("github")}
              type="button"
            >
              <GitHubLogoIcon className="size-5" />
              Continue with GitHub
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-3 text-slate-500 font-medium">or</span>
            </div>
          </div>

          {/* Login Forms */}
          <div className="space-y-4">
            {isEmailLogin ? (
              <EmailLogin onSwitchToUsername={() => setIsEmailLogin(false)} />
            ) : (
              <UsernameLogin onSwitchToEmail={() => setIsEmailLogin(true)} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-slate-500">
            Secure login powered by modern encryption
          </p>
        </div>
      </div>
    </div>
  );
}
