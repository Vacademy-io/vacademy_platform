// ControlledStudentSidebarProvider.tsx
import { ReactNode, useCallback, useMemo, useState } from 'react';
import { StudentSidebarContext } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { StudentTable } from '@/types/student-table-types';
import { StudentProfileOverlay } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-profile-overlay';
import { getInstituteId } from '@/constants/helper';

interface ControlledStudentSidebarProviderProps {
    /** Externally-owned current selection — the host page keeps this in its own state. */
    selectedStudent: StudentTable | null;
    /** Externally-owned selection setter — the host page's state setter. */
    setSelectedStudent: (student: StudentTable | null) => void;
    /**
     * Forwarded to the overlay so its section components resolve the learner id
     * from `selectedStudent.id` (the participant row) the same way the compact
     * sheet does on assessment submission surfaces. Defaults to false.
     */
    isSubmissionTab?: boolean;
    children: ReactNode;
}

/**
 * A lighter StudentSidebarContext provider for surfaces that already own the
 * selected student in their own state — the assessment / homework submission
 * tabs, whose tables drive selection via `setSelectedStudent` and open the
 * compact sheet through the ShadCN `useSidebar` state.
 *
 * The canonical `StudentSidebarProvider` owns selection internally, so dropping
 * it in here would desync from that existing wiring. This wrapper instead
 * *adopts* the host's selection and only adds the full-screen overlay capability
 * — `openOverlay` / `closeOverlay` plus the mounted `StudentProfileOverlay` — so
 * the "Open full profile" (⤢) button in the side sheet works on these pages too,
 * instead of being hidden (or, before the guard, crashing with
 * `openOverlay is not a function`).
 *
 * List-scoped Prev/Next nav is intentionally inert here (no learner list is
 * published), so the overlay simply hides its chevron group.
 */
export const ControlledStudentSidebarProvider = ({
    selectedStudent,
    setSelectedStudent,
    isSubmissionTab = false,
    children,
}: ControlledStudentSidebarProviderProps) => {
    const [isOverlayOpen, setIsOverlayOpen] = useState(false);

    /**
     * Assessment / homework participant rows carry the learner id in `id` and
     * leave `user_id` + `institute_id` unset (see the submission data transform
     * `getAssessmentSubmissionsFilteredDataStudentData`, which maps
     * `id: student.user_id`). Many profile sections — Overview, Reports, Files,
     * Enroll/Deroll, Portal Access — fetch by `selectedStudent.user_id` (and
     * `.institute_id`) directly, so on these surfaces they'd resolve `undefined`
     * and render empty.
     *
     * Backfill those two fields once here so every section resolves the same
     * record, instead of teaching each one about submission data. Only fills
     * what's missing, so the canonical students-list flow is untouched.
     */
    const normalizedStudent = useMemo<StudentTable | null>(() => {
        if (!selectedStudent) return null;
        const needsUserId = !selectedStudent.user_id && !!selectedStudent.id;
        const needsInstituteId = !selectedStudent.institute_id;
        if (!needsUserId && !needsInstituteId) return selectedStudent;
        return {
            ...selectedStudent,
            user_id: selectedStudent.user_id || selectedStudent.id,
            institute_id: selectedStudent.institute_id || getInstituteId() || '',
        };
    }, [selectedStudent]);

    const openOverlay = useCallback(
        (student?: StudentTable) => {
            if (student) setSelectedStudent(student);
            setIsOverlayOpen(true);
        },
        [setSelectedStudent]
    );

    const closeOverlay = useCallback(() => setIsOverlayOpen(false), []);

    const value = {
        selectedStudent: normalizedStudent,
        setSelectedStudent,
        isOverlayOpen,
        openOverlay,
        closeOverlay,
        // Prev/Next list nav is not wired on these surfaces — a null position
        // makes the overlay hide its chevron group and never call these.
        learnerList: [] as StudentTable[],
        setLearnerList: () => {},
        learnerListPosition: null,
        goPrevLearner: () => {},
        goNextLearner: () => {},
        isSubmissionTab,
    };

    return (
        <StudentSidebarContext.Provider value={value}>
            {children}
            {/* Full-screen overlay — mounted here so the ⤢ expand button on these
                report pages opens the same profile overlay as the students list. */}
            <StudentProfileOverlay />
        </StudentSidebarContext.Provider>
    );
};
