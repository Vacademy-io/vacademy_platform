import axios from "axios";
import { BASE_URL } from "@/constants/urls";

// Types for API responses
export interface InstituteSearchResult {
  institute_name: string;
  id: string;
}

export interface InstituteDetails {
  institute_name: string;
  id: string;
  country: string;
  state: string;
  city: string;
  address: string;
  pin_code: string;
  phone: string;
  email: string;
  website_url: string;
  institute_logo_file_id: string;
  institute_theme_code: string;
  language: string;
  description: string;
  type: string;
  held_by: string;
  founded_date: string;
  module_request_ids: string[];
  sub_modules: Array<{
    module: string;
    sub_module: string;
    sub_module_description: string;
  }>;
  sessions: Array<{
    id: string;
    session_name: string;
    status: string;
    start_date: string;
  }>;
  batches_for_sessions: Array<{
    id: string;
    level: {
      id: string;
      level_name: string;
      duration_in_days: number;
      thumbnail_id: string;
    };
    session: {
      id: string;
      session_name: string;
      status: string;
      start_date: string;
    };
    start_time: string;
    status: string;
    package_dto: {
      id: string;
      package_name: string;
      thumbnail_file_id: string;
      is_course_published_to_catalaouge: boolean;
      course_preview_image_media_id: string;
      course_banner_media_id: string;
      course_media_id: string;
      why_learn_html: string;
      who_should_learn_html: string;
      about_the_course_html: string;
      tags: string[];
      course_depth: number;
      course_html_description_html: string;
    };
    group: {
      id: string;
      group_name: string;
      parent_group: {
        id: string;
        groupName: string;
        parentGroup: string;
        isRoot: boolean;
        updatedAt: string;
        createdAt: string;
        groupValue: string;
      };
      is_root: boolean;
      group_value: string;
    };
  }>;
  levels: Array<{
    id: string;
    level_name: string;
    duration_in_days: number;
    thumbnail_id: string;
  }>;
  genders: string[];
  student_statuses: string[];
  subjects: Array<{
    id: string;
    subject_name: string;
    subject_code: string;
    credit: number;
    thumbnail_id: string;
    created_at: string;
    updated_at: string;
    subject_order: number;
  }>;
  session_expiry_days: number[];
  package_groups: Array<{
    group: {
      id: string;
      group_name: string;
      parent_group: {
        id: string;
        groupName: string;
        parentGroup: string;
        isRoot: boolean;
        updatedAt: string;
        createdAt: string;
        groupValue: string;
      };
      is_root: boolean;
      group_value: string;
    };
    package_dto: {
      id: string;
      package_name: string;
      thumbnail_file_id: string;
      is_course_published_to_catalaouge: boolean;
      course_preview_image_media_id: string;
      course_banner_media_id: string;
      course_media_id: string;
      why_learn_html: string;
      who_should_learn_html: string;
      about_the_course_html: string;
      tags: string[];
      course_depth: number;
      course_html_description_html: string;
    };
    id: string;
  }>;
  letter_head_file_id: string;
  tags: string[];
  setting: string;
  cover_image_file_id: string;
  cover_text_json: string;
}

export interface InstituteSettings {
  allowLearnerSignup: boolean;
  allowTeacherSignup: boolean;
  learnersCanCreateCourses: boolean;
}

export interface RegisterUserRequest {
  user: {
    id?: string;
    username: string;
    email: string;
    full_name: string;
    address_line?: string;
    city?: string;
    region?: string;
    pin_code?: string;
    mobile_number?: string;
    date_of_birth?: string;
    gender?: string;
    password?: string;
    profile_pic_file_id?: string;
    roles: string[];
    root_user: boolean;
  };
  institute_id: string;
  subject_id?: string;
  vendor_id?: string;
  learner_package_session_enroll: null;
}

export interface RegisterUserResponse {
  accessToken: string;
  refreshToken: string;
}

export interface UserDetailsByEmailResponse {
  id: string;
  username: string;
  email: string;
  full_name: string;
  address_line?: string;
  city?: string;
  region?: string | null;
  pin_code?: string;
  mobile_number?: string;
  date_of_birth?: string | null;
  gender?: string;
  password?: string;
  profile_pic_file_id?: string;
  roles: string[];
  root_user: boolean;
}

// API functions
export const searchInstitute = async (searchName: string): Promise<InstituteSearchResult[]> => {
  try {
    const response = await axios.get<InstituteSearchResult[]>(
      `${BASE_URL}/admin-core-service/public/institute/v1/search`,
      {
        params: { searchName },
        headers: {
          accept: "*/*",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error searching institutes:", error);
    throw new Error("Failed to search institutes");
  }
};

export const getInstituteDetails = async (instituteId: string): Promise<InstituteDetails> => {
  console.log("=== getInstituteDetails START ===");
  console.log("Fetching details for instituteId:", instituteId);
  
  try {
    const response = await axios.get<InstituteDetails>(
      `${BASE_URL}/admin-core-service/public/institute/v1/details/${instituteId}`,
      {
        headers: {
          accept: "*/*",
        },
      }
    );
    
    console.log("=== Institute details API response ===");
    console.log("Full response data:", response.data);
    console.log("Institute ID:", response.data.id);
    console.log("Institute name:", response.data.institute_name);
    console.log("Settings field:", response.data.setting);
    console.log("Settings field type:", typeof response.data.setting);
    console.log("Settings field length:", response.data.setting?.length);
    
    // Try to parse the settings to see what's in there
    if (response.data.setting) {
      try {
        const parsedSettings = JSON.parse(response.data.setting);
        console.log("Parsed settings from API:", parsedSettings);
        console.log("learnersCanCreateCourses in API response:", parsedSettings.learnersCanCreateCourses);
      } catch (parseError) {
        console.error("Error parsing settings from API response:", parseError);
      }
    }
    
    console.log("=== getInstituteDetails END ===");
    return response.data;
  } catch (error) {
    console.error("Error fetching institute details:", error);
    console.log("=== getInstituteDetails END (error) ===");
    throw new Error("Failed to fetch institute details");
  }
};

export const registerUser = async (userData: RegisterUserRequest): Promise<RegisterUserResponse> => {
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
    console.error("Error registering user:", error);
    throw new Error("Failed to register user");
  }
};

export const getUserDetailsByEmail = async (email: string): Promise<UserDetailsByEmailResponse> => {
  try {
    const response = await axios.post(
      `${BASE_URL}/auth-service/open/user-details/by-email?emailid=${encodeURIComponent(email)}`,
      {},
      {
        headers: {
          'accept': '*/*',
          'content-type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new Error('USER_NOT_FOUND');
    }
    throw error;
  }
};

// Utility function to parse institute settings
export const parseInstituteSettings = (settingsString: string): InstituteSettings => {
  console.log("=== parseInstituteSettings START ===");
  console.log("Input settingsString:", settingsString);
  console.log("Input settingsString type:", typeof settingsString);
  console.log("Input settingsString length:", settingsString?.length);
  
  try {
    // Handle null, undefined, or empty string
    if (!settingsString || settingsString.trim() === '') {
      console.warn("Institute settings string is empty or null, using defaults");
      const defaultSettings = {
        allowLearnerSignup: true,
        allowTeacherSignup: false,
        learnersCanCreateCourses: false,
      };
      console.log("Returning default settings:", defaultSettings);
      console.log("=== parseInstituteSettings END (defaults) ===");
      return defaultSettings;
    }

    const settings = JSON.parse(settingsString);
    console.log("Parsed JSON settings:", settings);
    console.log("Parsed settings type:", typeof settings);
    
    // Handle case where parsed result is null or not an object
    if (!settings || typeof settings !== 'object') {
      console.warn("Parsed institute settings is null or not an object, using defaults");
      const defaultSettings = {
        allowLearnerSignup: true,
        allowTeacherSignup: false,
        learnersCanCreateCourses: false,
      };
      console.log("Returning default settings:", defaultSettings);
      console.log("=== parseInstituteSettings END (defaults) ===");
      return defaultSettings;
    }

    const result = {
      allowLearnerSignup: settings.allowLearnerSignup ?? true,
      allowTeacherSignup: settings.allowTeacherSignup ?? false,
      learnersCanCreateCourses: settings.learnersCanCreateCourses ?? false,
    };
    
    console.log("Final parsed settings result:", result);
    console.log("learnersCanCreateCourses value:", result.learnersCanCreateCourses);
    console.log("=== parseInstituteSettings END (success) ===");
    return result;
  } catch (error) {
    console.error("Error parsing institute settings:", error);
    console.error("Settings string was:", settingsString);
    // Default to allowing learner signup only
    const defaultSettings = {
      allowLearnerSignup: true,
      allowTeacherSignup: false,
      learnersCanCreateCourses: false,
    };
    console.log("Returning default settings due to error:", defaultSettings);
    console.log("=== parseInstituteSettings END (error) ===");
    return defaultSettings;
  }
}; 