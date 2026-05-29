/**
 * Build hooks — create a build + poll its status.
 *
 * useCreateBuild: POST /projects/{id}/builds → BuildResponse. Invalidates the
 * project detail cache so the builds list refreshes.
 * useStudioBuild: GET /builds/{id} with adaptive polling while PENDING/BUILDING.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createStudioBuild,
    getStudioBuild,
    type BuildResponse,
    type CreateBuildRequest,
} from '../services/studio-api';

interface UseCreateBuildOptions {
    apiKey: string | undefined;
    instituteId: string | undefined;
    projectId: string;
}

export function useCreateBuild({
    apiKey,
    instituteId,
    projectId,
}: UseCreateBuildOptions) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (req: CreateBuildRequest = {}) =>
            createStudioBuild(apiKey as string, projectId, req),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['studio-project', instituteId, projectId] });
            qc.invalidateQueries({ queryKey: ['studio-projects-list', instituteId] });
        },
    });
}

interface UseStudioBuildOptions {
    apiKey: string | undefined;
    buildId: string | undefined;
}

export function useStudioBuild({ apiKey, buildId }: UseStudioBuildOptions) {
    return useQuery({
        queryKey: ['studio-build', buildId, apiKey],
        enabled: !!apiKey && !!buildId,
        staleTime: 0,
        queryFn: () => getStudioBuild(apiKey as string, buildId as string),
        refetchInterval: (query) => {
            const data: BuildResponse | undefined = query.state.data;
            const active = data?.status === 'PENDING' || data?.status === 'BUILDING';
            return active ? 2_500 : false;
        },
    });
}
