import { ADD_DOUBT } from '@/constants/urls';
import { DoubtType } from '../-types/add-doubt-type';
import { useMutation } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { useQueryClient } from '@tanstack/react-query';

export const useAddReply = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (reply: DoubtType) => {
            if (reply.id != undefined) {
                return authenticatedAxiosInstance.post(`${ADD_DOUBT}?doubtId=${reply.id}`, reply);
            } else {
                return authenticatedAxiosInstance.post(ADD_DOUBT, reply);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['GET_DOUBTS'] });
        },
    });
};
