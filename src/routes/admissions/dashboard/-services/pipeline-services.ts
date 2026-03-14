import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_PIPELINE_METRICS, GET_PIPELINE_USERS } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';
import type { PipelineMetrics, PipelineStage, PipelineUsersResponse } from '../-types/pipeline-types';

export const fetchPipelineMetrics = async (
    instituteId: string,
    packageSessionId?: string
): Promise<PipelineMetrics> => {
    const params: Record<string, string> = { instituteId };
    if (packageSessionId) {
        params.packageSessionId = packageSessionId;
    }
    const response = await authenticatedAxiosInstance.get(GET_PIPELINE_METRICS, { params });
    return response.data;
};

export const getPipelineMetricsQuery = (
    instituteId: string | undefined,
    packageSessionId?: string
) => ({
    queryKey: ['pipeline-metrics', instituteId, packageSessionId],
    queryFn: () => {
        if (!instituteId) throw new Error('Institute ID not found');
        return fetchPipelineMetrics(instituteId, packageSessionId);
    },
    enabled: !!instituteId,
    staleTime: 300000,
});

export const fetchPipelineUsers = async (
    instituteId: string,
    stage: PipelineStage,
    pageNo: number = 0,
    pageSize: number = 10,
    packageSessionId?: string
): Promise<PipelineUsersResponse> => {
    const params: Record<string, string | number> = { instituteId, stage, pageNo, pageSize };
    if (packageSessionId) {
        params.packageSessionId = packageSessionId;
    }
    const response = await authenticatedAxiosInstance.get(GET_PIPELINE_USERS, { params });
    return response.data;
};

export const getPipelineUsersQuery = (
    instituteId: string | undefined,
    stage: PipelineStage,
    pageNo: number,
    pageSize: number = 10,
    packageSessionId?: string
) => ({
    queryKey: ['pipeline-users', instituteId, stage, pageNo, pageSize, packageSessionId],
    queryFn: () => {
        if (!instituteId) throw new Error('Institute ID not found');
        return fetchPipelineUsers(instituteId, stage, pageNo, pageSize, packageSessionId);
    },
    enabled: !!instituteId,
});

export { getInstituteId };
