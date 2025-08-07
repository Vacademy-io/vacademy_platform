import { useEffect } from "react";
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
  const message = urlParams.get("message");
  const state = urlParams.get("state");
  
  // Parse state to get redirect information
  let redirectTo = "/dashboard";
  let currentUrl = "";
  let type = "";
  let courseId = "";
  let instituteId = "";
  
  if (state) {
    try {
      console.log("Raw state received:", state);
      console.log("Raw state length:", state.length);
      console.log("Raw state type:", typeof state);
      
      // Check if state needs URL decoding first
      let decodedState;
      try {
        decodedState = atob(state);
      } catch {
        console.log("Direct atob failed, trying URL decode first");
        const urlDecodedState = decodeURIComponent(state);
        console.log("URL decoded state:", urlDecodedState);
        decodedState = atob(urlDecodedState);
      }
      
      console.log("Decoded state:", decodedState);
      console.log("Decoded state length:", decodedState.length);
      
      const stateObj = JSON.parse(decodedState);
      console.log("Parsed state object:", stateObj);
      
      redirectTo = stateObj.redirectTo || "/dashboard";
      currentUrl = stateObj.currentUrl || "";
      type = stateObj.type || "";
      courseId = stateObj.courseId || "";
      instituteId = stateObj.instituteId || "";
      
      console.log("Extracted values from state:", { redirectTo, currentUrl, type, courseId, instituteId });
    } catch (parseError) {
      console.error("Error parsing state:", parseError);
      console.error("State that failed to parse:", state);
      console.error("Parse error details:", parseError instanceof Error ? parseError.message : String(parseError));
    }
  } else {
    console.log("No state parameter found in URL");
  }

  // Try to get data from sessionStorage first (new approach)
  const storedModalData = sessionStorage.getItem('modal_oauth_data');
  console.log("Stored modal OAuth data from sessionStorage:", storedModalData);
  
  if (storedModalData) {
    try {
      const modalData = JSON.parse(storedModalData);
      console.log("Parsed modal data:", modalData);
      
      // Use data from sessionStorage
      redirectTo = modalData.redirectTo || redirectTo;
      currentUrl = modalData.currentUrl || currentUrl;
      type = modalData.type || type;
      courseId = modalData.courseId || courseId;
      instituteId = modalData.instituteId || instituteId;
      
      console.log("Using data from sessionStorage:", { redirectTo, currentUrl, type, courseId, instituteId });
    } catch (parseError) {
      console.error("Error parsing stored modal data:", parseError);
    }
  } else {
    // Fallback to state extraction (old approach)
    console.log("No stored modal data found, using state extraction");
    console.log("Extracted instituteId from state:", instituteId);
  }
  
  // Also log the current URL for debugging
  console.log("Current URL:", window.location.href);
  console.log("Current URL search params:", window.location.search);

  if (error) {
    toast.error(decodeURIComponent(message || "Authentication failed."));
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
    console.log("Starting modal successful login with:", { instituteId, type, courseId, currentUrl });
    
    const decodedData = getTokenDecodedData(accessToken);
    const authorities = decodedData?.authorities;
    const userId = decodedData?.user;

    const authorityKeys = authorities ? Object.keys(authorities) : [];
    console.log("User authorities:", authorityKeys);

    if (!userId || authorityKeys.length === 0) {
      toast.error("Invalid user or institute data.");
      window.history.back();
      return;
    }

    // If instituteId is provided, check if user is enrolled in that institute
    if (instituteId) {
      console.log("Checking enrollment for institute:", instituteId);
      if (authorityKeys.includes(instituteId)) {
        console.log("User is enrolled in institute:", instituteId);
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
        
        console.log("Using redirectTo from sessionStorage:", redirectTo);
        console.log("Final redirect URL:", redirectUrl);
        // Open the redirect URL in new tab
        console.log("Opening new tab with URL:", redirectUrl);
        
        try {
          // Try to open the new tab
          const newWindow = window.open(redirectUrl, '_blank', 'noopener,noreferrer');
          console.log("New window opened:", newWindow);
          
          // If popup is blocked, redirect in current tab
          if (!newWindow) {
            console.log("Popup blocked, redirecting in current tab");
            window.location.href = redirectUrl;
          } else {
            // Check if the window was actually opened successfully
            setTimeout(() => {
              try {
                // Try to access the new window to see if it's blocked
                if (newWindow.closed === false) {
                  console.log("New tab opened successfully, closing modal");
                  window.history.back();
                } else {
                  console.log("New tab was closed or blocked, redirecting in current tab");
                  window.location.href = redirectUrl;
                }
                             } catch {
                 console.log("Cannot access new window (likely blocked), redirecting in current tab");
                 window.location.href = redirectUrl;
               }
            }, 200);
          }
        } catch (error) {
          console.error("Error opening new tab:", error);
          // Fallback to current tab redirect
          window.location.href = redirectUrl;
        }
      } else {
        console.log("User is NOT enrolled in institute:", instituteId);
        // User is not enrolled in the specified institute
        toast.error("You are not enrolled in this institute.");
        window.history.back();
      }
    } else {
      console.log("No instituteId provided, using first available institute");
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
      
      console.log("Using redirectTo from sessionStorage:", redirectTo);
      console.log("Final redirect URL:", redirectUrl);
      // Open the redirect URL in new tab
      console.log("Opening new tab with URL:", redirectUrl);
      
              try {
          // Try to open the new tab
          const newWindow = window.open(redirectUrl, '_blank', 'noopener,noreferrer');
          console.log("New window opened:", newWindow);
          
          // If popup is blocked, redirect in current tab
          if (!newWindow) {
            console.log("Popup blocked, redirecting in current tab");
            window.location.href = redirectUrl;
          } else {
            // Check if the window was actually opened successfully
            setTimeout(() => {
              try {
                // Try to access the new window to see if it's blocked
                if (newWindow.closed === false) {
                  console.log("New tab opened successfully, closing modal");
                  window.history.back();
                } else {
                  console.log("New tab was closed or blocked, redirecting in current tab");
                  window.location.href = redirectUrl;
                }
              } catch {
                console.log("Cannot access new window (likely blocked), redirecting in current tab");
                window.location.href = redirectUrl;
              }
            }, 200);
          }
        } catch (error) {
          console.error("Error opening new tab:", error);
          // Fallback to current tab redirect
          window.location.href = redirectUrl;
        }
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