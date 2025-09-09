import { getInstituteId } from "@/constants/helper";
import { cachedGet } from "@/lib/http/clientCache";
import { GET_SUBDOMAIN_OR_INSTITUTEID, INSTITUTE_ID } from "@/constants/urls";
import axios from "axios";
import { Preferences } from "@capacitor/preferences";

export const fetchCourseDetails = async (courseId: string) => {
    const instituteId = getInstituteId();
    // Replace with your actual API endpoint
    const data = await cachedGet(`/api/institutes/${instituteId}/courses/${courseId}`, { method: 'GET' });
    return data;
};

export const getInstituteIdBySubdomain = async ({
    subdomain,
}: {
    subdomain: string;
}) => {
    const response = await axios({
        method: "GET",
        url: GET_SUBDOMAIN_OR_INSTITUTEID,
        params: {
            subdomain,
        },
    });
    return response?.data;
};

export const handleGetInstituteIdBySubdomain = ({
    subdomain,
}: {
    subdomain: string;
}) => {
    return {
        queryKey: ["GET_INSTITUTEID_OR_SUBDOMAIN", subdomain],
        queryFn: () => getInstituteIdBySubdomain({ subdomain }),
        staleTime: 60 * 60 * 1000,
    };
};

// New function to handle instituteId logic with localStorage comparison
export const getInstituteIdWithLocalStorageCheck = async (subdomain: string) => {
    try {
        // First, try to get instituteId from localStorage
        const localStorageInstituteId = await Preferences.get({ key: "InstituteId" });
        const storedInstituteId = localStorageInstituteId?.value;

        // Get instituteId from API
        const apiResult = subdomain
            ? await getInstituteIdBySubdomain({ subdomain })
            : "Data not found";

        // If API returns "Data not found", use localStorage instituteId
        if (apiResult === "Data not found") {
            // On localhost/no subdomain fall back to env default if nothing in storage
            return storedInstituteId || INSTITUTE_ID || null;
        }

        // If we get instituteId from API and it matches localStorage, use it
        if (storedInstituteId && apiResult === storedInstituteId) {
            return apiResult;
        }

        // If we get instituteId from API but it doesn't match localStorage, use API result
        if (apiResult && apiResult !== storedInstituteId) {
            return apiResult;
        }

        // If no API result but we have localStorage, use localStorage
        if (!apiResult && storedInstituteId) {
            return storedInstituteId;
        }

        // Default fallback
        const finalResult = apiResult || storedInstituteId || INSTITUTE_ID || null;
        return finalResult;
    } catch (error) {
        console.error("Error in getInstituteIdWithLocalStorageCheck:", error);
        // Fallback to localStorage if API fails
        try {
            const localStorageInstituteId = await Preferences.get({ key: "InstituteId" });
            return localStorageInstituteId?.value || INSTITUTE_ID || null;
        } catch (localStorageError) {
            console.error("Error accessing localStorage:", localStorageError);
            return INSTITUTE_ID || null;
        }
    }
};

// React Query hook for the new instituteId logic
export const handleGetInstituteIdWithLocalStorageCheck = ({
    subdomain,
}: {
    subdomain: string;
}) => {
    return {
        queryKey: ["GET_INSTITUTEID_WITH_LOCALSTORAGE_CHECK", subdomain],
        queryFn: () => getInstituteIdWithLocalStorageCheck(subdomain),
        staleTime: 60 * 60 * 1000,
    };
};
