import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { AUTOSUGGEST_USERS } from '@/constants/urls';
import { AutosuggestUser } from '../-types/bulk-assign-types';

const fetchAutoSuggestUsers = async ({
    instituteId,
    query,
    roles = ['STUDENT'],
}: {
    instituteId: string;
    query: string;
    roles?: string[];
}): Promise<AutosuggestUser[]> => {
    const params = new URLSearchParams({ instituteId, query });
    roles.forEach((r) => params.append('roles', r));
    const response = await authenticatedAxiosInstance.get<AutosuggestUser[]>(
        `${AUTOSUGGEST_USERS}?${params.toString()}`
    );
    return response.data;
};

export const useAutosuggestUsers = ({
    instituteId,
    query,
    roles = ['STUDENT'],
    enabled = true,
}: {
    instituteId: string;
    query: string;
    roles?: string[];
    enabled?: boolean;
}) => {
    return useQuery({
        queryKey: ['autosuggest-users', instituteId, query, roles],
        queryFn: () => fetchAutoSuggestUsers({ instituteId, query, roles }),
        enabled: enabled && !!instituteId && query.trim().length >= 2,
        staleTime: 30 * 1000,
    });
};
