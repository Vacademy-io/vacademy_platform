import { GET_USER_CREDENTIALS } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { useQuery } from '@tanstack/react-query';

export interface StudentCredentialsType {
    username: string;
    password: string;
    user_id: string;
}

// This function fetches student credentials using the authenticated Axios instance
export const getStudentCredentails = async ({ userId }: { userId: string }) => {
    const response = await authenticatedAxiosInstance.get(`${GET_USER_CREDENTIALS}/${userId}`);
    return response.data ?? null; // Ensure the return is not undefined
};

// React Query hook to fetch and cache the student credentials
export const useStudentCredentails = ({ userId }: { userId: string }) => {
    return useQuery<StudentCredentialsType | null>({
        queryKey: ['GET_USER_CREDENTIALS', userId],
        queryFn: () => getStudentCredentails({ userId }), // Removed incorrect `response.data`
        enabled: !!userId, // Only runs if userId is truthy
    });
};
