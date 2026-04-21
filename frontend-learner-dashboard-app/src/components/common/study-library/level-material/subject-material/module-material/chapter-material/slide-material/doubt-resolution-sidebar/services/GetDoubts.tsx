import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { useInfiniteQuery } from "@tanstack/react-query";
import { DoubtFilter, PaginatedDoubtResponse } from "../types/get-doubts-type";
import { GET_DOUBTS } from "@/constants/urls";

export const useGetDoubts = (filter: Omit<DoubtFilter, "page_no" | "page_size">) => {
    return useInfiniteQuery({
        // Include filter in the queryKey so React Query treats each filter variation as its own
        // cached dataset — otherwise switching tabs (All / Resolved / Pending) or slide can serve
        // stale pages from the previous filter.
        queryKey: ["GET_DOUBTS", filter],
        queryFn: async ({ pageParam = 0 }) => {
            const response = await authenticatedAxiosInstance.post<PaginatedDoubtResponse>(
                `${GET_DOUBTS}?pageNo=${pageParam}&pageSize=10`,
                {
                    ...filter,
                }
            );
            return response.data;
        },
        getNextPageParam: (lastPage) => {
            if (lastPage.last) return undefined;
            return lastPage.page_no + 1;
        },
        initialPageParam: 0,
        enabled: (filter.source_ids?.length ?? 0) > 0,
    });
};
