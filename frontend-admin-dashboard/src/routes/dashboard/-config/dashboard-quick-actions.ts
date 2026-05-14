import {
    UserPlus,
    Plus,
    Megaphone,
    ChartPie,
    CalendarPlus,
    Receipt,
    GraduationCap,
    BookOpen,
} from '@phosphor-icons/react';

export interface QuickAction {
    id: string;
    label: string;
    icon: typeof UserPlus;
    to: string;
    search?: Record<string, string>;
}

const ADMIN_ACTIONS: QuickAction[] = [
    {
        id: 'add-student',
        label: 'Add Student',
        icon: UserPlus,
        to: '/manage-students/students-list',
        search: { action: 'enroll' },
    },
    { id: 'new-batch', label: 'New Batch', icon: Plus, to: '/manage-institute/batches' },
    { id: 'announce', label: 'Announcement', icon: Megaphone, to: '/announcement/create' },
    { id: 'collect-payment', label: 'Payments', icon: Receipt, to: '/manage-payments' },
    { id: 'reports', label: 'Reports', icon: ChartPie, to: '/study-library/reports' },
];

const TEACHER_ACTIONS: QuickAction[] = [
    {
        id: 'todays-classes',
        label: "Today's Classes",
        icon: CalendarPlus,
        to: '/study-library/live-session',
    },
    { id: 'my-courses', label: 'My Courses', icon: BookOpen, to: '/study-library/courses' },
    { id: 'reports', label: 'Reports', icon: ChartPie, to: '/study-library/reports' },
];

const COURSE_CREATOR_ACTIONS: QuickAction[] = [
    { id: 'my-courses', label: 'My Courses', icon: BookOpen, to: '/study-library/courses' },
    {
        id: 'new-course',
        label: 'New Course',
        icon: Plus,
        to: '/study-library/courses',
    },
];

const ASSESSMENT_CREATOR_ACTIONS: QuickAction[] = [
    { id: 'assessments', label: 'Assessments', icon: GraduationCap, to: '/assessment' },
    { id: 'reports', label: 'Reports', icon: ChartPie, to: '/study-library/reports' },
];

const EVALUATOR_ACTIONS: QuickAction[] = [
    { id: 'evaluations', label: 'Evaluations', icon: GraduationCap, to: '/evaluation' },
];

// Match against the role names emitted by getUserRoles().
const ROLE_TO_ACTIONS: Record<string, QuickAction[]> = {
    ADMIN: ADMIN_ACTIONS,
    TEACHER: TEACHER_ACTIONS,
    'COURSE CREATOR': COURSE_CREATOR_ACTIONS,
    'ASSESSMENT CREATOR': ASSESSMENT_CREATOR_ACTIONS,
    EVALUATOR: EVALUATOR_ACTIONS,
};

export const quickActionsForRoles = (roles: string[]): QuickAction[] => {
    if (!roles?.length) return [];
    // ADMIN wins if present (broadest action set).
    if (roles.includes('ADMIN')) return ADMIN_ACTIONS;
    // Otherwise, take the first matched role's set.
    for (const r of roles) {
        const actions = ROLE_TO_ACTIONS[r];
        if (actions) return actions;
    }
    return [];
};
