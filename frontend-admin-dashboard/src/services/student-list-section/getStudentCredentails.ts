import { GET_USER_CREDENTIALS } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { useQuery } from "@tanstack/react-query";

export interface StudentCredentialsType {
    username: string;
    password: string;
    user_id: string;
}

export const getStudentCredentails = async ({ userId }: { userId: string }) => {
    const response = await authenticatedAxiosInstance.get(`${GET_USER_CREDENTIALS}/${userId}`);
    return response.data;
};

export const useStudentCredentails = ({ userId }: { userId: string }) => {
    return useQuery<StudentCredentialsType | null>({
        queryKey: ["GET_USER_CREDENTIALS", userId],
        queryFn: async () => {
            const response = await getStudentCredentails({ userId });
            return response.data;
        },
        enabled: !!userId,
    });
};
