import { create } from 'zustand';

/**
 * Global mirror of the student-side-view selection, for the Vacademy Assistant.
 *
 * The real selection lives in StudentSidebarProvider's React context, which is
 * mounted inside LayoutContainer — the assistant widget (mounted in __root as a
 * sibling of the router outlet) cannot reach that context. The provider writes
 * a minimal identifier snapshot here so the assistant can answer "this student"
 * questions with page context. Never store the full row (PII discipline) —
 * only what the data tools need.
 */
export interface SelectedStudentSnapshot {
    user_id: string;
    full_name: string;
    package_session_id?: string;
    institute_enrollment_id?: string;
}

interface SelectedStudentMirrorState {
    student: SelectedStudentSnapshot | null;
    setStudent: (student: SelectedStudentSnapshot | null) => void;
}

export const useSelectedStudentMirrorStore = create<SelectedStudentMirrorState>((set) => ({
    student: null,
    setStudent: (student) => set({ student }),
}));
