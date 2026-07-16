import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { ROADMAP_BASE_URL } from '@/constants/urls';

export interface RoadmapDto {
    htmlContent: string;
    updatedAt: string | null;
}

export function useRoadmap() {
    return useQuery({
        queryKey: ['roadmap'],
        queryFn: async () =>
            (await authenticatedAxiosInstance.get<RoadmapDto>(`${ROADMAP_BASE_URL}/current`)).data,
        staleTime: 5 * 60 * 1000,
    });
}
