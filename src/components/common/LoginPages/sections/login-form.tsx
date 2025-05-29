import { useEffect, useState } from "react";
import { Heading } from "@/components/common/LoginPages/ui/heading";
import { TokenKey } from "@/constants/auth/tokens";
import { useNavigate } from "@tanstack/react-router";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import {
  getTokenDecodedData,
  getTokenFromStorage,
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

// Capacitor Storage keys
const CapacitorStorage = {
  accessToken: "accessToken",
  refreshToken: "refreshToken",
};

export const getFromStorage = async (key: string) => {
  const result = await Preferences.get({ key });
  return result.value;
};

export const setToStorage = async (key: string, value: string) => {
  await Preferences.set({ key, value });
};

export function LoginForm() {
  const navigate = useNavigate();
  const { setPrimaryColor } = useTheme();

  const urlParams = new URLSearchParams(window.location.search);
  const isPublic = urlParams.get("isPublicAssessment");
  const redirect = urlParams.get("redirect");
  const [isEmailLogin, setIsEmailLogin] = useState(
    isPublic === "true" ? true : false
  );

  // Handle OAuth callback
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const accessToken = urlParams.get("access_token");
      const refreshToken = urlParams.get("refresh_token");
      const error = urlParams.get("error");

      if (error) {
        console.error("OAuth error:", error);
        toast.error("Authentication failed. Please try again.");
        return;
      }

      if (accessToken && refreshToken) {
        try {
          // Store tokens in Capacitor Preferences with specific keys
          await setToStorage(CapacitorStorage.accessToken, accessToken);
          await setToStorage(CapacitorStorage.refreshToken, refreshToken);

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

  return (
    <div className="w-screen bg-white gap-4 md:gap-8 lg:gap-10 pt-14 lg:pt-20">
      {/* Login Form Section */}
      <div className="flex w-full flex-col items-center justify-center gap-4 md:gap-8 lg:gap-12 px-4 md:px-8 lg:px-12">
        <Heading
          heading="Hello, Student!"
          subHeading="Ready to learn something new? Log in and continue your academic adventure!"
        />

        {/* Toggle Content */}
        <div className="w-full max-w-md">
          {isEmailLogin ? (
            <EmailLogin onSwitchToUsername={() => setIsEmailLogin(false)} />
          ) : (
            <UsernameLogin onSwitchToEmail={() => setIsEmailLogin(true)} />
          )}
        </div>

        {/* OAuth Login Buttons */}
        <div className="flex flex-col gap-3 w-full max-w-md">
          <button
            className="bg-background border border-gray-50 p-2 rounded-lg flex items-center w-full gap-2 flex-row justify-center mt-4 text-lg hover:bg-gray-50 transition-colors"
            onClick={() => handleOAuthLogin("google")}
          >
            <FcGoogle className="w-5 h-5" />
            Log in with Google
          </button>

          <button
            className="bg-background border border-gray-50 p-2 rounded-lg flex items-center w-full gap-2 flex-row justify-center mt-4 text-lg hover:bg-gray-50 transition-colors"
            onClick={() => handleOAuthLogin("github")}
          >
            <GitHubLogoIcon className="w-5 h-5" />
            Log in with GitHub
          </button>
        </div>
      </div>
    </div>
  );
}
