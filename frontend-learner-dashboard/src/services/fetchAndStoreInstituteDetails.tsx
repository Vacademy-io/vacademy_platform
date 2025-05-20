import { Preferences } from "@capacitor/preferences";
import { toast } from "sonner"; // Assuming you're using sonner for toasts
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { INSTITUTE_DETAIL } from "@/constants/urls";

interface InstituteDetails {
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

    // Store institute details in Capacitor Preferences
    await Preferences.set({
      key: "InstituteDetails",
      value: JSON.stringify(instituteDetails), // Convert object to string before storing
    });

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
