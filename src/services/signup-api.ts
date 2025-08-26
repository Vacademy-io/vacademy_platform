import axios from "axios";
import { BASE_URL, GET_USER_DETAILS_BY_EMAIL, LOGIN_URL } from "@/constants/urls";
import { useQuery } from "@tanstack/react-query";
import { Preferences } from "@capacitor/preferences";
import { getTokenDecodedData } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
// import type { NavigateFunction } from "@tanstack/react-router";
type NavigateFunction = (options: { to: string }) => void;

// Types
export interface InstituteSearchResult {
  id: string;
  institute_name: string;
}

export interface InstituteDetails {
  id: string;
  institute_name: string;
  setting?: string;
  [key: string]: any;
}

export interface RegisterUserRequest {
  user: {
    username: string;
    email: string;
    full_name: string;
    password: string;
    roles: string[];
    root_user: boolean;
  };
  institute_id: string;
  subject_id?: string; // OAuth subject ID (e.g., Google sub)
  vendor_id?: string;  // OAuth provider (e.g., "google", "github")
}

export interface RegisterUserResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    email: string;
    full_name: string;
    roles: string[];
  };
}

export interface InstituteSettings {
  allowLearnerSignup: boolean;
  allowTeacherSignup: boolean;
  learnersCanCreateCourses: boolean;
  signup?: any;
}

// Institute search function
export const searchInstitute = async (searchName: string): Promise<InstituteSearchResult[]> => {
  try {
    const response = await axios.get(`${BASE_URL}/admin-core-service/public/institute/v1/search`, {
      params: { searchName },
      headers: {
        accept: "*/*",
      },
    });
    return response.data;
  } catch (error) {
    throw new Error("Failed to search institutes");
  }
};

// Get institute details function
export const getInstituteDetails = async (instituteId: string): Promise<InstituteDetails> => {
  try {
    const response = await axios.get(`${BASE_URL}/admin-core-service/public/institute/v1/details/${instituteId}`, {
      headers: {
        accept: "*/*",
      },
    });
    return response.data;
  } catch (error) {
    throw new Error("Failed to fetch institute details");
  }
};

// Post signup authentication handler
export const handlePostSignupAuth = async (
  accessToken: string,
  refreshToken: string,
  instituteId: string,
  navigate: NavigateFunction,
  isModalSignup: boolean = false
) => {
  try {
    console.group('[Signup API] handlePostSignupAuth');

    // Store tokens in Capacitor Preferences
    await Preferences.set({ key: TokenKey.accessToken, value: accessToken });
    await Preferences.set({ key: TokenKey.refreshToken, value: refreshToken });
    await Preferences.set({ key: "instituteId", value: instituteId });

    // Decode token to get user ID
    const decodedData = getTokenDecodedData(accessToken);
    const userId = decodedData?.user;

    if (!userId) {
      throw new Error("Failed to decode user ID from token");
    }

    // Store institute details in localStorage for backward compatibility
    const instituteDetails = await getInstituteDetails(instituteId);
    localStorage.setItem("InstituteDetails", JSON.stringify(instituteDetails));

    // Navigate to dashboard
    navigate({ to: "/dashboard" });
    console.groupEnd();
  } catch (error) {
    console.error('[Signup API] handlePostSignupAuth failed:', error);
    // Fallback: redirect to login page
    navigate({ to: "/login" });
    console.groupEnd();
  }
};

// Main registration function
export const registerUser = async (
  userData: RegisterUserRequest
): Promise<RegisterUserResponse> => {
  try {
    console.group('[Signup API] Starting user registration');

    const response = await axios.post<RegisterUserResponse>(
      `${BASE_URL}/auth-service/learner/v1/register`,
      userData,
      {
        headers: {
          accept: "*/*",
          "Content-Type": "application/json",
        },
      }
    );

    console.groupEnd();
    return response.data;
  } catch (error) {
    console.error('[Signup API] Registration failed:', error);
    console.groupEnd();
    throw new Error("Failed to register user");
  }
};

// Utility function to parse institute settings
export const parseInstituteSettings = (
  settingsString: string
): InstituteSettings => {
  try {
    // Handle null, undefined, or empty string
    if (!settingsString || settingsString.trim() === "") {
      return {
        allowLearnerSignup: true,
        allowTeacherSignup: false,
        learnersCanCreateCourses: false,
      };
    }

    const settings = JSON.parse(settingsString);
    // Handle case where parsed result is null or not an object
    if (!settings || typeof settings !== "object") {
      return {
        allowLearnerSignup: true,
        allowTeacherSignup: false,
        learnersCanCreateCourses: false,
      };
    }

    // Extract permissions from the nested structure
    let allowLearnersToCreateCourses = false;
    if (settings.setting && typeof settings.setting === "object") {
      if (
        settings.setting.COURSE_SETTING &&
        settings.setting.COURSE_SETTING.data &&
        settings.setting.COURSE_SETTING.data.permissions
      ) {
        const permissions =
          settings.setting.COURSE_SETTING.data.permissions;
        allowLearnersToCreateCourses =
          permissions.allowLearnersToCreateCourses ?? false;
      }
    }
    
    // For backward compatibility, also check direct properties
    const allowLearnerSignup = settings.allowLearnerSignup ?? true;
    const allowTeacherSignup = settings.allowTeacherSignup ?? false;
    const learnersCanCreateCourses =
      allowLearnersToCreateCourses ||
      (settings.learnersCanCreateCourses ?? false);
    
    // Extract signup settings from STUDENT_DISPLAY_SETTINGS
    let signupSettings = null;
    if (settings.setting && typeof settings.setting === "object") {
      if (
        settings.setting.STUDENT_DISPLAY_SETTINGS &&
        settings.setting.STUDENT_DISPLAY_SETTINGS.data &&
        settings.setting.STUDENT_DISPLAY_SETTINGS.data.signup
      ) {
        signupSettings = settings.setting.STUDENT_DISPLAY_SETTINGS.data.signup;
      }
    }

    return {
      allowLearnerSignup,
      allowTeacherSignup,
      learnersCanCreateCourses,
      signup: signupSettings, // Include parsed signup settings
    };
  } catch (error) {
    return {
      allowLearnerSignup: true,
      allowTeacherSignup: false,
      learnersCanCreateCourses: false,
    };
  }
};

// Utility function to parse signup settings from institute details
export const parseSignupSettings = (instituteDetails: any) => {
  return instituteDetails.signup || null;
};

// React Query hook for fetching institute details
export const useInstituteQuery = ({ instituteId }: { instituteId: string }) => {
  return useQuery({
    queryKey: ['institute', instituteId],
    queryFn: async () => {
      if (!instituteId) {
        throw new Error('Institute ID is required');
      }
      
      try {
        // Try to get from localStorage first
        const storedDetails = localStorage.getItem("InstituteDetails");
        if (storedDetails) {
          const parsed = JSON.parse(storedDetails);
          if (parsed.id === instituteId) {
            return parsed;
          }
        }
        
        // If not in localStorage or different institute, fetch from API
        const response = await axios.get(`${BASE_URL}/admin-core-service/public/institute/v1/details/${instituteId}`);
        return response.data;
              } catch (error) {
          throw error;
        }
    },
    enabled: !!instituteId,
  });
};

// Check if user is already enrolled by email in a specific institute
export const checkUserEnrollment = async (email: string, instituteId: string): Promise<{ isEnrolled: boolean; userDetails?: any; enrollmentInfo?: string; password?: string }> => {
  try {
    console.group('[Signup API] Checking user enrollment for:', email, 'in institute:', instituteId);
    console.log('[Signup API] Using endpoint:', `${GET_USER_DETAILS_BY_EMAIL}?emailId=${encodeURIComponent(email)}`);
    
    // Check if user exists in the system
    console.log('[Signup API] Checking if user exists in system...');
    const userResponse = await axios.post(`${GET_USER_DETAILS_BY_EMAIL}?emailId=${encodeURIComponent(email)}`, {}, {
      headers: {
        accept: "*/*",
        "Content-Type": "application/json",
      },
    });

    if (!userResponse.data || !userResponse.data.roles || userResponse.data.roles.length === 0) {
      console.log('[Signup API] User does not exist or has no roles');
      console.groupEnd();
      return {
        isEnrolled: false,
        enrollmentInfo: "User is not enrolled in any institute"
      };
    }

    console.log('[Signup API] User exists with roles:', userResponse.data.roles);
    
    // Since we can't determine institute-specific enrollment from the user-details API alone,
    // we'll assume the user is not enrolled in this specific institute and allow registration
    // The actual enrollment check will happen during the registration process if needed
    
    console.log('[Signup API] User exists in system, allowing registration (institute-specific enrollment will be checked during registration)');
    console.groupEnd();
    
    return {
      isEnrolled: false,
      userDetails: userResponse.data,
      enrollmentInfo: "User exists in system but not enrolled in this specific institute",
      password: userResponse.data.password // Keep password for potential use
    };
    
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log('[Signup API] User does not exist in system (404 response)');
      console.groupEnd();
      return {
        isEnrolled: false,
        enrollmentInfo: "User is not enrolled in any institute"
      };
    }
    
    console.error('[Signup API] Error checking user enrollment:', error);
    console.groupEnd();
    throw new Error("Failed to check user enrollment. Please try again.");
  }
};

// Login function for already enrolled users
export const loginEnrolledUser = async (
  username: string,
  password: string,
  instituteId: string
): Promise<RegisterUserResponse> => {
  try {
    console.group('[Signup API] Logging in enrolled user:', username);
    
    const response = await axios.post(LOGIN_URL, {
      user_name: username,
      password: password,
      client_name: "ADMIN_PORTAL",
      institute_id: instituteId,
    }, {
      headers: {
        accept: "*/*",
        "Content-Type": "application/json",
      },
    });

    console.log('[Signup API] Login successful for enrolled user');
    console.groupEnd();
    
    return {
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
      user: {
        id: response.data.user?.id || '',
        username: response.data.user?.username || username,
        email: response.data.user?.email || '',
        full_name: response.data.user?.full_name || '',
        roles: response.data.user?.roles || [],
      }
    };
  } catch (error: any) {
    console.error('[Signup API] Login failed for enrolled user:', error);
    console.groupEnd();
    
    // Provide more specific error messages
    if (error.response?.status === 401) {
      throw new Error("Invalid password for existing account. Please use your correct password or try 'Forgot Password'.");
    } else if (error.response?.status === 403) {
      throw new Error("Access denied. Please contact your institute administrator.");
    } else if (error.response?.status === 404) {
      throw new Error("User account not found. Please check your email or contact support.");
    } else {
      throw new Error("Failed to login with existing account. Please try again or contact support.");
    }
  }
};

