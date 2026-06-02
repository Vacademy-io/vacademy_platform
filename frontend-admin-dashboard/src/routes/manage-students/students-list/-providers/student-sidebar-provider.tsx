// StudentSidebarProvider.tsx
import { ReactNode, useCallback, useState } from 'react';
import { StudentSidebarContext } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { StudentTable } from '@/types/student-table-types';
import { StudentProfileOverlay } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-profile-overlay';

interface StudentSidebarProviderProps {
    children: ReactNode;
}

export const StudentSidebarProvider = ({ children }: StudentSidebarProviderProps) => {
    const [selectedStudent, setSelectedStudent] = useState<StudentTable | null>(null);
    const [isOverlayOpen, setIsOverlayOpen] = useState(false);

    const openOverlay = useCallback((student?: StudentTable) => {
        if (student) setSelectedStudent(student);
        setIsOverlayOpen(true);
    }, []);

    const closeOverlay = useCallback(() => {
        setIsOverlayOpen(false);
    }, []);

    const value = {
        selectedStudent,
        setSelectedStudent,
        isOverlayOpen,
        openOverlay,
        closeOverlay,
    };

    return (
        <StudentSidebarContext.Provider value={value}>
            {children}
            {/* Full-screen overlay — mounted once at the provider level so every
                consumer surface (manage-students, manage-contacts, audience-manager,
                admissions, assessments) gets the same overlay for free. */}
            <StudentProfileOverlay />
        </StudentSidebarContext.Provider>
    );
};
