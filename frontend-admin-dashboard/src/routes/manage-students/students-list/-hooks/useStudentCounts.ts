import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StudentFilterRequest } from '@/types/student-table-types';
import { fetchStudents } from '../-services/getStudentTable';

// Counts shown in the learner-list header badges. They mirror the table's
// non-status filters (session/search/batch/etc.) but deliberately ignore any
// status filter, so the Active/Inactive split stays visible regardless of which
// status the admin has filtered to. Each count is a pageSize=1 request — we only
// read `total_elements`.
export interface StudentCounts {
    total: number;
    active: number;
    inactive: number;
    isLoading: boolean;
}

const COUNT_PAGE_SIZE = 1;
const fetchCount = (filters: StudentFilterRequest) =>
    fetchStudents({ pageNo: 0, pageSize: COUNT_PAGE_SIZE, filters }).then((r) => r.total_elements);

export const useStudentCounts = (
    appliedFilters: StudentFilterRequest,
    enabled = true
): StudentCounts => {
    // Strip the status filter so the badges always reflect the full breakdown.
    const baseFilters = useMemo(() => {
        const rest = { ...appliedFilters };
        delete rest.statuses;
        return rest;
    }, [appliedFilters]);

    const baseKey = useMemo(() => JSON.stringify(baseFilters), [baseFilters]);

    const queryOptions = {
        enabled,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        staleTime: 1000 * 30,
        gcTime: 1000 * 60 * 5,
    } as const;

    const totalQuery = useQuery({
        queryKey: ['student-count', 'total', baseKey],
        queryFn: () => fetchCount(baseFilters),
        ...queryOptions,
    });

    const activeQuery = useQuery({
        queryKey: ['student-count', 'active', baseKey],
        queryFn: () => fetchCount({ ...baseFilters, statuses: ['ACTIVE'] }),
        ...queryOptions,
    });

    const inactiveQuery = useQuery({
        queryKey: ['student-count', 'inactive', baseKey],
        queryFn: () => fetchCount({ ...baseFilters, statuses: ['INACTIVE'] }),
        ...queryOptions,
    });

    return {
        total: totalQuery.data ?? 0,
        active: activeQuery.data ?? 0,
        inactive: inactiveQuery.data ?? 0,
        isLoading: totalQuery.isLoading || activeQuery.isLoading || inactiveQuery.isLoading,
    };
};
