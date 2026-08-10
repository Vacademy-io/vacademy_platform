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
    { label: 'Downloads', value: 'DOWNLOADS' },
    { label: 'Settings', value: 'SETTINGS' },
    { label: 'Discussion', value: 'DISCUSSION' },
    // { label: 'Assignment ', value: 'ASSIGNMENT' },
    // { label: 'Grading ', value: 'GRADING' },
    // { label: 'Announcements ', value: 'ANNOUNCEMENT' },
];

/**
 * Course-details tabs that stay hidden unless a role's display settings
 * explicitly turn them on. Unlike the other tabs (which default to visible when
 * a role config doesn't mention them), these default to OFF. Currently empty —
 * every tab (including Live Sessions and Pulse) defaults to visible; admins can
 * still hide any of them per role in Settings → Display → Course Details Tabs.
 */
export const DEFAULT_HIDDEN_COURSE_DETAILS_TABS = new Set<string>([]);
