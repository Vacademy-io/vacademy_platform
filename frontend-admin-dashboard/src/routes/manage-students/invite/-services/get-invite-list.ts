import { useQuery } from '@tanstack/react-query';
import { InviteFilterRequest, InviteListType } from '../-types/invite-link-types';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INVITE_LIST } from '@/constants/urls';

interface InviteListParams {
    instituteId: string;
    pageNo: number;
    pageSize: number;
    requestFilterBody: InviteFilterRequest;
}

export const useGetInviteList = ({
    instituteId,
    pageNo,
    pageSize,
    requestFilterBody,
}: InviteListParams) => {
    return useQuery({
        queryKey: ['inviteList', instituteId, pageNo, pageSize, requestFilterBody],
        queryFn: async () => {
            const response = await authenticatedAxiosInstance.post(
                `${GET_INVITE_LIST}?instituteId=${instituteId}&pageNo=${pageNo}&pageSize=${pageSize}`,
                requestFilterBody
            );
            return response.data as InviteListType;
        },
    });
};
