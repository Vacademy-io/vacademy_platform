import { useInfiniteQuery } from '@tanstack/react-query';
import { FilterRequestType, GetResponseListType } from '../-types/enroll-request-types';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { ENROLL_REQUESTS } from '@/constants/urls';

interface EnrollRequestParamType {
    instituteId: string;
    pageNo: number;
    pageSize: number;
    filterRequest: FilterRequestType;
}

export const useGetEnrollRequests = ({
    instituteId,
    pageNo,
    pageSize,
    filterRequest,
}: EnrollRequestParamType) => {
    return useInfiniteQuery<GetResponseListType | null>({
        queryKey: ['enrollRequestList', instituteId, pageNo, pageSize, filterRequest],
        queryFn: async ({ pageParam }) => {
            const response = await authenticatedAxiosInstance.post(
                `${ENROLL_REQUESTS}?instituteId=${instituteId}&pageNo=${pageParam}&pageSize=${pageSize}`,
                filterRequest
            );
            return response.data;
        },
        initialPageParam: pageNo,
        getNextPageParam: (lastPage) => {
            // If lastPage is null or undefined, or if we're on the last page or there's no content, don't get another page
            if (!lastPage || lastPage.last || lastPage.empty) return undefined;

            // Return the next page number, with a fallback to current page + 1 if pageable structure is missing
            return lastPage.pageable?.pageNumber !== undefined
                ? lastPage.pageable.pageNumber + 1
                : pageNo + 1;
        },
    });
};
