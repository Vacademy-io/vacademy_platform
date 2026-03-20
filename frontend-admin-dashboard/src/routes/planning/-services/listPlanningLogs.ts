import { useQuery, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { LIST_PLANNING_LOGS } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';
import type {
    ListPlanningLogsRequest,
    ListPlanningLogsResponse,
} from '../-types/types';

interface UseListPlanningLogsOptions {
    pageNo?: number;
    pageSize?: number;
    filters?: ListPlanningLogsRequest;
    enabled?: boolean;
}

const CACHE_TIME = 2 * 60 * 1000; // 2 minutes in milliseconds

export const useListPlanningLogs = ({
    pageNo = 0,
    pageSize = 10,
    filters = {},
    enabled = true,
}: UseListPlanningLogsOptions = {}) => {
    return useQuery({
        queryKey: ['planning-logs', pageNo, pageSize, filters],
        queryFn: async () => {
            const instituteId = getInstituteId();
            const response = await authenticatedAxiosInstance.post<ListPlanningLogsResponse>(
                LIST_PLANNING_LOGS,
                filters,
                {
                    params: {
                        instituteId,
                        pageNo,
                        pageSize,
                    },
                }
            );
            return response.data;
        },
        enabled,
        staleTime: CACHE_TIME,
        gcTime: CACHE_TIME,
    });
};

// Hook to invalidate planning logs cache
export const useInvalidatePlanningLogs = () => {
    const queryClient = useQueryClient();
    
    return () => {
        queryClient.invalidateQueries({ queryKey: ['planning-logs'] });
    };
};
