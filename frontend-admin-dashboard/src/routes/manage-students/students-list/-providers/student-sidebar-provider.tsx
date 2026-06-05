// StudentSidebarProvider.tsx
import { ReactNode, useCallback, useMemo, useState } from 'react';
import { StudentSidebarContext } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { StudentTable } from '@/types/student-table-types';
import { StudentProfileOverlay } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-profile-overlay';

interface StudentSidebarProviderProps {
    children: ReactNode;
}

const sameLearner = (a: StudentTable | null | undefined, b: StudentTable | null | undefined) =>
    !!a && !!b && (a.user_id ? a.user_id === b.user_id : a.id === b.id);

export const StudentSidebarProvider = ({ children }: StudentSidebarProviderProps) => {
    const [selectedStudent, _setSelectedStudent] = useState<StudentTable | null>(null);
    const [isOverlayOpen, setIsOverlayOpen] = useState(false);
    const [learnerList, setLearnerListState] = useState<StudentTable[]>([]);

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

    /**
     * Tables that show learners (students list, contacts list, leads list,
     * follow-ups list, assessment submissions) call this on data change so the
     * overlay's Prev/Next chevron group can walk across the current page
     * without closing. Calling with an empty array clears the list-nav (e.g.
     * when the consumer unmounts). A reference-equal short-circuit avoids
     * spurious re-renders when react-query re-emits the same array.
     */
    const setLearnerList = useCallback(
        (list: StudentTable[]) => {
            setLearnerListState((prev) => (prev === list ? prev : list));
        },
        []
    );

    /** Where the active learner sits in the published list — null when not
     *  in the list at all (e.g. overlay opened from a non-list surface). */
    const learnerListPosition = useMemo(() => {
        if (!selectedStudent || learnerList.length === 0) return null;
        const idx = learnerList.findIndex((l) => sameLearner(l, selectedStudent));
        if (idx < 0) return null;
        return { index: idx, total: learnerList.length };
    }, [selectedStudent, learnerList]);

    const goPrevLearner = useCallback(() => {
        if (!learnerListPosition || learnerListPosition.index <= 0) return;
        const prev = learnerList[learnerListPosition.index - 1];
        if (prev) _setSelectedStudent(prev);
    }, [learnerList, learnerListPosition]);

    const goNextLearner = useCallback(() => {
        if (
            !learnerListPosition ||
            learnerListPosition.index >= learnerListPosition.total - 1
        )
            return;
        const next = learnerList[learnerListPosition.index + 1];
        if (next) _setSelectedStudent(next);
    }, [learnerList, learnerListPosition]);

    const value = {
        selectedStudent,
        setSelectedStudent,
        isOverlayOpen,
        openOverlay,
        closeOverlay,
        learnerList,
        setLearnerList,
        learnerListPosition,
        goPrevLearner,
        goNextLearner,
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
