import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { useInfiniteQuery } from "@tanstack/react-query";
import { DoubtFilter, PaginatedDoubtResponse } from "../types/get-doubts-type";
import { GET_DOUBTS } from "@/constants/urls";

export const useGetDoubts = (filter: Omit<DoubtFilter, 'page_no' | 'page_size'>) => {
    return useInfiniteQuery({
        queryKey: ['GET_DOUBTS'],
        queryFn: async ({ pageParam = 0 }) => {
            const response = await authenticatedAxiosInstance.post<PaginatedDoubtResponse>(`${GET_DOUBTS}?pageNo=${pageParam}&pageSize=10`, {
                ...filter,
            });
            return response.data;
        },
        getNextPageParam: (lastPage) => {
            if (lastPage.last) return undefined;
            return lastPage.page_no + 1;
        },
        initialPageParam: 0
    });
}