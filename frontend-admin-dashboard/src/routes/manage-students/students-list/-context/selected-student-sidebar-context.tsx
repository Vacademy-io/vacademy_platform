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
    /**
     * Optional list-scope nav: lets the overlay's Prev/Next chevron group walk
     * through the surrounding learner list without closing. Tables that render
     * a list of learners can call `setLearnerList` on data change; the overlay
     * then derives the current index from `selectedStudent.user_id`.
     */
    learnerList: StudentTable[];
    setLearnerList: (list: StudentTable[]) => void;
    /** index, total — null when the selected learner isn't in the list. */
    learnerListPosition: { index: number; total: number } | null;
    goPrevLearner: () => void;
    goNextLearner: () => void;
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
