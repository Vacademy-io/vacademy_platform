import { useState, useEffect } from 'react';
import { StudentFilterRequest } from '@/types/student-table-types';
import { useStudentList } from '@/routes/manage-students/students-list/-services/getStudentTable';
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

    // If the URL pinned a specific package_session_id, honour it. Otherwise leave
    // package_session_ids empty — the backend's combined query returns institute users
    // + audience-only respondents by default, and a synthetic all-batches filter would
    // gate audience-only users out.
    if (
        appliedFilters.package_session_ids?.length == 0 &&
        package_session_id &&
        package_session_id.length > 0
    ) {
        localAppliedFilters = {
            ...appliedFilters,
            package_session_ids: package_session_id,
        };
    }

    const {
        data: studentTableData,
        isLoading,
        error,
        refetch,
    } = useStudentList(localAppliedFilters, page, pageSize);

    // Update selected student when data changes
    useEffect(() => {
        if (selectedStudent && studentTableData?.content) {
            const student = studentTableData.content.find(
                (student) => student.user_id === selectedStudent.user_id
            );
            if (student) {
                setSelectedStudent(student);
            }
        }
    }, [studentTableData?.content]);

    // NOTE: We removed the useEffect that called refetch() on filter changes
    // React Query's queryKey already handles this - when the key changes, 
    // it automatically fetches new data. The extra refetch() was causing duplicate API calls.

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
        // No need to call refetch() - changing page will change the queryKey
        // which automatically triggers a new fetch
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
