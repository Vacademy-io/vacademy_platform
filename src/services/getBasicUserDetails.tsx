import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_USER_BASIC_DETAILS } from '@/constants/urls';
import { useQuery } from '@tanstack/react-query';

export const getUserBasicDetails = async (userIds: string[]) => {
    const response = await authenticatedAxiosInstance.post(`${GET_USER_BASIC_DETAILS}`, userIds);
    return response.data;
};

export const useGetUserBasicDetails = (userIds: string[]) => {
    return useQuery({
        queryKey: ['getUserBasicDetails', userIds],
        queryFn: () => getUserBasicDetails(userIds),
    });
};
