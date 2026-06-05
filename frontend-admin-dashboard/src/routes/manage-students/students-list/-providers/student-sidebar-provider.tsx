// StudentSidebarProvider.tsx
import { ReactNode, useCallback, useState } from 'react';
import { StudentSidebarContext } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { StudentTable } from '@/types/student-table-types';
import { StudentProfileOverlay } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-profile-overlay';

interface StudentSidebarProviderProps {
    children: ReactNode;
}

export const StudentSidebarProvider = ({ children }: StudentSidebarProviderProps) => {
    const [selectedStudent, _setSelectedStudent] = useState<StudentTable | null>(null);
    const [isOverlayOpen, setIsOverlayOpen] = useState(false);

    /**
     * Setting a NEW student (different user_id than the currently selected one)
     * automatically opens the fullscreen overlay, which is the design's primary
     * surface per the Vacademy Learner Profile handoff. Refreshing the same
     * student (same user_id, fresh data) does NOT re-open the overlay — so
     * the user closing the overlay stays closed even if a query refresh
     * re-emits the selection. Passing null clears + closes.
     */
    const setSelectedStudent = useCallback((student: StudentTable | null) => {
        _setSelectedStudent((prev) => {
            if (!student) {
                setIsOverlayOpen(false);
                return null;
            }
            const isFreshSelection = prev?.user_id !== student.user_id;
            if (isFreshSelection) setIsOverlayOpen(true);
            return student;
        });
    }, []);

    const openOverlay = useCallback((student?: StudentTable) => {
        if (student) _setSelectedStudent(student);
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
