import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

export enum TabType {
    OUTLINE = 'OUTLINE',
    CONTENT_STRUCTURE = 'CONTENT_STRUCTURE',
    STUDENT = 'STUDENT',
    TEACHERS = 'TEACHERS',
    ASSESSMENT = 'ASSESSMENT',
    LIVE_SESSION = 'LIVE_SESSION',
    PLANNING = 'PLANNING',
    ACTIVITY = 'ACTIVITY',
    PULSE = 'PULSE',
    REPORTS = 'REPORTS',
    CERTIFICATES = 'CERTIFICATES',
    DOWNLOADS = 'DOWNLOADS',
    SETTINGS = 'SETTINGS',
    DISCUSSION = 'DISCUSSION',
    // ASSIGNMENT = 'ASSIGNMENT',
    // GRADING = 'GRADING',
    // ANNOUNCEMENT = 'ANNOUNCEMENT',
}
export const tabs = [
    { label: 'Outline', value: 'OUTLINE' },
    { label: 'Content Structure', value: 'CONTENT_STRUCTURE' },
    { label: `${getTerminology(RoleTerms.Learner, SystemTerms.Learner)}`, value: 'STUDENT' },
    { label: `${getTerminology(RoleTerms.Teacher, SystemTerms.Teacher)}`, value: 'TEACHERS' },
    { label: 'Assessment', value: 'ASSESSMENT' },
    {
        label: `${getTerminology(ContentTerms.LiveSession, SystemTerms.LiveSession)}s`,
        value: 'LIVE_SESSION',
    },
    { label: 'Planning', value: 'PLANNING' },
    { label: 'Activity', value: 'ACTIVITY' },
    { label: 'Pulse', value: 'PULSE' },
    { label: 'Reports', value: 'REPORTS' },
    { label: 'Certificates', value: 'CERTIFICATES' },
    { label: 'Downloads', value: 'DOWNLOADS' },
    { label: 'Settings', value: 'SETTINGS' },
    { label: 'Discussion', value: 'DISCUSSION' },
    // { label: 'Assignment ', value: 'ASSIGNMENT' },
    // { label: 'Grading ', value: 'GRADING' },
    // { label: 'Announcements ', value: 'ANNOUNCEMENT' },
];

// Re-exported so existing course-details imports keep working; the list itself
// lives in constants/ because the settings UIs need it too.
export { DEFAULT_HIDDEN_COURSE_DETAILS_TABS } from '@/constants/display-settings/course-details-tabs';
