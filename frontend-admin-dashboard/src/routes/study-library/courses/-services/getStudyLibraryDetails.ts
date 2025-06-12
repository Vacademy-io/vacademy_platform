// services/study-library/getStudyLibraryDetails.ts
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { INIT_STUDY_LIBRARY } from "@/constants/urls";
import { useStudyLibraryStore } from "@/stores/study-library/use-study-library-store";
import { getTokenDecodedData, getTokenFromCookie } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";

export const fetchStudyLibraryDetails = async () => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];
    const response = await authenticatedAxiosInstance.get(INIT_STUDY_LIBRARY, {
        params: {
            instituteId: INSTITUTE_ID,
        },
    });
    return response.data;
};

export const useStudyLibraryQuery = () => {
    const setStudyLibraryData = useStudyLibraryStore((state) => state.setStudyLibraryData);

    return {
        queryKey: ["GET_INIT_STUDY_LIBRARY"],
        queryFn: async () => {
            const data = await fetchStudyLibraryDetails();
            setStudyLibraryData(data);
            return data;
        },
        staleTime: 3600000,
    };
};
