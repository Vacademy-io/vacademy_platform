import { getInstituteIdSync } from "@/components/common/helper";
import { getInstituteId } from "@/constants/helper";
import { GET_USER_ROLES_DETAILS, urlInstituteDetails } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { Preferences } from "@capacitor/preferences";
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
    const instituteId = await getInstituteIdSync();
    const StudentDetails = await Preferences.get({ key: "StudentDetails" });
    
    let userId = "";
    if (StudentDetails.value) {
        try {
            const parsedDetails = JSON.parse(StudentDetails.value);
            userId = parsedDetails?.user_id || "";
        } catch (error) {
            console.error("Error parsing StudentDetails:", error);
            userId = "";
        }
    }
    
    const response = await authenticatedAxiosInstance({
        method: "GET",
        url: GET_USER_ROLES_DETAILS,
        params: {
            userId,
            instituteId,
        },
    });
    return response?.data;
};

export const handleFetchUserRoleDetails = () => {
    return {
        queryKey: ["FETCH_USER_ROLE_DETAILS"],
        queryFn: () => fetchUserRolesDetails(),
        staleTime: 60 * 60 * 1000,
    };
};
