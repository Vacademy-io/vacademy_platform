import { UPDATE_INVITE_LINK_STATUS } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useUpdateInviteLinkStatus = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            requestBody,
        }: {
            requestBody: { learner_invitation_ids: string[]; status: string };
        }) => {
            return authenticatedAxiosInstance.put(`${UPDATE_INVITE_LINK_STATUS}`, requestBody);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inviteList'] });
        },
    });
};
