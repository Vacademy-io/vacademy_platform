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

export const Route = createFileRoute("/login/oauth/modal-learner")({
  component: ModalOAuthRedirectHandler,
});

function ModalOAuthRedirectHandler() {
  const navigate = useNavigate();
  const { setPrimaryColor } = useTheme();

  useEffect(() => {
    handleModalOAuthCallback(navigate, setPrimaryColor);
  }, [navigate, setPrimaryColor]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <DashboardLoader />
    </div>
  );
}

const handleModalOAuthCallback = async (
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
      instituteId = stateObj.instituteId || "";
    } catch (parseError) {
      console.error("Error parsing state:", parseError);
    }
  }

  // Try to get data from sessionStorage first (new approach)
  const storedModalData = sessionStorage.getItem('modal_oauth_data');
  
  if (storedModalData) {
    try {
      const modalData = JSON.parse(storedModalData);
      
      // Use data from sessionStorage
      redirectTo = modalData.redirectTo || redirectTo;
      currentUrl = modalData.currentUrl || currentUrl;
      type = modalData.type || type;
      courseId = modalData.courseId || courseId;
      instituteId = modalData.instituteId || instituteId;
    } catch (parseError) {
      console.error("Error parsing stored modal data:", parseError);
    }
  }

  if (error) {
    toast.error("We couldn't find an account with these details. Please create an account before logging in.");
    
    // For modal login, close this tab and send message to parent tab to open signup modal
    try {
      // Try to send message to parent tab to open signup modal
      if (window.opener && !window.opener.closed) {
        // Send message to parent tab with signup parameters
        const signupData = {
          action: 'openSignupModal',
          type: type || '',
          courseId: courseId || '',
          instituteId: instituteId || '',
          fromOAuth: true
        };
        
        window.opener.postMessage(signupData, window.location.origin);
        
        // Close this tab after sending message
        setTimeout(() => {
          window.close();
        }, 200);
      } else {
        // Fallback: redirect to signup page with parameters
        const signupUrl = new URL(window.location.origin + "/signup");
        signupUrl.searchParams.set("openModal", "true");
        signupUrl.searchParams.set("type", type || "");
        signupUrl.searchParams.set("courseId", courseId || "");
        signupUrl.searchParams.set("instituteId", instituteId || "");
        signupUrl.searchParams.set("fromOAuth", "true");
        
        window.location.href = signupUrl.toString();
      }
    } catch (error) {
      console.error("Error communicating with parent tab:", error);
      // Fallback: redirect to signup page
      const signupUrl = new URL(window.location.origin + "/signup");
      signupUrl.searchParams.set("openModal", "true");
      signupUrl.searchParams.set("type", type || "");
      signupUrl.searchParams.set("courseId", courseId || "");
      signupUrl.searchParams.set("instituteId", instituteId || "");
      signupUrl.searchParams.set("fromOAuth", "true");
      
      window.location.href = signupUrl.toString();
    }
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

const handleModalSuccessfulLogin = async (
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

    // If instituteId is provided, check if user is enrolled in that institute
    if (instituteId) {
      if (authorityKeys.includes(instituteId)) {
        // User is enrolled in the specified institute
        const details = await fetchAndStoreInstituteDetails(instituteId, userId);
        if (setPrimaryColor) {
          setPrimaryColor(details?.institute_theme_code ?? "#E67E22");
        }
      await fetchAndStoreStudentDetails(instituteId, userId);

        // Use the redirectTo from sessionStorage, fallback to calculated URL if not provided
        let redirectUrl = redirectTo || "/study-library/courses";
      
        // Only recalculate if redirectTo is not provided
        if (!redirectTo) {
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
        }
        
        // Since OAuth flow happened in new tab, simply redirect to study library
        window.location.href = redirectUrl;
      } else {
        // User is not enrolled in the specified institute
        toast.error("You are not enrolled in this institute.");
        window.history.back();
      }
    } else {
      // No instituteId provided, use the first available institute
      const firstInstituteId = authorityKeys[0];
      
      const details = await fetchAndStoreInstituteDetails(firstInstituteId, userId);
      if (setPrimaryColor) {
        setPrimaryColor(details?.institute_theme_code ?? "#E67E22");
      }
      await fetchAndStoreStudentDetails(firstInstituteId, userId);

      // Use the redirectTo from sessionStorage, fallback to calculated URL if not provided
      let redirectUrl = redirectTo || "/study-library/courses";
      
      // Only recalculate if redirectTo is not provided
      if (!redirectTo) {
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
      }
      
      // Since OAuth flow happened in new tab, simply redirect to study library
      window.location.href = redirectUrl;
    }
  } catch (error) {
    console.error("Error in modal successful login:", error);
    toast.error("Failed to process user data.");
    window.history.back();
  } finally {
    // Clean up sessionStorage after processing is complete
    sessionStorage.removeItem('modal_oauth_data');
  }
}; 