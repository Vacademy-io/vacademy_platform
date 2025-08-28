import { TokenKey } from "@/constants/auth/tokens";
import { getTokenDecodedData } from "@/lib/auth/sessionUtility";
import { getTokenFromStorage } from "@/lib/auth/axiosInstance";

export async function getInstituteIdSync() {
    try {
        // First, check if user has selected a specific institute
        const { Preferences } = await import("@capacitor/preferences");
        const selectedInstitute = await Preferences.get({
            key: "selectedInstituteId",
        });

        if (selectedInstitute.value) {
            return selectedInstitute.value;
        }

        // Fallback to first institute from authorities if no selection made
        const accessToken = await getTokenFromStorage(TokenKey.accessToken);
        const data = getTokenDecodedData(accessToken);
        console.log("data", data);
        const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
        return INSTITUTE_ID;
    } catch (error) {
        console.error("Error getting institute ID sync:", error);
        // Fallback to first institute from authorities
        const accessToken = await getTokenFromStorage(TokenKey.accessToken);
        const data = getTokenDecodedData(accessToken);
        const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
        return INSTITUTE_ID;
    }
}

export function extractTextFromHTML(htmlString?: string | null) {
    if (htmlString == null) return "";
    return String(htmlString).replace(/<[^>]*>/g, "");
}
