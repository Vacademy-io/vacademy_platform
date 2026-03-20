import { useMutation, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { UPDATE_INVITE_URL } from '@/constants/urls';

export const useUpdateInvite = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ requestBody }: { requestBody: unknown }) => {
            return authenticatedAxiosInstance.put(`${UPDATE_INVITE_URL}`, requestBody);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inviteList'] });
            queryClient.invalidateQueries({ queryKey: ['GET_INVITE_LINKS'] });
        },
    });
};
