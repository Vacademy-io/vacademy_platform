import { Preferences } from "@capacitor/preferences";
import { toast } from "sonner"; // Assuming you're using sonner for toasts
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
  sub_modules: Array<{
    module: string;
    sub_module: string;
    sub_module_description: string;
  }>;
  batches_for_sessions: null;
  subjects: string[];
  institute_settings_json: string;
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
    // Store the institute ID in storage
    await Preferences.set({
      key: "InstituteId",
      value: instituteId,
    });

    // Call API to get institute details
    const instituteDetailsResponse = await authenticatedAxiosInstance({
      method: "GET",
      url: `${INSTITUTE_DETAIL}/${instituteId}`,
      params: {
        instituteId,
        userId,
      },
    });

    // Ensure response data is valid
    if (!instituteDetailsResponse?.data) {
      throw new Error("Invalid response data");
    }

    const instituteDetails: InstituteDetails = instituteDetailsResponse.data;

    // Extract and store naming settings if present
    const settingsJson = (instituteDetailsResponse.data as InstituteDetails)
      .institute_settings_json;
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

    // Re-register push token for the new institute context
    try {
      const { pushNotificationService } = await import('@/services/push-notifications/push-notification-service');
      await pushNotificationService.registerStoredToken();
    } catch (e) {
      console.warn('Push token re-registration after institute switch failed', e);
    }

    return instituteDetails;
  } catch (error) {
    console.error("Failed to fetch institute details:", error);
    toast.error("Failed to fetch institute details. Please try again.");
    return null;
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
