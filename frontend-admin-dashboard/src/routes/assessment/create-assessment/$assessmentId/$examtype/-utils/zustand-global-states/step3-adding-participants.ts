import { create } from 'zustand';

interface TestInputField {
    id: string;
    type: string;
    name: string;
    oldKey: boolean;
    isRequired: boolean;
    options?: {
        id: string;
        value: string;
    }[];
    order: number;
}

interface Student {
    username: string;
    user_id: string;
    email: string;
    full_name: string;
    mobile_number: string;
    guardian_email: string;
    guardian_mobile_number: string;
    file_id: string;
    reattempt_count: number;
}

interface NotifyBeforeAssessmentGoLive {
    checked: boolean;
    value: string;
}

interface TestAccessState {
    status?: string;
    closed_test?: boolean;
    open_test?: {
        checked?: boolean;
        start_date?: string;
        end_date?: string;
        instructions?: string;
        name?: string;
        email?: string;
        phone?: string;
        custom_fields?: TestInputField[];
    };
    select_batch?: {
        checked?: boolean;
        batch_details?: Record<string, string[]>;
    };
    select_individually?: {
        checked?: boolean;
        student_details?: Student[];
    };
    join_link?: string;
    show_leaderboard?: boolean;
    notify_student?: {
        when_assessment_created?: boolean;
        before_assessment_goes_live?: NotifyBeforeAssessmentGoLive;
        when_assessment_live?: boolean;
        when_assessment_report_generated?: boolean;
    };
    notify_parent?: {
        when_assessment_created?: boolean;
        before_assessment_goes_live?: NotifyBeforeAssessmentGoLive;
        when_assessment_live?: boolean;
        when_student_appears?: boolean;
        when_student_finishes_test?: boolean;
        when_assessment_report_generated?: boolean;
    };
    setTestAccessInfo: (data: Partial<TestAccessState>) => void;
    getTestAccessInfo: () => TestAccessState;
    reset: () => void;
}

// ✅ Define the initial empty state (excluding functions)
const initialState: Omit<TestAccessState, 'setTestAccessInfo' | 'getTestAccessInfo' | 'reset'> = {
    status: undefined,
    closed_test: undefined,
    open_test: undefined,
    select_batch: undefined,
    select_individually: undefined,
    join_link: undefined,
    show_leaderboard: undefined,
    notify_student: undefined,
    notify_parent: undefined,
};

export const useTestAccessStore = create<TestAccessState>((set, get) => ({
    ...initialState,
    setTestAccessInfo: (data) => set((state) => ({ ...state, ...data })),
    getTestAccessInfo: () => get(),
    reset: () => set(() => ({ ...initialState })), // ✅ Properly resets to initial state
}));
