import { useState, useEffect } from 'react';
import { ContactListRequest, ContactUser } from '../-types/contact-types';
import { useContactList } from '../-services/getContactTable';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { StudentTable } from '@/types/student-table-types';

export const useContactTable = (
    appliedFilters: ContactListRequest,
    onFiltersUpdate: (newFilters: ContactListRequest) => void
) => {
    const { setSelectedStudent, selectedStudent } = useStudentSidebar();

    // We update page in appliedFilters directly in this implementation, 
    // but we can keep local state if needed.
    // appliedFilters has page and size.

    const {
        data: contactTableData,
        isLoading,
        error,
        refetch,
    } = useContactList(appliedFilters);

    useEffect(() => {
        // Sync selected student if data refreshes and still exists?
        // Actually StudentTable implementation mainly ensures checks if selected student is in current list.
        // For now we might not strictly need this as sidebar is separate.
    }, [contactTableData]);

    const handleSort = (columnId: string, direction: string) => {
        onFiltersUpdate({
            ...appliedFilters,
            sort_by: columnId,
            sort_direction: direction.toUpperCase() as 'ASC' | 'DESC',
        });
    };

    const handlePageChange = (newPage: number) => {
        onFiltersUpdate({
            ...appliedFilters,
            page: newPage,
        });
    };

    return {
        contactTableData,
        isLoading,
        error,
        refetch,
        handleSort,
        handlePageChange,
        page: appliedFilters.page,
    };
};
