import { useMutation } from '@tanstack/react-query';
import { LearnerInvitationType } from '../-types/create-invitation-types';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INVITE_DETAILS } from '@/constants/urls';

export const useGetInviteDetails = () => {
    return useMutation({
        mutationFn: async ({ learnerInvitationId }: { learnerInvitationId: string }) => {
            const response = await authenticatedAxiosInstance.get(
                `${GET_INVITE_DETAILS}?learnerInvitationId=${learnerInvitationId}`
            );
            return response.data as LearnerInvitationType;
        },
    });
};
