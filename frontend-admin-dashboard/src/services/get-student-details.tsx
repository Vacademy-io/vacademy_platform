import { GET_USER_DETAILS } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { useQuery } from "@tanstack/react-query";

export const useGetStudentDetails = (userId: string) => {
    return useQuery({
        queryKey:["STUDENT_DETAILS", userId],
        queryFn: async () => {
            const response = await authenticatedAxiosInstance.get(GET_USER_DETAILS, {
                params: {
                    userId: userId,
                },
            });
            return response.data;
        },
        staleTime: 1000*60*60*5,
        enabled: !!userId,
    });
}
