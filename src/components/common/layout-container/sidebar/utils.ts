import {
    House,
    CreditCard,
    AddressBook,
    Robot,
    Megaphone,
    GearSix,
    UsersFour,
    PlusCircle,
    Video,
    CalendarCheck,
    ChartBar,
    Lightning,
    Question,
    PencilCircle,
    Files,
    Sparkle,
    FilmStrip,
    Books,
    Code,
} from '@phosphor-icons/react';
import { StorageKey } from '@/constants/storage/storage';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { NamingSettingsType } from '@/routes/settings/-constants/terms';
import { SidebarItemsType } from '@/types/layout-container/layout-container-types';

// Utility function to get naming settings from localStorage
const getNamingSettings = (): NamingSettingsType[] => {
    try {
        const saved = localStorage.getItem(StorageKey.NAMING_SETTINGS);
        if (!saved) return [];

        const parsed = JSON.parse(saved);

        // Ensure the parsed data is an array
        if (!Array.isArray(parsed)) {
            console.warn('Naming settings in localStorage is not an array:', parsed);
            return [];
        }

        return parsed;
    } catch (error) {
        console.error('Failed to parse naming settings from localStorage:', error);
        return [];
    }
};

// Utility function to get custom terminology with fallback to default
export const getTerminology = (key: string, defaultValue: string): string => {
    const settings = getNamingSettings();

    // Double-check that settings is an array before calling find
    if (!Array.isArray(settings)) {
        console.warn('Settings is not an array in getTerminology:', settings);
        return defaultValue;
    }

    const setting = settings.find((item) => item.key === key);
    return setting?.customValue || defaultValue;
};

// Utility function to get pluralized terminology
export const getTerminologyPlural = (key: string, defaultValue: string): string => {
    const singular = getTerminology(key, defaultValue);
    // Simple pluralization: add 's' or 'es' based on ending
    if (
        singular.endsWith('s') ||
        singular.endsWith('x') ||
        singular.endsWith('z') ||
        singular.endsWith('ch') ||
        singular.endsWith('sh')
    ) {
        return `${singular}es`;
    }
    if (
        singular.endsWith('y') &&
        !['a', 'e', 'i', 'o', 'u'].includes(singular.charAt(singular.length - 2).toLowerCase())
    ) {
        return `${singular.slice(0, -1)}ies`;
    }
    return `${singular}s`;
};

export const SidebarItemsData: SidebarItemsType[] = [
    // CRM with ERP
    {
        icon: House,
        title: 'Dashboard',
        id: 'dashboard',
        to: '/dashboard',
        category: 'CRM',
    },
    {
        icon: UsersFour,
        title: 'Manage Institute',
        id: 'manage-institute',
        category: 'CRM',
        subItems: [
            {
                subItem: getTerminologyPlural(ContentTerms.Batch, SystemTerms.Batch),
                subItemLink: '/manage-institute/batches',
                subItemId: 'batches',
            },
            {
                subItem: getTerminology(ContentTerms.Session, SystemTerms.Session), // Session
                subItemLink: '/manage-institute/sessions',
                subItemId: 'sessions',
            },
            {
                subItem: 'Teams',
                subItemLink: '/manage-institute/teams',
                subItemId: 'teams',
            },
            {
                subItem: 'Inventory Management',
                subItemLink: '/manage-inventory',
                subItemId: 'inventory-management',
            },
            {
                subItem: 'Manage Packages',
                subItemLink: '/admin-package-management',
                subItemId: 'manage-packages',
                adminOnly: true,
            },
        ],
    },
    {
        icon: AddressBook,
        title: 'Manage Contacts',
        id: 'manage-contacts',
        category: 'CRM',
        subItems: [
            {
                subItem: 'All Contacts',
                subItemLink: '/manage-contacts',
                subItemId: 'all-contacts',
            },
            {
                subItem: 'Linked Course Contacts',
                subItemLink: '/manage-students/students-list',
                subItemId: 'linked-contacts',
            },
            {
                subItem: 'User Tags',
                subItemLink: '/user-tags/institute',
                subItemId: 'user-tags-main',
            },
            {
                subItem: 'Link Tag',
                subItemLink: '/user-tags/link',
                subItemId: 'link-tag',
            },
            {
                subItem: 'Invite Users',
                subItemLink: '/manage-students/invite',
                subItemId: 'invite',
            },
        ],
    },
    {
        icon: AddressBook, // Can reuse AddressBook icon or import a new one like Users
        title: 'Admissions',
        id: 'admissions',
        category: 'CRM',
        subItems: [
            {
                subItem: 'Admission Form',
                subItemLink: '/admissions/admission-form',
                subItemId: 'admission-form',
            },
        ],
    },
    {
        icon: CreditCard,
        title: 'Membership',
        id: 'membership-management',
        category: 'CRM',
        subItems: [
            {
                subItem: 'Lead List',
                subItemLink: '/audience-manager/list',
                subItemId: 'lead-list',
            },
            {
                subItem: 'Manage Payments',
                subItemLink: '/manage-payments',
                subItemId: 'manage-payments-sub',
            },
            {
                subItem: 'Manage Expiry',
                subItemLink: '/membership-expiry',
                subItemId: 'membership-expiry-sub',
            },
            {
                subItem: 'Enrollment Stats',
                subItemLink: '/membership-stats',
                subItemId: 'membership-stats-sub',
            },
        ],
    },
    {
        icon: Megaphone,
        title: 'Communications',
        id: 'communications',
        category: 'CRM',
        subItems: [
            {
                subItem: 'Create Announcement',
                subItemLink: '/announcement/create',
                subItemId: 'announcement-create',
            },
            {
                subItem: 'Email Campaigning',
                subItemLink: '/announcement/email-campaigning',
                subItemId: 'announcement-email-campaigning',
            },
            {
                subItem: 'Announcement History',
                subItemLink: '/announcement/history',
                subItemId: 'announcement-history',
                adminOnly: true,
            },
            {
                subItem: 'Schedule Announcement',
                subItemLink: '/announcement/schedule',
                subItemId: 'announcement-schedule',
            },
            {
                subItem: 'Announcement Approval',
                subItemLink: '/announcement/approval',
                subItemId: 'announcement-approval',
            },
        ],
    },
    {
        icon: Robot,
        title: 'Automations',
        id: 'automations',
        category: 'CRM',
        subItems: [
            {
                subItem: 'Workflows',
                subItemLink: '/workflow/list',
                subItemId: 'workflow-list',
            },
            {
                subItem: 'Website Builder',
                subItemLink: '/manage-pages',
                subItemId: 'website-builder',
            },
        ],
    },
    {
        icon: GearSix,
        id: 'settings',
        title: 'Settings',
        to: '/settings',
        category: 'CRM',
    },

    // LMS
    {
        icon: Books,
        title: 'Courses',
        id: 'courses',
        to: '/study-library/courses',
        category: 'LMS',
    },
    {
        icon: PlusCircle,
        title: 'Course Creation',
        id: 'course-creation',
        category: 'LMS',
        subItems: [
            {
                subItem: 'Create new course from scratch',
                subItemLink: '/study-library/courses?action=create',
                subItemId: 'create-course-scratch',
            },
            {
                subItem: 'Create course from AI',
                subItemLink: '/study-library/ai-copilot',
                subItemId: 'create-course-ai',
            },
        ],
    },
    {
        icon: Video,
        title: 'Live Sessions',
        id: 'live-sessions',
        category: 'LMS',
        subItems: [
            {
                subItem: 'Scheduled Sessions',
                subItemLink: '/study-library/live-session',
                subItemId: 'scheduled-sessions',
            },
            {
                subItem: 'Create new',
                subItemLink: '/study-library/live-session/schedule/step1',
                subItemId: 'create-live-session',
            },
            {
                subItem: 'Session Attendance',
                subItemLink: '/study-library/attendance-tracker',
                subItemId: 'session-attendance',
            },
        ],
    },
    {
        icon: CalendarCheck,
        title: 'Course Planning and Logbook',
        id: 'course-planning-logging',
        category: 'LMS',
        subItems: [
            {
                subItem: 'Curriculum timeline Planner',
                subItemLink: '/planning/planning',
                subItemId: 'curriculum-planner',
            },
            {
                subItem: 'AI Lecture planning',
                subItemLink: '/ai-center/ai-tools/vsmart-lecture',
                subItemId: 'ai-lecture-planning',
            },
            {
                subItem: 'Log Course Progress',
                subItemLink: '/planning/activity-logs',
                subItemId: 'log-course-progress',
            },
        ],
    },
    {
        icon: ChartBar,
        title: 'Learning Reports',
        id: 'learning-reports',
        to: '/study-library/reports',
        category: 'LMS',
    },
    {
        icon: Lightning,
        title: 'Learning Engagement',
        id: 'learning-engagement',
        category: 'LMS',
        subItems: [
            {
                subItem: 'Interactive class', // Volt
                subItemLink: '/study-library/volt',
                subItemId: 'interactive-class-volt',
            },
            {
                subItem: 'Create Engaging Content',
                subItemLink: '/video-api-studio',
                subItemId: 'create-engaging-content',
            },
        ],
    },
    {
        icon: Question,
        title: 'Doubt Management',
        id: 'doubt-management',
        to: '/study-library/doubt-management',
        category: 'LMS',
    },
    {
        icon: PencilCircle, // Assuming pencilCircle variable name mismatch fix to come
        title: 'Assessments and Tests',
        id: 'assessments-tests',
        category: 'LMS',
        subItems: [
            {
                subItem: 'Scheduled Tests',
                subItemLink: '/assessment/assessment-list?selectedTab=liveTests',
                subItemId: 'scheduled-tests',
            },
            {
                subItem: 'Create Deadline Based Tests',
                subItemLink: '/assessment/create-assessment/defaultId/EXAM?currentStep=0',
                subItemId: 'create-deadline-test',
            },
            {
                subItem: 'Create anytime attempt Test',
                subItemLink: '/assessment/create-assessment/defaultId/MOCK?currentStep=0',
                subItemId: 'create-anytime-test',
            },
            {
                subItem: 'Create survey',
                subItemLink: '/assessment/create-assessment/defaultId/SURVEY?currentStep=0',
                subItemId: 'create-survey',
            },
            {
                subItem: 'Test Evaluations',
                subItemLink: '/evaluation/evaluations',
                subItemId: 'test-evaluations',
            },
            {
                subItem: 'Scanned Answer sheet Evaluation',
                subItemLink: '/evaluation/evaluation-tool',
                subItemId: 'scanned-evaluation',
            },
        ],
    },
    {
        icon: Files,
        title: 'Questions Banks and Papers',
        id: 'question-banks',
        to: '/assessment/question-papers',
        category: 'LMS',
    },

    // AI Tools
    {
        icon: Sparkle,
        title: 'AI Tools',
        id: 'ai-tools-tab',
        category: 'AI',
        to: '/ai-center/ai-tools',
    },
    {
        icon: Robot, // Or User icon if available
        title: 'Instructor Copilot',
        id: 'instructor-copilot-tab',
        category: 'AI',
        to: '/instructor-copilot',
    },
    {
        icon: Robot,
        title: 'AI Course Creator',
        id: 'ai-copilot-tab',
        category: 'AI',
        to: '/study-library/ai-copilot',
    },
    {
        icon: FilmStrip,
        title: 'AI Content Creator Studio',
        id: 'content-ai-studio',
        category: 'AI',
        to: '/video-api-studio/console',
    },
    {
        icon: Code,
        title: 'Content AI API',
        id: 'content-ai-api',
        category: 'AI',
        to: '/video-api-studio',
    },
];
