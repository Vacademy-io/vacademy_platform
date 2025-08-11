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

export const Route = createFileRoute("/signup/oauth/modal-learner")({
  component: ModalOAuthSignupRedirectHandler,
});

function ModalOAuthSignupRedirectHandler() {
  const navigate = useNavigate();
  const { setPrimaryColor } = useTheme();

  useEffect(() => {
    handleModalOAuthSignupCallback(navigate, setPrimaryColor);
  }, [navigate, setPrimaryColor]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <DashboardLoader />
    </div>
  );
}

const handleModalOAuthSignupCallback = async (
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
  let type = "";
  let courseId = "";
  let instituteId = "";
  
  if (state) {
    try {
      // Check if state needs URL decoding first
      let decodedState;
      try {
        decodedState = atob(state);
      } catch {
        const urlDecodedState = decodeURIComponent(state);
        decodedState = atob(urlDecodedState);
      }
      
      const stateObj = JSON.parse(decodedState);
      
      redirectTo = stateObj.redirectTo || "/dashboard";
      currentUrl = stateObj.currentUrl || "";
      type = stateObj.type || "";
      courseId = stateObj.courseId || "";
      instituteId = stateObj.institute_id || "";
    } catch (parseError) {
      console.error("Error parsing state:", parseError);
    }
  }

  if (error) {
    toast.error("We couldn't create an account with these details. Please try again.");
    
    // For modal signup, redirect back to the original page
    window.history.back();
    return;
  }

  if (accessToken && refreshToken) {
    try {
      await setToStorage("accessToken", accessToken);
      await setToStorage("refreshToken", refreshToken);
      await setTokenInStorage(TokenKey.accessToken, accessToken);
      await setTokenInStorage(TokenKey.refreshToken, refreshToken);

      await handleModalSuccessfulSignup(
        accessToken,
        refreshToken,
        navigate,
        setPrimaryColor,
        redirectTo,
        currentUrl,
        type,
        courseId,
        instituteId
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

const handleModalSuccessfulSignup = async (
  accessToken: string,
  refreshToken: string,
  navigate: ReturnType<typeof useNavigate>,
  setPrimaryColor?: (color: string) => void,
  redirectTo?: string,
  currentUrl?: string,
  type?: string,
  courseId?: string,
  instituteId?: string
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

    // For modal signup, we expect the user to be enrolled in the specified institute
    if (instituteId && authorityKeys.includes(instituteId)) {
      // User is enrolled in the specified institute
      const details = await fetchAndStoreInstituteDetails(instituteId, userId);
      if (setPrimaryColor) {
        setPrimaryColor(details?.institute_theme_code ?? "#E67E22");
      }
      await fetchAndStoreStudentDetails(instituteId, userId);

      // Determine redirect URL based on type and courseId
      let redirectUrl = "/dashboard";
      
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
      } else if (currentUrl && currentUrl.includes("/courses")) {
        redirectUrl = "/study-library/courses";
      }
      
      // For modal signup, open in new tab and close modal
      if (type === "courseDetailsPage" || (type && type !== "mainSignup") || 
          (currentUrl && (currentUrl.includes("/courses") || currentUrl.includes("/course-details")))) {
        window.open(redirectUrl, '_blank');
      }
      
      // Close the modal by redirecting back
      window.history.back();
    } else {
      // User is not enrolled in the specified institute
      toast.error("Failed to enroll in the specified institute.");
      window.history.back();
    }
  } catch (error) {
    console.error("Error in modal successful signup:", error);
    toast.error("Failed to process user data.");
    window.history.back();
  }
};
