import { useState, useEffect } from 'react';
import { StudentFilterRequest } from '@/types/student-table-types';
import { useStudentList } from '@/routes/manage-students/students-list/-services/getStudentTable';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useStudentSidebar } from '../-context/selected-student-sidebar-context';

export const useStudentTable = (
    appliedFilters: StudentFilterRequest,
    onFiltersUpdate: (newFilters: StudentFilterRequest) => void,
    package_session_id?: string[] | null
) => {
    const [page, setPage] = useState(0);
    const pageSize = 10;
    const [sortColumns, setSortColumns] = useState<Record<string, string>>({});
    const { selectedStudent, setSelectedStudent } = useStudentSidebar();

    let localAppliedFilters = appliedFilters;
    const { instituteDetails } = useInstituteDetailsStore();

    if (appliedFilters.package_session_ids?.length == 0) {
        if (package_session_id && package_session_id != null && package_session_id.length > 0) {
            localAppliedFilters = {
                ...appliedFilters,
                package_session_ids: package_session_id,
            };
        } else {
            const psids: string[] =
                instituteDetails?.batches_for_sessions.map((batch) => batch.id) || [];
            localAppliedFilters = {
                ...appliedFilters,
                package_session_ids: psids,
            };
        }
    }

    const {
        data: studentTableData,
        isLoading,
        error,
        refetch,
    } = useStudentList(localAppliedFilters, page, pageSize);

    useEffect(() => {
        if (selectedStudent) {
            const student = studentTableData?.content.find(
                (student) => student.user_id === selectedStudent.user_id
            );
            if (student) {
                setSelectedStudent(student);
            } else {
                setSelectedStudent(student || null);
            }
        }
    }, [studentTableData]);

    useEffect(() => {
        // Only refetch if there are actual filters applied
        if (
            appliedFilters.name ||
            appliedFilters.gender?.length ||
            appliedFilters.statuses?.length ||
            appliedFilters.package_session_ids?.length
        ) {
            refetch();
        }
    }, [appliedFilters, refetch]);

    const handleSort = async (columnId: string, direction: string) => {
        const newSortColumns = {
            [columnId]: direction,
        };
        setSortColumns(newSortColumns);
        onFiltersUpdate({
            ...appliedFilters,
            sort_columns: newSortColumns,
        });
    };

    const handlePageChange = async (newPage: number) => {
        setPage(newPage);
        await refetch();
    };

    return {
        studentTableData,
        isLoading,
        error,
        page,
        sortColumns,
        refetch,
        handleSort,
        handlePageChange,
    };
};
