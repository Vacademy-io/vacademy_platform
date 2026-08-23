import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { ROADMAP_BASE_URL } from '@/constants/urls';

export interface RoadmapDto {
    htmlContent: string;
    updatedAt: string | null;
}

/**
 * Timestamp only — this is what the dock mounts on every page. The full roadmap
 * body is ~1MB and was being downloaded on every page load just to compare
 * updatedAt against the last-seen value and light up a dot.
 */
export function useRoadmapMeta() {
    return useQuery({
        queryKey: ['roadmap', 'meta'],
        queryFn: async () =>
            (await authenticatedAxiosInstance.get<RoadmapDto>(`${ROADMAP_BASE_URL}/current/meta`))
                .data,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Full roadmap body. Pass enabled=false until the panel is actually opened —
 * almost nobody opens it, so fetching it eagerly is close to pure waste.
 */
export function useRoadmap(enabled = true) {
    return useQuery({
        queryKey: ['roadmap'],
        queryFn: async () =>
            (await authenticatedAxiosInstance.get<RoadmapDto>(`${ROADMAP_BASE_URL}/current`)).data,
        staleTime: 5 * 60 * 1000,
        enabled,
    });
}
