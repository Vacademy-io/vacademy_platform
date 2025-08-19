import axios from "axios";
import { BASE_URL } from "@/constants/urls";
import { useQuery } from "@tanstack/react-query";
import { Preferences } from "@capacitor/preferences";
import { getTokenDecodedData } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import type { NavigateFunction } from "@tanstack/react-router";

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
  } catch (error) {
    // Fallback: redirect to login page
    navigate({ to: "/login" });
  }
};

// Main registration function
export const registerUser = async (
  userData: RegisterUserRequest
): Promise<RegisterUserResponse> => {
  try {
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
    return response.data;
  } catch (error) {
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

