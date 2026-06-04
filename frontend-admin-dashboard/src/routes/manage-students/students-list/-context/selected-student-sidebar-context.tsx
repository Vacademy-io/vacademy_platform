import { createContext, useContext } from 'react';
import { StudentTable } from '@/types/student-table-types';

interface StudentSidebarContextType {
    selectedStudent: StudentTable | null;
    setSelectedStudent: (student: StudentTable | null) => void;
    /** Whether the full-screen Student Profile Overlay is open. */
    isOverlayOpen: boolean;
    /** Open the overlay. Pass a student to set selection + open in one call;
     *  pass nothing to open with whatever is currently selected. */
    openOverlay: (student?: StudentTable) => void;
    closeOverlay: () => void;
}

export const StudentSidebarContext = createContext<StudentSidebarContextType | undefined>(
    undefined
);

export const useStudentSidebar = () => {
    const context = useContext(StudentSidebarContext);
    if (!context) {
        throw new Error('useStudentSidebar must be used within a StudentSidebarProvider');
    }
    return context;
};
