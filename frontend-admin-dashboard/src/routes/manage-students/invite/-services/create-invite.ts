import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CreateInvitationRequestType } from '../-types/create-invitation-types';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { CREATE_INVITATION } from '@/constants/urls';

export const useCreateInvite = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ requestBody }: { requestBody: CreateInvitationRequestType }) => {
            return authenticatedAxiosInstance.post(`${CREATE_INVITATION}`, requestBody);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inviteList'] });
        },
    });
};
