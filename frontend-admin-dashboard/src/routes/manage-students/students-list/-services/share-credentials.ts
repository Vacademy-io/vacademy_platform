import { SHARE_CREDENTIALS } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { useMutation } from '@tanstack/react-query';

export const useShareCredentials = () => {
    return useMutation({
        mutationFn: async ({ userIds }: { userIds: string[] }) => {
            return authenticatedAxiosInstance.post(SHARE_CREDENTIALS, userIds);
        },
    });
};
