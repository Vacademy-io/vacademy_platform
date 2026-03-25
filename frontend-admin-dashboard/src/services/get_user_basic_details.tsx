import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_USER_BASIC_DETAILS } from '@/constants/urls';
import { useQuery, UseQueryResult } from '@tanstack/react-query';

export type UserBasicDetails = {
    id: string;
    name: string;
    face_file_id: string | null;
};

export const getUserBasicDetails = async (userIds: string[]) => {
    const response = await authenticatedAxiosInstance.post<UserBasicDetails[]>(
        `${GET_USER_BASIC_DETAILS}`,
        userIds
    );
    return response.data;
};

export const useGetUserBasicDetails = (
    userIds: string[]
): UseQueryResult<UserBasicDetails[], Error> => {
    return useQuery({
        queryKey: ['getUserBasicDetails', userIds],
        queryFn: () => getUserBasicDetails(userIds),
    });
};
