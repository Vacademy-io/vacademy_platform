import { DoubtType } from '../-types/add-doubt-type';
import { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';
import { UseMutationResult } from '@tanstack/react-query';
import { AxiosResponse } from 'axios';

export const handleAddReply = async ({
    replyData,
    addReply,
    setReply,
    setShowInput,
    refetch,
    id,
}: {
    replyData: DoubtType;
    addReply: UseMutationResult<AxiosResponse<DoubtType>, Error, DoubtType>;
    setReply?: Dispatch<SetStateAction<string>>;
    setShowInput?: Dispatch<SetStateAction<boolean>>;
    refetch?: () => void;
    id?: string;
}) => {
    if (id) {
        replyData.id = id;
    }
    addReply.mutate(replyData, {
        onSuccess: () => {
            if (setReply) setReply('');
            if (setShowInput) setShowInput(false);
            if (refetch) refetch();
        },
        onError: () => {
            toast.error('Error adding doubt');
        },
    });
};
