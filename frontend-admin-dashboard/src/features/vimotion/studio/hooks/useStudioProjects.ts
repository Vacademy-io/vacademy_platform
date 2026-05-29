/**
 * TanStack Query hooks for the Studio projects + builds surface.
 *
 * Mirrors the polling discipline from useReelsList — adaptive `refetchInterval`
 * while any project is mid-build, halted on terminal states. The list cache
 * key is keyed on the institute + apiKey so a tenant switch invalidates.
 *
 * All mutations invalidate the relevant query keys + return the parsed
 * response, so callers can route on the returned id.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createStudioProject,
    deleteStudioProject,
    getStudioProject,
    listStudioProjects,
    updateStudioProject,
    type CreateProjectRequest,
    type ListProjectsParams,
    type ProjectResponse,
    type ProjectSummary,
    type UpdateProjectRequest,
} from '../services/studio-api';

const KEYS = {
    list: (instituteId: string | undefined, params: ListProjectsParams) =>
        ['studio-projects-list', instituteId, params] as const,
    detail: (instituteId: string | undefined, projectId: string | undefined) =>
        ['studio-project', instituteId, projectId] as const,
};

interface UseStudioProjectsListOptions {
    apiKey: string | undefined;
    instituteId: string | undefined;
    params?: ListProjectsParams;
}

/** Paginated list of projects with adaptive polling while any are BUILDING. */
export function useStudioProjectsList({
    apiKey,
    instituteId,
    params = {},
}: UseStudioProjectsListOptions) {
    return useQuery({
        queryKey: KEYS.list(instituteId, params),
        enabled: !!apiKey,
        staleTime: 15_000,
        queryFn: () => listStudioProjects(apiKey as string, params),
        refetchInterval: (query) => {
            const data: ProjectSummary[] | undefined = query.state.data;
            const hasActive = data?.some(
                (p) => p.status === 'BUILDING' || p.status === 'PLANNING'
            );
            return hasActive ? 5_000 : false;
        },
    });
}

interface UseStudioProjectOptions {
    apiKey: string | undefined;
    instituteId: string | undefined;
    projectId: string | undefined;
}

/** Full project record with adaptive polling while it's BUILDING. */
export function useStudioProject({
    apiKey,
    instituteId,
    projectId,
}: UseStudioProjectOptions) {
    return useQuery({
        queryKey: KEYS.detail(instituteId, projectId),
        enabled: !!apiKey && !!projectId,
        staleTime: 0,
        queryFn: () => getStudioProject(apiKey as string, projectId as string),
        refetchInterval: (query) => {
            const data: ProjectResponse | undefined = query.state.data;
            const hasActiveBuild = data?.builds?.some(
                (b) => b.status === 'PENDING' || b.status === 'BUILDING'
            );
            return hasActiveBuild ? 5_000 : false;
        },
    });
}

interface UseCreateStudioProjectOptions {
    apiKey: string | undefined;
    instituteId: string | undefined;
}

/** POST /projects mutation; invalidates the list cache for this institute. */
export function useCreateStudioProject({
    apiKey,
    instituteId,
}: UseCreateStudioProjectOptions) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (request: CreateProjectRequest) =>
            createStudioProject(apiKey as string, request),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['studio-projects-list', instituteId] });
        },
    });
}

interface UseUpdateStudioProjectOptions {
    apiKey: string | undefined;
    instituteId: string | undefined;
    projectId: string | undefined;
}

/** PATCH /projects/{id} mutation; updates both list and detail caches. */
export function useUpdateStudioProject({
    apiKey,
    instituteId,
    projectId,
}: UseUpdateStudioProjectOptions) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (request: UpdateProjectRequest) =>
            updateStudioProject(apiKey as string, projectId as string, request),
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ['studio-projects-list', instituteId] });
            qc.setQueryData(KEYS.detail(instituteId, projectId), data);
        },
    });
}

interface UseDeleteStudioProjectOptions {
    apiKey: string | undefined;
    instituteId: string | undefined;
}

/** DELETE /projects/{id} mutation (soft-delete → ARCHIVED). */
export function useDeleteStudioProject({
    apiKey,
    instituteId,
}: UseDeleteStudioProjectOptions) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (projectId: string) =>
            deleteStudioProject(apiKey as string, projectId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['studio-projects-list', instituteId] });
        },
    });
}
