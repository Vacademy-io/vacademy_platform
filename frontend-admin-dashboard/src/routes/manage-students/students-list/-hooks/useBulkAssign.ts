import { useMutation } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BULK_ASSIGN_LEARNERS } from '@/constants/urls';
import { BulkAssignRequest, BulkAssignResponse } from '../-types/bulk-assign-types';

const bulkAssignLearners = async (request: BulkAssignRequest): Promise<BulkAssignResponse> => {
    const response = await authenticatedAxiosInstance.post<BulkAssignResponse>(
        BULK_ASSIGN_LEARNERS,
        request
    );
    return response.data;
};

export const useBulkAssign = () => {
    return useMutation<BulkAssignResponse, Error, BulkAssignRequest>({
        mutationFn: bulkAssignLearners,
    });
};
