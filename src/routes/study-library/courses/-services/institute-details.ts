import { getInstituteIdSync } from "@/components/common/helper";
import { getInstituteId } from "@/constants/helper";
import { GET_USER_ROLES_DETAILS, urlInstituteDetails } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { Preferences } from "@capacitor/preferences";
import { getTokenDecodedData } from "@/lib/auth/sessionUtility";
import { getTokenFromStorage } from "@/lib/auth/axiosInstance";
import { TokenKey } from "@/constants/auth/tokens";
import axios from "axios";

export const fetchInstituteDetails = async () => {
    const instituteId = await getInstituteId();
    const response = await axios({
        method: "GET",
        url: `${urlInstituteDetails}/${instituteId}`,
        params: {
            instituteId,
        },
    });
    return response?.data;
};

export const handleFetchInstituteDetails = () => {
    return {
        queryKey: ["FETCH_INSTITUTE_DETAILS"],
        queryFn: () => fetchInstituteDetails(),
        staleTime: 60 * 60 * 1000,
    };
};

export const fetchUserRolesDetails = async () => {
    try {
        const instituteId = await getInstituteIdSync();
        
        // Try to get userId from token first (more reliable)
        let userId = "";
        try {
            const accessToken = await getTokenFromStorage(TokenKey.accessToken);
            if (accessToken) {
                const decodedData = getTokenDecodedData(accessToken);
                userId = decodedData?.user || "";
                console.log('[fetchUserRolesDetails] User ID from token:', userId);
            }
        } catch (error) {
            console.warn('[fetchUserRolesDetails] Failed to get userId from token:', error);
        }
        
        // Fallback: try to get userId from StudentDetails if not available from token
        if (!userId) {
            const StudentDetails = await Preferences.get({ key: "StudentDetails" });
            if (StudentDetails.value) {
                try {
                    const parsedDetails = JSON.parse(StudentDetails.value);
                    userId = parsedDetails?.user_id || "";
                    console.log('[fetchUserRolesDetails] User ID from StudentDetails:', userId);
                } catch (error) {
                    console.error("[fetchUserRolesDetails] Error parsing StudentDetails:", error);
                }
            }
        }
        
        if (!userId) {
            throw new Error("Could not determine userId from token or StudentDetails");
        }
        
        if (!instituteId) {
            throw new Error("Could not determine instituteId");
        }
        
        console.log('[fetchUserRolesDetails] Making API call with:', { userId, instituteId });
        
        const response = await authenticatedAxiosInstance({
            method: "GET",
            url: GET_USER_ROLES_DETAILS,
            params: {
                userId,
                instituteId,
            },
        });
        return response?.data;
    } catch (error) {
        console.error('[fetchUserRolesDetails] Failed to fetch user roles:', error);
        throw error;
    }
};

export const handleFetchUserRoleDetails = () => {
    return {
        queryKey: ["FETCH_USER_ROLE_DETAILS"],
        queryFn: () => fetchUserRolesDetails(),
        staleTime: 60 * 60 * 1000,
    };
};
