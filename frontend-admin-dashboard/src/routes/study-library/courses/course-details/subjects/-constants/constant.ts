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
    { label: 'Settings', value: 'SETTINGS' },
    { label: 'Discussion', value: 'DISCUSSION' },
    // { label: 'Assignment ', value: 'ASSIGNMENT' },
    // { label: 'Grading ', value: 'GRADING' },
    // { label: 'Announcements ', value: 'ANNOUNCEMENT' },
];

/**
 * Course-details tabs that stay hidden unless a role's display settings
 * explicitly turn them on. Unlike the other tabs (which default to visible when
 * a role config doesn't mention them), these default to OFF — so pre-existing
 * saved configs that predate the tab don't suddenly surface it. Enable per role
 * in Settings → Display → Course Details Tabs.
 */
export const DEFAULT_HIDDEN_COURSE_DETAILS_TABS = new Set<string>([TabType.LIVE_SESSION]);
