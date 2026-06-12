import { useDoubtFilters } from '../-stores/filter-store';
import { useGetDoubtList } from '../-services/get-doubt-list';
import { useState } from 'react';
import { useGetUserBasicDetails, UserBasicDetails } from '@/services/get_user_basic_details';
export const useDoubtTable = () => {
    const { filters } = useDoubtFilters();

    const [currentPage, setCurrentPage] = useState(0);

    const {
        data: doubts,
        isLoading,
        refetch,
        error,
    } = useGetDoubtList({ filter: filters, pageNo: currentPage, pageSize: 10 });

    // Guest queries have a null user_id — drop falsy ids (and dedupe) so we never POST nulls to
    // auth_service (findAllById forbids null elements) or pollute the query cache key.
    const userIds = [
        ...new Set((doubts?.content ?? []).map((doubt) => doubt.user_id).filter(Boolean)),
    ];
    const { data: userDetails } = useGetUserBasicDetails(userIds);
    const userDetailsRecord: Record<string, UserBasicDetails> =
        userDetails?.reduce(
            (acc, curr) => {
                acc[curr.id] = curr;
                return acc;
            },
            {} as Record<string, UserBasicDetails>
        ) || {};

    return { currentPage, setCurrentPage, doubts, isLoading, error, refetch, userDetailsRecord };
};
