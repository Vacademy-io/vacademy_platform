import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_DOUBTS } from '@/constants/urls';
import { PaginatedDoubtResponse } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-types/get-doubts-type';
import { DoubtFilter } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-types/get-doubts-type';
import { useQuery } from '@tanstack/react-query';

export const useGetDoubtList = ({
    filter,
    pageNo,
    pageSize,
}: {
    filter: DoubtFilter;
    pageNo: number;
    pageSize: number;
}) => {
    return useQuery({
        queryKey: ['GET_DOUBTS', filter, pageNo, pageSize],
        queryFn: async ({ pageParam = pageNo }) => {
            const response = await authenticatedAxiosInstance.post<PaginatedDoubtResponse>(
                `${GET_DOUBTS}?pageNo=${pageParam}&pageSize=${pageSize}`,
                { ...filter }
            );
            return response.data;
        },
        enabled: !!filter,
    });
};
