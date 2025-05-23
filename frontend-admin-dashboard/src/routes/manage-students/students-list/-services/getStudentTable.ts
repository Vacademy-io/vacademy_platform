import { useQuery } from '@tanstack/react-query';
import { StudentFilterRequest, StudentListResponse } from '@/types/student-table-types';
import { GET_STUDENTS } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

interface FetchStudentsParams {
    pageNo?: number;
    pageSize?: number;
    filters: StudentFilterRequest;
}

export const fetchStudents = async ({
    pageNo = 0,
    pageSize = 10,
    filters,
}: FetchStudentsParams): Promise<StudentListResponse> => {
    const response = await authenticatedAxiosInstance.post<StudentListResponse>(
        `${GET_STUDENTS}?pageNo=${pageNo}&pageSize=${pageSize}`,
        filters
    );
    return response.data;
};

// React Query hook
export const useStudentList = (
    filters: StudentFilterRequest,
    pageNo?: number,
    pageSize?: number
) => {
    return useQuery({
        queryKey: ['students', pageNo, pageSize, filters],
        queryFn: () => fetchStudents({ pageNo, pageSize, filters }),
        enabled: true, // Change this to true
        refetchOnWindowFocus: false,
        staleTime: 1000 * 5,
    });
};
