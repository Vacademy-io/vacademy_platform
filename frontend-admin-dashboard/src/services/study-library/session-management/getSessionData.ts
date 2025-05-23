import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { GET_SESSION_DETAILS } from "@/constants/urls";
import { getTokenDecodedData, getTokenFromCookie } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";

export const getSessionData = async () => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];
    const response = await authenticatedAxiosInstance.get(GET_SESSION_DETAILS, {
        params: {
            instituteId: INSTITUTE_ID,
        },
    });
    return response.data;
};

export const useSessionData = () => {
    return {
        queryKey: ["GET_SESSION_DATA"],
        queryFn: async () => {
            const data = await getSessionData();
            return data;
        },
        staleTime: 3600000,
    };
};
