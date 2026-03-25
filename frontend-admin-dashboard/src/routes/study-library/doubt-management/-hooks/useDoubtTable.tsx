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

    const userIds = doubts?.content.map((doubt) => doubt.user_id);
    const { data: userDetails } = useGetUserBasicDetails(userIds || []);
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
