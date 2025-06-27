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

export const getFromStorage = async (key: string) => {
  const result = await Preferences.get({ key });
  return result.value;
};

interface LoginFormProps {
  variant?: 'page' | 'dialog' | 'compact';
  className?: string;
}

export const setToStorage = async (key: string, value: string) => {
  await Preferences.set({ key, value });
};

export function LoginForm({ variant = 'page', className = '' }: LoginFormProps) {
  const navigate = useNavigate();
  const { setPrimaryColor } = useTheme();

  const urlParams = new URLSearchParams(window.location.search);
  const isPublic = urlParams.get("isPublicAssessment");
  const redirect = urlParams.get("redirect");
  const [isEmailLogin, setIsEmailLogin] = useState(
    isPublic === "true" ? true : false
  );
 const baseClass =
  variant === 'dialog'
      ? 'fit'
      :'w-screen';
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

  console.log("isEmailLogin", isEmailLogin)

  return (
    variant === "dialog" ? (
<div className={`${variant==='dialog'?"flex items-center justify-center h-auto":"w-screen  gap-4 md:gap-8 lg:gap-10 pt-14 lg:pt-20"}`}>
    <div className={`${variant==='dialog'?"w-[40vw] max-w-sm h-auto rounded-xl shadow-lg  p-1 gap-2 flex flex-col":"flex w-full flex-col items-center justify-center gap-4 md:gap-8 lg:gap-12 px-4 md:px-8 lg:px-12"}`}>
    {/* Dialog Variant Content */}
    <Heading
      heading="Hello, Student!"
      subHeading="Log in to continue learning"
    />
    {/* OAuth Login Buttons */}
    <div className={`${variant==='dialog'?"flex flex-col w-full items-center gap-3":"flex w-full flex-col items-center justify-center gap-4 px-4 md:px-8 lg:px-12"}`}>
      <button
        className={`${variant==='dialog'?"flex w-full items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-100":"flex w-[300px] items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"}`}
        onClick={() => handleOAuthLogin("google")}
        type="button"
      >
        <FcGoogle className="size-5" />
        Continue with Google
      </button>
      <button
        className={`${variant==='dialog'?"flex w-full items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-100":"flex w-[300px] items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"}`}
        onClick={() => handleOAuthLogin("github")}
        type="button"
      >
        <GitHubLogoIcon className="size-5" />
        Continue with GitHub
      </button>

      <div className={`${variant==='dialog'?"relative w-full flex items-center justify-center mt-2 mb-1":"relative flex items-center justify-center"}`}>
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-neutral-300" />
        </div>
        <div className={`${variant==='dialog'?"px-2 text-xs":"px-4 text-sm"} relative bg-white  text-neutral-500`}>
          or continue with
        </div>
      </div>
    </div>

    {/* Email or Username Login */}
    <div className={`${variant==='dialog'?"":"max-w-md"}w-full`}>
      {isEmailLogin ? (
        <EmailLogin onSwitchToUsername={() => setIsEmailLogin(false)} />
      ) : (
        <UsernameLogin onSwitchToEmail={() => setIsEmailLogin(true)} variant="dialog"/>
      )}
    </div>
  </div>
  </div>
) : (
  // Original Full-Screen Variant
  <div className={`w-screen   gap-4 md:gap-8 lg:gap-10 pt-14 lg:pt-20`}>
    {/* Login Form Section */}
    <div className="flex w-full flex-col items-center justify-center gap-4 md:gap-8 lg:gap-12 px-4 md:px-8 lg:px-12">
      <Heading
        heading="Hello, Student!"
        subHeading="Ready to learn something new? Log in and continue your academic adventure!"
      />
      {/* OAuth Login Buttons */}
      <div className="flex w-full flex-col items-center justify-center gap-4 px-4 md:px-8 lg:px-12">
        <button
          className="flex w-[300px] items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"
          onClick={() => handleOAuthLogin("google")}
          type="button"
        >
          <FcGoogle className="size-5" />
          Continue with Google
        </button>
        <button
          className="flex w-[300px] items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"
          onClick={() => handleOAuthLogin("github")}
          type="button"
        >
          <GitHubLogoIcon className="size-5" />
          Continue with GitHub
        </button>

        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative bg-white px-4 text-sm text-neutral-500">
            or continue with
          </div>
        </div>
      </div>

      <div className="w-full max-w-md">
        {isEmailLogin ? (
          <EmailLogin onSwitchToUsername={() => setIsEmailLogin(false)} />
        ) : (
          <UsernameLogin onSwitchToEmail={() => setIsEmailLogin(true)} variant="" />
        )}
      </div>
    </div>
  </div>
)

  );
}
