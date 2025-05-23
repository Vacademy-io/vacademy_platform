import { useMutation, useQueryClient } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { ADD_COURSE } from "@/constants/urls";
import { AddCourseData } from "@/components/common/study-library/add-course/add-course-form";
import { getTokenDecodedData, getTokenFromCookie } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";

export const useAddCourse = () => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ requestData }: { requestData: AddCourseData }) => {
            const payload = requestData;

            return authenticatedAxiosInstance.post(`${ADD_COURSE}/${INSTITUTE_ID}`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_STUDY_LIBRARY"] });
            queryClient.invalidateQueries({ queryKey: ["GET_INIT_INSTITUTE"] });
            queryClient.invalidateQueries({ queryKey: ["GET_SESSION_DATA"] });
            queryClient.invalidateQueries({ queryKey: ["GET_BATCHES"] });
        },
    });
};
