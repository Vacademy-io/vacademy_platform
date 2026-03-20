import { createContext, useContext } from 'react';
import { StudentTable } from '@/types/student-table-types';
interface StudentSidebarContextType {
    selectedStudent: StudentTable | null;
    setSelectedStudent: (student: StudentTable | null) => void;
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
