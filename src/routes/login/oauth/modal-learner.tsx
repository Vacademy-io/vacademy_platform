import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
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
import { ModalInstituteSelection } from "@/components/common/auth/login/sections/ModalInstituteSelection";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/login/oauth/modal-learner")({
  component: ModalOAuthRedirectHandler,
});

function ModalOAuthRedirectHandler() {
  const navigate = useNavigate();
  const { setPrimaryColor } = useTheme();
  const [showInstituteSelection, setShowInstituteSelection] = useState(false);
  const [oauthData, setOauthData] = useState<{
    accessToken: string;
    refreshToken: string;
    type?: string;
    courseId?: string;
    currentUrl?: string;
  } | null>(null);

  useEffect(() => {
    handleModalOAuthCallback(navigate, setPrimaryColor, setShowInstituteSelection, setOauthData);
  }, [navigate, setPrimaryColor]);

  // If showing institute selection, render the modal component
  if (showInstituteSelection && oauthData) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="w-full max-w-md mx-4">
          <ModalInstituteSelection
            accessToken={oauthData.accessToken}
            refreshToken={oauthData.refreshToken}
            type={oauthData.type}
            courseId={oauthData.courseId}
            currentUrl={oauthData.currentUrl}
            onInstituteSelected={() => {
              // Institute selection is completed, close the modal
              window.history.back();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <DashboardLoader />
    </div>
  );
}

const handleModalOAuthCallback = async (
  navigate: ReturnType<typeof useNavigate>,
  setPrimaryColor: (color: string) => void,
  setShowInstituteSelection: (show: boolean) => void,
  setOauthData: React.Dispatch<React.SetStateAction<{
    accessToken: string;
    refreshToken: string;
    type?: string;
    courseId?: string;
    currentUrl?: string;
  } | null>>
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
  let type = "";
  let courseId = "";
  if (state) {
    try {
      const stateObj = JSON.parse(atob(state));
      redirectTo = stateObj.redirectTo || "/dashboard";
      currentUrl = stateObj.currentUrl || "";
      type = stateObj.type || "";
      courseId = stateObj.courseId || "";
    } catch (parseError) {
      console.error("Error parsing state:", parseError);
    }
  }

  if (error) {
    toast.error(decodeURIComponent(message || "Authentication failed."));
    // For modal login, close the modal by going back
    window.history.back();
    return;
  }

  if (accessToken && refreshToken) {
    try {
      await setToStorage("accessToken", accessToken);
      await setToStorage("refreshToken", refreshToken);
      await setTokenInStorage(TokenKey.accessToken, accessToken);
      await setTokenInStorage(TokenKey.refreshToken, refreshToken);

      await handleModalSuccessfulLogin(
        accessToken,
        refreshToken,
        navigate,
        setPrimaryColor,
        redirectTo,
        currentUrl,
        type,
        courseId,
        setShowInstituteSelection,
        setOauthData
      );
    } catch {
      toast.error("Failed to store authentication tokens");
      window.history.back();
    }
  } else {
    toast.error("Missing tokens in redirect URL");
    window.history.back();
  }
};

const handleModalSuccessfulLogin = async (
  accessToken: string,
  refreshToken: string,
  navigate: ReturnType<typeof useNavigate>,
  setPrimaryColor?: (color: string) => void,
  redirectTo?: string,
  currentUrl?: string,
  type?: string,
  courseId?: string,
  setShowInstituteSelection?: (show: boolean) => void,
  setOauthData?: React.Dispatch<React.SetStateAction<{
    accessToken: string;
    refreshToken: string;
    type?: string;
    courseId?: string;
    currentUrl?: string;
  } | null>>
) => {
  try {
    const decodedData = getTokenDecodedData(accessToken);
    const authorities = decodedData?.authorities;
    const userId = decodedData?.user;

    const authorityKeys = authorities ? Object.keys(authorities) : [];

    if (!userId || authorityKeys.length === 0) {
      toast.error("Invalid user or institute data.");
      window.history.back();
      return;
    }

    if (authorityKeys.length > 1) {
      // For multiple institutes, show modal institute selection
      if (setShowInstituteSelection && setOauthData) {
        setOauthData({
          accessToken,
          refreshToken,
          type,
          courseId,
          currentUrl,
        });
        setShowInstituteSelection(true);
      } else {
        // Fallback to main institute selection page
        navigate({
          to: "/institute-selection",
          search: { redirect: "/dashboard/" },
        });
      }
    } else if (authorityKeys.length === 1) {
      const instituteId = authorityKeys[0];

      const details = await fetchAndStoreInstituteDetails(instituteId, userId);
      if (setPrimaryColor) {
        setPrimaryColor(details?.institute_theme_code ?? "#E67E22");
      }
      await fetchAndStoreStudentDetails(instituteId, userId);

      // For modal OAuth login, always redirect to study library based on type and courseId
      let redirectUrl = "/study-library/courses"; // Default to study library courses
      
      if (type === "courseDetailsPage" && courseId) {
        redirectUrl = `/study-library/courses/course-details?courseId=${courseId}&selectedTab=ALL`;
      } else if (type === "courseDetailsPage") {
        redirectUrl = "/study-library/courses";
      } else if (currentUrl && currentUrl.includes("/courses/course-details")) {
        // Extract courseId from current URL
        const urlParams = new URLSearchParams(currentUrl.split('?')[1] || '');
        const extractedCourseId = urlParams.get('courseId');
        if (extractedCourseId) {
          redirectUrl = `/study-library/courses/course-details?courseId=${extractedCourseId}&selectedTab=ALL`;
        } else {
          redirectUrl = "/study-library/courses";
        }
      }
      
      // Open the redirect URL in new tab for modal login
        window.open(redirectUrl, '_blank');
      
      // Close the modal
      window.history.back();
    }
  } catch {
    toast.error("Failed to process user data.");
    window.history.back();
  }
}; 