import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_DOUBTS } from '@/constants/urls';
import {
    getUserId,
    getInstituteId,
} from '@/utils/study-library/get-list-from-stores/getPackageSessionId';
import { Doubt } from '@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/doubt-resolution-sidebar/types/get-doubts-type';

export const MY_QUERIES_QUERY_KEY = ['MY_QUERIES'];

interface MyQueriesPage {
    content: Doubt[];
    total_elements: number;
}

/**
 * Fetches the learner's doubts + queries (slide doubts and GENERAL queries) with replies nested.
 * The backend viewer-scopes STUDENT callers to `d.user_id = me`, so no source/batch narrowing is
 * needed — but the raised_time BETWEEN predicate requires concrete dates (null ⇒ zero rows), so we
 * always send a wide range. `institute_id` keeps a multi-institute learner from seeing both
 * institutes' threads mixed.
 */
const fetchMyQueries = async (instituteId: string | null): Promise<MyQueriesPage> => {
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 2);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 1);

    const response = await authenticatedAxiosInstance.post<MyQueriesPage>(
        `${GET_DOUBTS}?pageNo=0&pageSize=50`,
        {
            name: '',
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            user_ids: [],
            content_positions: [],
            content_types: [],
            sources: [],
            source_ids: [],
            status: ['ACTIVE', 'RESOLVED'],
            batch_ids: [],
            institute_id: instituteId ?? '',
            sort_columns: { raised_time: 'DESC' },
        }
    );
    return response.data;
};

export const useMyQueries = (enabled: boolean = true) => {
    // Resolve identity on mount (async storage read) so the query key can be user-scoped — without
    // this, a static ['MY_QUERIES'] key would leak user A's queries to user B after a logout/login
    // on a shared device.
    const [identity, setIdentity] = useState<{ userId: string | null; instituteId: string | null }>(
        { userId: null, instituteId: null }
    );
    useEffect(() => {
        let active = true;
        (async () => {
            const [userId, instituteId] = await Promise.all([getUserId(), getInstituteId()]);
            if (active) setIdentity({ userId, instituteId });
        })();
        return () => {
            active = false;
        };
    }, []);

    const query = useQuery({
        queryKey: [...MY_QUERIES_QUERY_KEY, identity.userId],
        queryFn: () => fetchMyQueries(identity.instituteId),
        enabled: enabled && !!identity.userId,
        retry: 1,
        staleTime: 60 * 1000,
    });

    const queries = query.data?.content ?? [];
    const openCount = queries.filter((q) => q.status !== 'RESOLVED').length;

    return { ...query, queries, openCount, isLoading: query.isLoading, isError: query.isError };
};
