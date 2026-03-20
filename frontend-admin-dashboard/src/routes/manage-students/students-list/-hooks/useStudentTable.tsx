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

    // Check if we have approval statuses that require global search (empty package_session_ids)
    const hasApprovalStatus = appliedFilters.statuses?.some(s =>
        ['INVITED', 'PENDING_FOR_APPROVAL'].includes(s)
    );

    // Check if ABANDONED_CART type is selected (requires empty package_session_ids)
    const isAbandonedCart = appliedFilters.type === 'ABANDONED_CART';

    // Only override empty package_session_ids if NOT searching for approval statuses or ABANDONED_CART
    if (appliedFilters.package_session_ids?.length == 0 && !hasApprovalStatus && !isAbandonedCart) {
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
