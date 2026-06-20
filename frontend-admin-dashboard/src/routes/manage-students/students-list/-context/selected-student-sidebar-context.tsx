import { createContext, useContext } from 'react';
import { StudentTable } from '@/types/student-table-types';

interface StudentSidebarContextType {
    selectedStudent: StudentTable | null;
    /**
     * Selects a learner. By default a fresh selection auto-opens the full-screen
     * Student Profile Overlay (the design's primary surface). Pass
     * `{ openOverlay: false }` to update the selection without opening the
     * overlay — used by the Details-column arrow, which opens the compact
     * side-view sheet instead.
     */
    setSelectedStudent: (
        student: StudentTable | null,
        options?: { openOverlay?: boolean }
    ) => void;
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
    /**
     * True when the sidebar/overlay is mounted over assessment submission data,
     * where the learner id lives in `selectedStudent.id` (the participant row)
     * rather than `selectedStudent.user_id`. Section components read this to pick
     * the right id; the overlay forwards it so its sections resolve the same data
     * the compact sheet shows. Undefined/false on the canonical students-list
     * surface, which keys off `user_id`.
     */
    isSubmissionTab?: boolean;
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
