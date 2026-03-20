import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

export enum TabType {
    OUTLINE = 'OUTLINE',
    CONTENT_STRUCTURE = 'CONTENT_STRUCTURE',
    STUDENT = 'STUDENT',
    TEACHERS = 'TEACHERS',
    ASSESSMENT = 'ASSESSMENT',
    PLANNING = 'PLANNING',
    ACTIVITY = 'ACTIVITY',
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
    { label: 'Planning', value: 'PLANNING' },
    { label: 'Activity', value: 'ACTIVITY' },
    // { label: 'Assignment ', value: 'ASSIGNMENT' },
    // { label: 'Grading ', value: 'GRADING' },
    // { label: 'Announcements ', value: 'ANNOUNCEMENT' },
];
