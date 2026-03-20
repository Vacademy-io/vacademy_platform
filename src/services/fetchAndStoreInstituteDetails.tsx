import { Preferences } from "@capacitor/preferences";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { INSTITUTE_DETAIL } from "@/constants/urls";
import { NAMING_SETTINGS_KEY } from "@/types/naming-settings";

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
  institute_logo_file_id: string | null;
  institute_theme_code: string;
  home_icon_click_route?: string | null;
  homeIconClickRoute?: string | null;
  sub_modules: Array<{
    module: string;
    sub_module: string;
    sub_module_description: string;
  }>;
  batches_for_sessions: null;
  subjects: string[];
  institute_settings_json: string;
  sub_orgs?: Array<{
    sub_org_id: string;
    name: string;
    logo_file_id: string | null;
    status: string;
  }>;
}

// Type for the expected structure of institute_settings_json
interface InstituteSettings {
  setting?: {
    NAMING_SETTING?: {
      key: string;
      name: string;
      data?: {
        data?: NamingSettingsType[];
      };
    };
  };
}

export interface NamingSettingsType {
  key: string;
  systemValue: string | null;
  customValue: string;
}

export const fetchAndStoreInstituteDetails = async (
  instituteId: string,
  userId: string
): Promise<InstituteDetails | null> => {
  try {
    console.log('[fetchAndStoreInstituteDetails] Starting API call:', {
      instituteId,
      userId,
      url: `${INSTITUTE_DETAIL}/${instituteId}`
    });

    // Store the institute ID in storage
    await Preferences.set({
      key: "InstituteId",
      value: instituteId,
    });

    // Also store in localStorage
    try {
      localStorage.setItem("InstituteId", instituteId);
    } catch (error) {
      console.warn("Failed to write InstituteId to localStorage:", error);
    }

    console.log('[fetchAndStoreInstituteDetails] Institute ID stored in preferences');

    // Call API to get institute details
    console.log('[fetchAndStoreInstituteDetails] Making API call...');
    const instituteDetailsResponse = await authenticatedAxiosInstance({
      method: "GET",
      url: `${INSTITUTE_DETAIL}/${instituteId}`,
      params: {
        instituteId,
        userId,
      },
    });
    console.log('[fetchAndStoreInstituteDetails] API call successful:', {
      status: instituteDetailsResponse.status,
      hasData: !!instituteDetailsResponse.data
    });

    // Ensure response data is valid
    if (!instituteDetailsResponse?.data) {
      throw new Error("Invalid response data");
    }

    const rawData = instituteDetailsResponse.data;
    const instituteDetails: InstituteDetails = {
      ...rawData,
      sub_modules: rawData.sub_modules || [],
    };

    // Extract and store naming settings if present
    const settingsJson = instituteDetails.institute_settings_json;
    if (settingsJson) {
      try {
        const settingsObj: InstituteSettings = JSON.parse(settingsJson);

        const namingSettings = settingsObj?.setting?.NAMING_SETTING?.data?.data;
        if (namingSettings) {
          localStorage.setItem(
            NAMING_SETTINGS_KEY,
            JSON.stringify(namingSettings)
          );
        }
      } catch (err) {
        console.error("Failed to parse or store naming settings:", err);
      }
    }

    // Store institute details in Capacitor Preferences
    await Preferences.set({
      key: "InstituteDetails",
      value: JSON.stringify(instituteDetails), // Convert object to string before storing
    });

    // Also store in localStorage
    try {
      localStorage.setItem("InstituteDetails", JSON.stringify(instituteDetails));
    } catch (error) {
      console.warn("Failed to write InstituteDetails to localStorage:", error);
    }

    // Re-register push token for the new institute context
    try {
      const { pushNotificationService } = await import('@/services/push-notifications/push-notification-service');
      await pushNotificationService.registerStoredToken();
    } catch (e) {
      console.warn('Push token re-registration after institute switch failed', e);
    }

    return instituteDetails;
  } catch (error) {
    console.error("Failed to fetch institute details, using fallback:", error);

    // Fallback: Store minimal institute details to ensure isAuthenticated passes
    const fallbackInstituteDetails: InstituteDetails = {
      id: instituteId,
      institute_name: "Institute", // Default name
      batches_for_sessions: null,
      sub_modules: [],
      subjects: [],
      institute_settings_json: "{}",
      country: "",
      state: "",
      city: "",
      address: "",
      pin_code: "",
      phone: "",
      email: "",
      website_url: "",
      institute_logo_file_id: null,
      institute_theme_code: "#000000"
    };

    await Preferences.set({
      key: "InstituteDetails",
      value: JSON.stringify(fallbackInstituteDetails),
    });

    // Also store in localStorage
    try {
      localStorage.setItem("InstituteDetails", JSON.stringify(fallbackInstituteDetails));
    } catch (error) {
      console.warn("Failed to write fallback InstituteDetails to localStorage:", error);
    }

    return fallbackInstituteDetails;
  }
};

// Helper function to retrieve stored institute details
export const getStoredInstituteDetails =
  async (): Promise<InstituteDetails | null> => {
    try {
      const { value } = await Preferences.get({ key: "InstituteDetails" });

      if (!value) return null;

      return JSON.parse(value) as InstituteDetails;
    } catch (error) {
      console.error("Error parsing stored institute details:", error);
      return null;
    }
  };
