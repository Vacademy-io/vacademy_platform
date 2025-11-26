import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { Preferences } from "@capacitor/preferences";
import { BASE_URL } from "@/constants/urls";
import type { MyFilesRequest, MyFilesResponse } from "@/types/system-files";

const MY_FILES_URL = `${BASE_URL}/admin-core-service/system-files/v1/my-files`;

/**
 * Fetch all files that the authenticated user has access to
 */
export const getMyFiles = async (request: MyFilesRequest = {}): Promise<MyFilesResponse> => {
  try {
    // Get institute ID from storage
    const instituteIdPref = await Preferences.get({ key: "InstituteId" });
    const instituteId = instituteIdPref.value;
console.log("instituteId", instituteId);
    if (!instituteId) {
      throw new Error("Institute ID not found");
    }

    // Default to only ACTIVE files if not specified
    const payload: MyFilesRequest = {
      statuses: request.statuses || ["ACTIVE"],
      user_roles: request.user_roles || [""],
      access_type: request.access_type,
    };

    const response = await authenticatedAxiosInstance.post<MyFilesResponse>(
      `${MY_FILES_URL}?instituteId=${instituteId}`,
      payload
    );

    return response.data;
  } catch (error) {
    console.error("Error fetching my files:", error);
    throw error;
  }
};
