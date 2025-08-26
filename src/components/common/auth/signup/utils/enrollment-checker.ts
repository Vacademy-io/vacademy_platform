import { checkUserEnrollment } from "@/services/signup-api";
import { loginEnrolledUser } from "@/services/signup-api";
import { toast } from "sonner";
import { Preferences } from "@capacitor/preferences";
import { TokenKey } from "@/constants/auth/tokens";
import { getTokenDecodedData } from "@/lib/auth/sessionUtility";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import { fetchAndStoreInstituteDetails } from "@/services/fetchAndStoreInstituteDetails";
import { fetchAndStoreStudentDetails } from "@/services/studentDetails";
import { fetchUserRolesDetails } from "@/routes/study-library/courses/-services/institute-details";

export interface EnrollmentCheckResult {
  isEnrolled: boolean;
  shouldRedirectToLogin: boolean;
  userDetails?: any;
  password?: string;
}

export interface AutoLoginResult {
  success: boolean;
  error?: string;
}

/**
 * Checks if a user is already enrolled in the current institute
 * Returns enrollment status and whether user should be redirected to login
 */
export async function checkUserEnrollmentInInstitute(
  email: string, 
  instituteId: string
): Promise<EnrollmentCheckResult> {
  try {
    console.log('[DEBUG] enrollment-checker: Checking enrollment for:', { email, instituteId });
    const enrollmentCheck = await checkUserEnrollment(email, instituteId);
    console.log('[DEBUG] enrollment-checker: API response:', enrollmentCheck);
    
    if (enrollmentCheck.userDetails && enrollmentCheck.password) {
      console.log('[DEBUG] enrollment-checker: User is enrolled');
      return {
        isEnrolled: true,
        shouldRedirectToLogin: true,
        userDetails: enrollmentCheck.userDetails,
        password: enrollmentCheck.password
      };
    }
    
    console.log('[DEBUG] enrollment-checker: User is not enrolled');
    return {
      isEnrolled: false,
      shouldRedirectToLogin: false
    };
    
  } catch (error) {
    console.log('[DEBUG] enrollment-checker: Error checking enrollment:', error);
    // If there's an error checking enrollment, assume user is not enrolled
    // to avoid blocking legitimate registrations
    return {
      isEnrolled: false,
      shouldRedirectToLogin: false
    };
  }
}

/**
 * Automatically logs in an enrolled user and handles post-login flow
 * This reuses the existing login logic from useUnifiedRegistration
 */
export async function autoLoginEnrolledUser(
  email: string,
  instituteId: string,
  username?: string,
  shouldRedirectAfterLogin: boolean = true
): Promise<AutoLoginResult> {
  try {
    // Get enrollment details to get the password
    const enrollmentCheck = await checkUserEnrollment(email, instituteId);
    
    if (!enrollmentCheck.userDetails || !enrollmentCheck.password) {
      throw new Error('User enrollment details not found');
    }
    
    // Use the username from enrollment or fallback
    const loginUsername = username || enrollmentCheck.userDetails.username || email.split("@")[0];
    
    // Call the login API for enrolled users
    const loginResponse = await loginEnrolledUser(
      loginUsername,
      enrollmentCheck.password,
      instituteId
    );
    
    if (!loginResponse.accessToken || !loginResponse.refreshToken) {
      throw new Error('Login response missing tokens');
    }
    
    // Store tokens
    await Preferences.set({ key: TokenKey.accessToken, value: loginResponse.accessToken });
    await Preferences.set({ key: TokenKey.refreshToken, value: loginResponse.refreshToken });
    await Preferences.set({ key: "instituteId", value: instituteId });
    await Preferences.set({ key: "InstituteId", value: instituteId });
    
    // Get userId from token
    const decodedData = getTokenDecodedData(loginResponse.accessToken);
    const userId = decodedData?.user;
    
    if (!userId) {
      throw new Error('Failed to decode user ID from token');
    }
    
    // Extended delay to ensure tokens are properly stored
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify tokens are accessible
    const storedToken = await Preferences.get({ key: TokenKey.accessToken });
    if (!storedToken.value) {
      throw new Error('Access token not found in storage after storing');
    }
    
    // Handle post-login flow (same as in useUnifiedRegistration)
    try {
      // 1. Fetch student display settings
      await getStudentDisplaySettings(true);
      
      // 2. Fetch and store institute details
      await fetchAndStoreInstituteDetails(instituteId, userId);
      
      // 3. Fetch and store student details
      await fetchAndStoreStudentDetails(instituteId, userId);
      
      // 4. Fetch user role details
      await fetchUserRolesDetails();
      
    } catch (error) {
      // Don't fail the login, just silently handle the error
    }
    
    // Handle redirection after successful auto-login
    if (shouldRedirectAfterLogin) {
      try {
        // Determine the redirect route (same as in useUnifiedRegistration)
        const backendRedirectRoute = "/study-library/courses";
        
        // Use window.location for navigation to ensure proper redirection
        if (typeof window !== 'undefined') {
          window.location.href = backendRedirectRoute;
        }
        
      } catch (error) {
        // Don't fail the login, just silently handle the error
      }
    }
    
    return { success: true };
    
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Auto-login failed' 
    };
  }
}

/**
 * Handles the case where a user is already enrolled
 * Shows appropriate message and can trigger auto-login or redirect
 */
export function handleEnrolledUser(
  email: string,
  instituteId: string,
  onAutoLoginSuccess?: () => void,
  onAutoLoginFailure?: (error: string) => void,
  shouldRedirectAfterLogin: boolean = true
): Promise<AutoLoginResult> {
  return new Promise(async (resolve) => {
    try {
      // Show user-friendly message
      toast.info("You are already enrolled in this institute. Logging you in automatically...");
      
      // Attempt auto-login
      const result = await autoLoginEnrolledUser(email, instituteId, undefined, shouldRedirectAfterLogin);
      
      if (result.success) {
        toast.success("Welcome back! You are already enrolled in this institute.");
        onAutoLoginSuccess?.();
      } else {
        toast.error("You are already enrolled in this institute. Please use the login page with your correct credentials.");
        onAutoLoginFailure?.(result.error || 'Auto-login failed');
      }
      
      resolve(result);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Auto-login failed';
      toast.error("You are already enrolled in this institute. Please use the login page with your correct credentials.");
      onAutoLoginFailure?.(errorMessage);
      resolve({ success: false, error: errorMessage });
    }
  });
}
