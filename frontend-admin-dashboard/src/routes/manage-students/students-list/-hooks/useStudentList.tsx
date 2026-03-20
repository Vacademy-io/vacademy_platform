import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { StudentFilterRequest, StudentListResponse } from '@/types/student-table-types';
import { fetchStudents } from '@/routes/manage-students/students-list/-services/getStudentTable';

export const useStudentList = (
    filters: StudentFilterRequest,
    pageNo?: number,
    pageSize?: number
): UseQueryResult<StudentListResponse> => {
    return useQuery<StudentListResponse>({
        queryKey: ['students', pageNo, pageSize, filters],
        queryFn: () => fetchStudents({ pageNo, pageSize, filters }),
    });
};
