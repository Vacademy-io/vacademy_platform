import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { useInfiniteQuery } from '@tanstack/react-query';
import { DoubtFilter, PaginatedDoubtResponse } from '../-types/get-doubts-type';
import { GET_DOUBTS } from '@/constants/urls';

// Stable, primitive queryKey. The previous form was `['GET_DOUBTS', filter]`,
// where `filter` is whatever object the caller passes in. React Query
// reference-compares array entries, so any time the caller produced a fresh
// object literal — typical in a parent component that does `setFilter({...})`
// inside a useEffect keyed on a churning value — the queryKey looked "new"
// and the hook auto-refetched. Live in DoubtResolutionSidebar that meant one
// refetch per admin keystroke (the chapter-sidebar store mutates `activeItem`
// on every autosave, which fires a useEffect that produces a new filter).
//
// Picking only the fields that actually distinguish a query keeps the key
// stable across the parent's irrelevant re-renders. The payload still POSTs
// the whole filter so the backend keeps full filter semantics.
export const useGetDoubts = (
    filter: Omit<DoubtFilter, 'page_no' | 'page_size'>,
    enabled: boolean = true,
) => {
    return useInfiniteQuery({
        queryKey: [
            'GET_DOUBTS',
            filter.source_ids?.[0] ?? '',
            filter.content_types?.[0] ?? '',
            filter.batch_ids?.[0] ?? '',
            filter.status?.join(',') ?? '',
            filter.start_date,
            filter.end_date,
            filter.name ?? '',
        ],
        enabled,
        queryFn: async ({ pageParam = 0 }) => {
            const response = await authenticatedAxiosInstance.post<PaginatedDoubtResponse>(
                `${GET_DOUBTS}?pageNo=${pageParam}&pageSize=10`,
                { ...filter }
            );
            return response.data;
        },
        getNextPageParam: (lastPage) => {
            if (lastPage.last) return undefined;
            return lastPage.page_no + 1;
        },
        initialPageParam: 0,
    });
};
