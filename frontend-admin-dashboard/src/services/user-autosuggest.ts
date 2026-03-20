import { GET_USER_AUTOSUGGEST } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

// User DTO Interface based on API documentation
export interface UserDTO {
    id: string;
    username: string;
    email: string;
    full_name: string;
    mobile_number?: string;
    roles?: string[];
    // Add other fields as needed based on your actual API response
}

// Request parameters for autosuggest
export interface UserAutosuggestParams {
    instituteId?: string; // Optional - will use current institute if not provided
    query: string; // Search string for name, email, or phone
    roles?: string[]; // Optional role filter (e.g., ['STUDENT', 'TEACHER'])
}

/**
 * Fetches autosuggest users from the API
 * Searches by name, email, or phone number with optional role filtering
 * Returns max 10 results, ordered by full_name ascending
 */
export async function fetchAutosuggestUsers(params: UserAutosuggestParams): Promise<UserDTO[]> {
    const instituteId = params.instituteId || getCurrentInstituteId();

    const { data } = await authenticatedAxiosInstance<UserDTO[]>({
        method: 'GET',
        url: GET_USER_AUTOSUGGEST,
        params: {
            instituteId,
            query: params.query,
            roles: params.roles?.join(','), // Convert array to comma-separated string
        },
    });

    return data;
}

/**
 * React Query hook for user autosuggest
 * @param query - Search string (required)
 * @param roles - Optional array of role names to filter by
 * @param enabled - Whether the query should run (default: true, but disabled if query is empty)
 */
export function useUserAutosuggest(
    query: string,
    roles?: string[],
    options?: {
        enabled?: boolean;
        instituteId?: string;
    }
) {
    const enabled = options?.enabled !== undefined ? options.enabled : query.length > 0;

    return useQuery({
        queryKey: ['user-autosuggest', query, roles, options?.instituteId],
        queryFn: () =>
            fetchAutosuggestUsers({
                query,
                roles,
                instituteId: options?.instituteId,
            }),
        enabled,
        staleTime: 30000, // 30 seconds - reasonable for user data
        gcTime: 60000, // 1 minute garbage collection time
    });
}

/**
 * Hook for autocomplete/dropdown use cases with debouncing
 * @param query - Search string
 * @param roles - Optional role filter
 * @param debounceMs - Debounce delay in milliseconds (default: 300ms)
 */
export function useUserAutosuggestDebounced(
    query: string,
    roles?: string[],
    debounceMs: number = 300,
    options?: {
        enabled?: boolean;
        instituteId?: string;
    }
) {
    const [debouncedQuery, setDebouncedQuery] = useState(query);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [query, debounceMs]);

    return useUserAutosuggest(debouncedQuery, roles, options);
}

// Common role constants for convenience
export const USER_ROLES = {
    STUDENT: 'STUDENT',
    TEACHER: 'TEACHER',
    ADMIN: 'ADMIN',
    COUNSELLOR: 'COUNSELLOR',
    PARENT: 'PARENT',
} as const;
