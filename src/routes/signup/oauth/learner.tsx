import { useEffect, useState } from "react";
import { Preferences } from "@capacitor/preferences";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { getPublicUrl } from "@/services/upload_file";
import { Session } from "@/types/user/user-detail";
import { setToStorage } from "@/components/common/auth/login/sections/login-form";
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

export const Route = createFileRoute("/signup/oauth/learner")({
  component: OAuthSignupRedirectHandler,
});

function OAuthSignupRedirectHandler() {
  const navigate = useNavigate();
  const [showSessionPage, setShowSessionPage] = useState(false);
  const [redirectPath, setRedirectPath] = useState("/dashboard");
  const { setPrimaryColor } = useTheme();

  useEffect(() => {
    handleOAuthCallback(navigate, setPrimaryColor, setShowSessionPage, setRedirectPath);
  }, [navigate, setPrimaryColor]);

  if (showSessionPage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <InlineSessionSelectionPage redirect={redirectPath} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <DashboardLoader />
    </div>
  );
}

const handleOAuthCallback = async (
  navigate: ReturnType<typeof useNavigate>,
  setPrimaryColor: (color: string) => void,
  setShowSessionPage: (show: boolean) => void,
  setRedirectPath: (redirect: string) => void
) => {
  const urlParams = new URLSearchParams(window.location.search);
  const accessToken = urlParams.get("accessToken");
  const refreshToken = urlParams.get("refreshToken");
  const error = urlParams.get("error");
  const message = urlParams.get("message");
  const state = urlParams.get("state");
  
  // Parse state to get redirect information
  let redirectTo = "/dashboard";
  let currentUrl = "";
  let isModalSignup = false;
  let instituteId = "";
  if (state) {
    try {
      const stateObj = JSON.parse(atob(state));
      redirectTo = stateObj.redirectTo || "/dashboard";
      currentUrl = stateObj.currentUrl || "";
      isModalSignup = stateObj.isModalSignup || false;
      instituteId = stateObj.institute_id || "";
    } catch (error) {
      console.error("Error parsing state:", error);
    }
  }

  if (error) {
    toast.error(decodeURIComponent(message || "Authentication failed."));
    navigate({ to: "/login" });
    return;
  }

  if (accessToken && refreshToken) {
    try {
      await setToStorage("accessToken", accessToken);
      await setToStorage("refreshToken", refreshToken);
      await setTokenInStorage(TokenKey.accessToken, accessToken);
      await setTokenInStorage(TokenKey.refreshToken, refreshToken);

      await handleSuccessfulSignup(
        accessToken,
        navigate,
        setShowSessionPage,
        setRedirectPath,
        setPrimaryColor,
        redirectTo,
        currentUrl,
        isModalSignup,
        instituteId
      );
    } catch {
      toast.error("Failed to store authentication tokens");
      navigate({ to: "/login" });
    }
  } else {
    toast.error("Missing tokens in redirect URL");
    navigate({ to: "/login" });
  }
};

const handleSuccessfulSignup = async (
  accessToken: string,
  navigate: ReturnType<typeof useNavigate>,
  setShowSessionPage: (show: boolean) => void,
  setRedirectPath: (redirect: string) => void,
  setPrimaryColor?: (color: string) => void,
  redirectTo?: string,
  currentUrl?: string,
  isModalSignup?: boolean,
  instituteId?: string
) => {
  try {
    const decodedData = getTokenDecodedData(accessToken);
    const authorities = decodedData?.authorities;
    const userId = decodedData?.user;

    const authorityKeys = authorities ? Object.keys(authorities) : [];

    if (!userId || authorityKeys.length === 0) {
      toast.error("Invalid user or institute data.");
      return;
    }

    if (authorityKeys.length === 1) {
      const instituteIdFromAuth = authorityKeys[0];

      const details = await fetchAndStoreInstituteDetails(instituteIdFromAuth, userId);
      if (setPrimaryColor) {
        setPrimaryColor(details?.institute_theme_code ?? "#E67E22");
      }
      await fetchAndStoreStudentDetails(instituteIdFromAuth, userId);

      // For signup, determine redirect URL based on context
      let finalRedirectUrl = "/dashboard";
      
      if (redirectTo && redirectTo !== "/dashboard") {
        finalRedirectUrl = redirectTo;
      } else if (currentUrl && (currentUrl.includes("/courses") || currentUrl.includes("/course-details"))) {
        // If signup originated from course-related pages, redirect to study-library
        if (currentUrl.includes("/course-details")) {
          const urlParams = new URLSearchParams(window.location.search);
          const courseId = urlParams.get("courseId");
          if (courseId) {
            finalRedirectUrl = `/study-library/courses/course-details?courseId=${courseId}&selectedTab=ALL`;
          } else {
            finalRedirectUrl = "/study-library/courses";
          }
        } else {
          finalRedirectUrl = "/study-library/courses";
        }
      }

      // Open study-library page in new tab if signup originated from course-related pages
      if (finalRedirectUrl !== "/dashboard" && currentUrl && 
          (currentUrl.includes("/courses") || currentUrl.includes("/course-details"))) {
        window.open(finalRedirectUrl, '_blank');
      }
      
      // Only navigate to dashboard if this is NOT a modal signup (i.e., main signup page)
      if (!isModalSignup) {
        navigate({ to: finalRedirectUrl });
      }
    } else {
      navigate({
        to: "/institute-selection",
        search: { redirect: "/dashboard/" },
      });
    }
  } catch {
    toast.error("Failed to process user data.");
  }
};

function InlineSessionSelectionPage({ redirect }: { redirect: string }) {
  const [sessionList, setSessionList] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const sessions = await Preferences.get({ key: "sessions" });
        if (sessions.value) {
          const parsedSessions = JSON.parse(sessions.value);
          setSessionList(parsedSessions);
        }
      } catch (error) {
        console.error("Error fetching sessions:", error);
      }
    };

    fetchSessions();
  }, []);

  const handleSessionSelect = async (session: Session) => {
    setSelectedSession(session);
    setIsLoading(true);

    try {
      // Store selected session
      await Preferences.set({
        key: "selectedSession",
        value: JSON.stringify(session),
      });

      // Navigate to the redirect path
      navigate({ to: redirect });
    } catch (error) {
      console.error("Error selecting session:", error);
      toast.error("Failed to select session. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Select Your Session
        </h2>
        <p className="text-sm text-gray-600">
          Choose the session you want to access
        </p>
      </div>

      <div className="space-y-3">
        {sessionList.map((session) => (
          <button
            key={session.id}
            onClick={() => handleSessionSelect(session)}
            disabled={isLoading}
            className={`w-full p-4 text-left border rounded-lg transition-all duration-200 ${
              selectedSession?.id === session.id
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            } ${isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{session.name}</h3>
                <p className="text-sm text-gray-600">{session.institute_name}</p>
              </div>
              {selectedSession?.id === session.id && (
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-gray-600">Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
} 