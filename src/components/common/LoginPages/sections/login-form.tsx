import { useEffect, useState } from "react";
import { Heading } from "@/components/common/LoginPages/ui/heading";
import { TokenKey } from "@/constants/auth/tokens";
import { useNavigate } from "@tanstack/react-router";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { EmailLogin } from "./EmailOtpForm";
import { UsernameLogin } from "./UsernamePasswordForm";
import { Preferences } from "@capacitor/preferences";
import { LOGIN_URL_GOOGLE_GITHUB } from "@/constants/urls";
import { FcGoogle } from "react-icons/fc";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";

// Assume these are defined elsewhere and correctly implemented
// import { getTokenDecodedData } from "@/lib/auth/jwtUtility"; // Example path
// import { fetchAndStoreInstituteDetails, fetchAndStoreStudentDetails } from "@/lib/dataFetching"; // Example path
// import { useDashboardStore } from "@/stores/dashboardStore"; // If useDashboardStore is still used

// Helper to set tokens in Capacitor Preferences
export const setTokenInStorage = async (key: string, value: string) => {
  await Preferences.set({ key, value });
};

// Helper to get tokens from Capacitor Preferences
export const getFromStorage = async (key: string) => {
  const result = await Preferences.get({ key });
  return result.value;
};

// Placeholder for your actual implementation of decoding the token
// This function should take an accessToken and return a decoded object
const getTokenDecodedData = async (token: string): Promise<any> => {
  // Implement your JWT decoding logic here
  // For example, using a library like 'jwt-decode'
  // import { jwtDecode } from 'jwt-decode';
  // return jwtDecode(token);
  console.warn(
    "getTokenDecodedData: Placeholder implementation. Replace with actual JWT decoding."
  );
  return Promise.resolve({
    authorities: {
      institute123: ["ROLE_STUDENT"],
      // "institute456": ["ROLE_STUDENT"] // Uncomment to test multiple authorities
    },
    user: "someUserId",
  });
};

// Placeholder for your actual implementation of fetching and storing institute details
const fetchAndStoreInstituteDetails = async (
  instituteId: string,
  userId: string
): Promise<any> => {
  console.warn("fetchAndStoreInstituteDetails: Placeholder implementation.");
  // Implement your API call to fetch institute details and store them
  await Preferences.set({
    key: "InstituteDetails",
    value: JSON.stringify({
      id: instituteId,
      name: "Vacademy Institute",
      institute_theme_code: "#1a73e8",
    }),
  });
  return Promise.resolve({ institute_theme_code: "#1a73e8" });
};

// Placeholder for your actual implementation of fetching and storing student details
const fetchAndStoreStudentDetails = async (
  instituteId: string,
  userId: string
): Promise<void> => {
  console.warn("fetchAndStoreStudentDetails: Placeholder implementation.");
  // Implement your API call to fetch student details and store them
  await Preferences.set({
    key: "StudentDetails",
    value: JSON.stringify({
      id: userId,
      name: "John Doe",
      instituteId: instituteId,
    }),
  });
  return Promise.resolve();
};

// Placeholder for setPrimaryColor (if it's not a global state setter)
const setPrimaryColor = (color: string) => {
  console.log("Setting primary color:", color);
  // Example: document.documentElement.style.setProperty('--primary-color', color);
};

// The handleOAuthLogin function now just redirects to the OAuth provider
export const handleOAuthLogin = (provider: "google" | "github") => {
  const stateObj = {
    from: "http://localhost:8100/", // This should be your Capacitor app's URL
    account_type: "Assess",
  };
  const base64State = btoa(JSON.stringify(stateObj));

  const loginUrl = `${LOGIN_URL_GOOGLE_GITHUB}/${provider}?state=${encodeURIComponent(base64State)}`;
  console.log("Redirecting to OAuth login URL:", loginUrl);
  toast.success(`Redirecting to ${loginUrl} login...`);
  console.log("Redirecting to OAuth login URL:", loginUrl);

  window.location.href = loginUrl;
};

export function LoginForm() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const isPublic = urlParams.get("isPublicAssessment");
  const [isEmailLogin, setIsEmailLogin] = useState(
    isPublic === "true" ? true : false
  );

  // This useEffect will run when the component mounts and
  // also check for tokens in the URL after an OAuth redirect.
  useEffect(() => {
    const processOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const accessToken = urlParams.get("access_token");
      const refreshToken = urlParams.get("refresh_token");

      // Check if tokens are present in the URL (from OAuth callback)
      if (accessToken && refreshToken) {
        console.log("Tokens found in URL (OAuth callback)");
        try {
          // Store tokens in Capacitor Storage
          await setTokenInStorage(TokenKey.accessToken, accessToken);
          await setTokenInStorage(TokenKey.refreshToken, refreshToken);

          // Remove tokens from URL to clean it up
          urlParams.delete("access_token");
          urlParams.delete("refresh_token");
          window.history.replaceState(
            {},
            document.title,
            `${window.location.pathname}${urlParams.toString() ? "?" + urlParams.toString() : ""}${window.location.hash}`
          );

          // Now proceed with the onSuccess logic
          await processTokensAndRedirect({ accessToken, refreshToken });
        } catch (error) {
          console.error("Error processing OAuth tokens:", error);
          // Handle error, e.g., show a toast message
        }
      } else {
        // If no tokens in URL, check local storage for existing session
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
      }
    };

    processOAuthCallback();
  }, []); // Empty dependency array means it runs once on mount

  // This function encapsulates the token processing logic from your onSuccess block
  const processTokensAndRedirect = async (response: {
    accessToken: string;
    refreshToken: string;
  }) => {
    try {
      // Decode token to get user data
      const decodedData = await getTokenDecodedData(response.accessToken);

      // Check authorities in decoded data
      const authorities = decodedData?.authorities;
      const userId = decodedData?.user;
      const authorityKeys = authorities ? Object.keys(authorities) : [];

      if (authorityKeys.length > 1) {
        // Redirect to InstituteSelection if multiple authorities are found
        navigate({
          to: "/institute-selection",
          search: { redirect: "/dashboard/" }, // Assuming redirect will be to dashboard after selection
        });
      } else {
        // Get the single institute ID
        const instituteId = authorities
          ? Object.keys(authorities)[0]
          : undefined;

        if (instituteId && userId) {
          try {
            const details = await fetchAndStoreInstituteDetails(
              instituteId,
              userId
            );
            console.log("Institute color:", details?.institute_theme_code);
            setPrimaryColor(details?.institute_theme_code ?? "#E67E22");
          } catch (error) {
            console.error("Error fetching institute details:", error);
          }
        } else {
          console.error("Institute ID or User ID is undefined");
        }

        if (instituteId && userId) {
          try {
            await fetchAndStoreStudentDetails(instituteId, userId);
          } catch (e) {
            console.error("Failed to fetch student details:", e);
            // toast.error("Failed to fetch details"); // Uncomment if you have toast configured
          }
        } else {
          console.error("Institute ID or User ID is undefined");
        }

        // Redirect to SessionSelectionPage
        navigate({
          to: "/SessionSelectionPage",
          search: { redirect: "/dashboard", isPublished: "true" },
        });
      }
    } catch (error) {
      console.error("Error processing decoded data:", error);
      // Handle error, e.g., show a toast message
    }
  };

  return (
    <div className="w-screen bg-white gap-4 md:gap-8 lg:gap-10 pt-14 lg:pt-20">
      <div className="flex w-full flex-col items-center justify-center gap-4 md:gap-8 lg:gap-12 px-4 md:px-8 lg:px-12">
        <Heading
          heading="Hello, Student!"
          subHeading="Ready to learn something new? Log in and continue your academic adventure!"
        />
        <div className="w-full max-w-md">
          {isEmailLogin ? (
            <EmailLogin onSwitchToUsername={() => setIsEmailLogin(false)} />
          ) : (
            <UsernameLogin onSwitchToEmail={() => setIsEmailLogin(true)} />
          )}
        </div>

        <div className="flex flex-col gap-3 w-full max-w-md">
          <button
            className="bg-background border border-gray-50 p-2 rounded-lg flex items-center w-full gap-2 flex-row justify-center mt-4 text-lg"
            onClick={() => {
              handleOAuthLogin("google");
            }}
          >
            <FcGoogle className="" />
            Log in with Google
          </button>

          <button
            className="bg-background border border-gray-50 p-2 rounded-lg flex items-center w-full gap-2 flex-row justify-center mt-4 text-lg"
            onClick={() => {
              handleOAuthLogin("github");
            }}
          >
            <GitHubLogoIcon className="" />
            Log in with GitHub
          </button>
        </div>
      </div>
    </div>
  );
}
