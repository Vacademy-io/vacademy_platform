import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { fetchFacultyList, FacultyFilterParams, fetchFacultyCreatorsByInstitute } from '../-services/dashboard-services';
import { PaginatedFacultyResponse } from '../-types/faculty-list-type';

export const useTeacherList = (
    instituteId: string,
    pageNo: number = 0,
    pageSize: number = 10,
    filters: FacultyFilterParams = {},
    enabled: boolean = true
): UseQueryResult<PaginatedFacultyResponse> => {
    return useQuery({
        queryKey: ['facultyList', instituteId, pageNo, pageSize, filters],
        queryFn: () => fetchFacultyList(instituteId, pageNo, pageSize, filters),
        enabled,
    });
};

// Add hook for faculty creators specifically
export const useFacultyCreatorsList = (instituteId: string, enabled: boolean = true) => {
    return useQuery({
        queryKey: ['facultyCreatorsList', instituteId],
        queryFn: () => fetchFacultyCreatorsByInstitute(instituteId),
        enabled: Boolean(enabled && instituteId),
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
    });
};
