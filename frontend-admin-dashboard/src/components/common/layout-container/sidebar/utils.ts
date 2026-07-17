import {
    Robot,
    Megaphone,
    GearSix,
    UsersFour,
    PlusCircle,
    House,
    CreditCard,
    AddressBook,
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
    UserList,
    Notebook,
} from '@phosphor-icons/react';
import i18next from 'i18next';
import { StorageKey } from '@/constants/storage/storage';
import {
    ContentTerms,
    OtherTerms,
    SystemTerms,
} from '@/routes/settings/-components/NamingSettings';
import { NamingSettingsType } from '@/routes/settings/-constants/terms';
import { SidebarItemsType } from '@/types/layout-container/layout-container-types';
import { isBulkContentUploadEnabled } from '@/components/common/study-library/bulk-content-uploading/feature-gate';
import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from '@/i18n/locales';
import { getLanguageSetting } from '@/services/language-settings';
import { notifyNamingSettingsUpdated } from '@/hooks/useNamingSettingsVersion';

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

/* -------------------------------------------------------------------------- *
 * Locale-aware terminology resolution
 *
 * Institutes rename terms ("Course" → "Programme") AND the UI can render in a
 * language other than the one those renames were typed in. resolveLocalizedTerm
 * covers steps (a)–(c) of the chain; it returns null when the caller must apply
 * step (d) — its own pre-existing fallback, byte-for-byte:
 *
 *   (a) term.locales[lng]                    → the institute's word for THIS locale
 *   (b) lng === content source locale        → null (flat customValue path = today)
 *   (c) i18n.t('terms:<key>')                → translated SYSTEM default
 *   (d) null                                 → caller's existing fallback
 *
 * ENGLISH IS UNTOUCHED: with no `locales` map and no LANGUAGE_SETTING, the
 * source locale defaults to 'en', so an 'en' UI always exits at (b) with null
 * and every caller behaves exactly as it did before this file changed. The
 * terms catalog is not even fetched.
 * -------------------------------------------------------------------------- */

const TERMS_NAMESPACE = 'terms';

/**
 * Active UI locale. Read off the i18next singleton rather than importing
 * '@/i18n' so this module never triggers i18n init (735 call sites import it,
 * including from non-browser contexts) and no import cycle is possible.
 */
const getActiveLocale = (): SupportedLocale =>
    normalizeLocale(i18next.resolvedLanguage ?? i18next.language);

/** Language the institute's flat customValue/customPluralValue are written in. */
const getContentSourceLocale = (): SupportedLocale => {
    try {
        return normalizeLocale(getLanguageSetting()?.content_source_locale ?? DEFAULT_LOCALE);
    } catch {
        return DEFAULT_LOCALE;
    }
};

// Locales whose terms catalog has been requested — the namespace is fetched
// lazily and only for locales that can actually reach step (c), so an
// English-only institute never pays for it.
const requestedTermsLocales = new Set<string>();

const ensureTermsCatalog = (locale: string): void => {
    if (requestedTermsLocales.has(locale) || !i18next.isInitialized) return;
    requestedTermsLocales.add(locale);
    void i18next
        .loadNamespaces(TERMS_NAMESPACE)
        // The catalog lands after the first paint; tell consumers to re-read.
        .then(() => notifyNamingSettingsUpdated())
        .catch(() => {
            // Missing/failed catalog is non-fatal — resolution falls to step (d).
            requestedTermsLocales.delete(locale);
        });
};

/** Translated system default for a term, or null when the catalog lacks it. */
const translateTerm = (key: string, suffix?: string): string | null => {
    if (!i18next.isInitialized) return null;
    const fullKey = suffix ? `${key}_${suffix}` : key;
    if (!i18next.exists(fullKey, { ns: TERMS_NAMESPACE })) return null;
    const value = i18next.t(fullKey, { ns: TERMS_NAMESPACE, defaultValue: '' });
    return typeof value === 'string' && value.length > 0 ? value : null;
};

/**
 * Steps (a)–(c) above. `null` means "use your own fallback" (step (d)).
 *
 * Plural reads the `_other` suffix: it is the bare plural LABEL in every
 * catalog (en "Courses", ar broken plural "دورات"), not a count-driven form.
 */
export const resolveLocalizedTerm = (
    setting: NamingSettingsType | undefined,
    key: string,
    form: 'singular' | 'plural'
): string | null => {
    const locale = getActiveLocale();

    // (a) Institute's own word for the active locale. `locales` is optional —
    // blobs cached before this field existed simply have nothing here.
    const override = setting?.locales?.[locale];
    const overrideValue = form === 'plural' ? override?.customPluralValue : override?.customValue;
    if (overrideValue) return overrideValue;

    // (b) The flat fields already hold the right language — caller's path wins.
    if (locale === getContentSourceLocale()) return null;

    // (c) Translated system default.
    ensureTermsCatalog(locale);
    return translateTerm(key, form === 'plural' ? 'other' : undefined);
};

// When true, getTerminology/getTerminologyPlural bypass localStorage and
// always return the system default. Used by withSystemDefaults() so callers
// can compute what a label WOULD be without any user customization.
let useSystemDefaultsFlag = false;

export const withSystemDefaults = <T>(fn: () => T): T => {
    const prev = useSystemDefaultsFlag;
    useSystemDefaultsFlag = true;
    try {
        return fn();
    } finally {
        useSystemDefaultsFlag = prev;
    }
};

// Utility function to get custom terminology with fallback to default
export const getTerminology = (key: string, defaultValue: string): string => {
    if (useSystemDefaultsFlag) return defaultValue;

    const settings = getNamingSettings();

    // Double-check that settings is an array before calling find
    if (!Array.isArray(settings)) {
        console.warn('Settings is not an array in getTerminology:', settings);
        return defaultValue;
    }

    const setting = settings.find((item) => item.key === key);

    // Steps (a)-(c); null → step (d), the original line below, unchanged.
    const localized = resolveLocalizedTerm(setting, key, 'singular');
    if (localized) return localized;

    return setting?.customValue || defaultValue;
};

// Utility function to get pluralized terminology — uses stored customPluralValue
export const getTerminologyPlural = (key: string, defaultValue: string): string => {
    if (useSystemDefaultsFlag) return naivePluralize(defaultValue);

    const settings = getNamingSettings();

    if (!Array.isArray(settings)) {
        return defaultValue;
    }

    const setting = settings.find((item) => item.key === key);

    // Steps (a)-(c); null → step (d), the original body below, unchanged.
    // naivePluralize is English-only, so reaching it for a non-English locale
    // would mangle the word — that is exactly what step (c) prevents.
    const localized = resolveLocalizedTerm(setting, key, 'plural');
    if (localized) return localized;

    if (setting?.customPluralValue) {
        return setting.customPluralValue;
    }

    // Fallback: naive pluralization of the singular custom value (or default)
    const singular = setting?.customValue || defaultValue;
    return naivePluralize(singular);
};

// Fallback pluralization for when customPluralValue is not set
const naivePluralize = (word: string): string => {
    if (
        word.endsWith('s') ||
        word.endsWith('x') ||
        word.endsWith('z') ||
        word.endsWith('ch') ||
        word.endsWith('sh')
    ) {
        return `${word}es`;
    }
    if (
        word.endsWith('y') &&
        !['a', 'e', 'i', 'o', 'u'].includes(word.charAt(word.length - 2).toLowerCase())
    ) {
        return `${word.slice(0, -1)}ies`;
    }
    return `${word}s`;
};

// Re-evaluates on each call so naming settings changes are reflected immediately
export const getSidebarItemsData = (): SidebarItemsType[] => [
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
                subItem: 'Sub-Org Teams',
                subItemLink: '/manage-suborg-teams',
                subItemId: 'suborg-teams',
            },
            {
                // Institute-admin surface — sub-orgs list + drilldown to a sub-org's
                // analytics deep page. Sibling to "Sub-Org Teams" (which is the
                // sub-org-admin's narrow view). Both default off; institutes opt in.
                subItem: 'Manage Institute Sub-Orgs',
                subItemLink: '/manage-custom-teams',
                subItemId: 'manage-institute-suborgs',
            },
            {
                subItem: `${getTerminology(OtherTerms.Inventory, SystemTerms.Inventory)} Management`,
                subItemLink: '/manage-inventory',
                subItemId: 'inventory-management',
            },
            {
                subItem: `Manage ${getTerminologyPlural(ContentTerms.Package, SystemTerms.Package)}`,
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
                subItem: `Linked ${getTerminology(ContentTerms.Course, SystemTerms.Course)} Contacts`,
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
                subItem: `${getTerminology(OtherTerms.Invite, SystemTerms.Invite)} Users`,
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
                subItem: 'Dashboard',
                subItemLink: '/admissions/dashboard',
                subItemId: 'dashboard',
            },
            {
                subItem: 'Admission List',
                subItemLink: '/admissions/admission-list',
                subItemId: 'admission-list',
            },
            {
                subItem: 'Enquiries',
                subItemLink: '/admissions/enquiries',
                subItemId: 'enquiry',
            },
            {
                subItem: 'Application',
                subItemLink: '/admissions/application',
                subItemId: 'application',
            },
        ],
    },
    {
        icon: CreditCard,
        title: 'Fee Management',
        id: 'fee-management',
        category: 'CRM',
        subItems: [
            {
                subItem: 'Create Fee Plan',
                subItemLink: '/financial-management/fee-plans',
                subItemId: 'create-fee-plan',
            },
            {
                subItem: 'Manage Finances',
                subItemLink: '/financial-management/manage-finances',
                subItemId: 'manage-finances',
            },
            {
                subItem: 'Collection Dashboard',
                subItemLink: '/financial-management/collection-dashboard',
                subItemId: 'collection-dashboard',
            },
            {
                subItem: 'Pay Installments',
                subItemLink: '/financial-management/pay-installments',
                subItemId: 'pay-installments',
            },
            {
                subItem: 'Adjustment Approvals',
                subItemLink: '/financial-management/adjustment-approvals',
                subItemId: 'adjustment-approvals',
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
                subItem: `${getTerminology(OtherTerms.Invite, SystemTerms.Invite)} Stats`,
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
                subItem: 'In-App Messages',
                subItemLink: '/chat',
                subItemId: 'chat',
            },
            {
                subItem: 'Notification Hub',
                subItemLink: '/communication/notification-hub',
                subItemId: 'notification-hub',
            },
            {
                subItem: 'WhatsApp Inbox',
                subItemLink: '/communication/inbox',
                subItemId: 'whatsapp-inbox',
            },
            {
                subItem: 'WhatsApp Templates',
                subItemLink: '/communication/whatsapp-templates',
                subItemId: 'whatsapp-templates',
            },
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
                subItem: 'Chatbot Flows',
                subItemLink: '/automation/chatbot-flows',
                subItemId: 'chatbot-flows',
            },
            {
                subItem: 'Website Builder',
                subItemLink: '/manage-pages',
                subItemId: 'website-builder',
            },
            {
                subItem: 'Product Pages',
                subItemLink: '/manage-pages/product-pages',
                subItemId: 'product-pages',
            },
        ],
    },
    {
        icon: UserList,
        title: 'Leads',
        id: 'leads',
        category: 'CRM',
        subItems: [
            {
                subItem: 'Lead List',
                subItemLink: '/audience-manager/list',
                subItemId: 'lead-list-leads',
            },
            {
                subItem: 'Recent Leads',
                subItemLink: '/audience-manager/recent-leads',
                subItemId: 'recent-leads',
            },
            {
                subItem: 'Follow-ups',
                subItemLink: '/audience-manager/follow-ups',
                subItemId: 'follow-ups',
            },
            {
                subItem: 'Call Log',
                subItemLink: '/audience-manager/call-log',
                subItemId: 'call-log',
            },
            {
                subItem: 'AI Intelligence',
                subItemLink: '/audience-manager/ai-intelligence',
                subItemId: 'ai-intelligence',
            },
            {
                subItem: 'Counsellors',
                subItemLink: '/counsellors',
                subItemId: 'counsellors',
            },
            {
                subItem: 'Sales Dashboard',
                subItemLink: '/sales-dashboard',
                subItemId: 'sales-dashboard',
            },
            {
                subItem: 'Reports',
                subItemLink: '/audience-manager/reports',
                subItemId: 'lead-reports',
            },
        ],
    },
    {
        icon: Lightning,
        title: 'Engagement Engines',
        id: 'engagement-engines',
        category: 'CRM',
        subItems: [
            {
                subItem: 'Engines',
                subItemLink: '/engagement-engines',
                subItemId: 'engagement-engines-list',
                adminOnly: true,
            },
            {
                subItem: 'Task Inbox',
                subItemLink: '/engagement-engines/inbox',
                subItemId: 'engagement-task-inbox',
                adminOnly: true,
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
    {
        icon: Notebook,
        id: 'admin-activity-logs',
        title: 'Admin Activity Logs',
        to: '/admin-activity-logs',
        category: 'CRM',
    },

    // LMS
    {
        icon: Books,
        title: getTerminologyPlural(ContentTerms.Course, SystemTerms.Course),
        id: 'courses',
        to: '/study-library/courses',
        category: 'LMS',
    },
    {
        icon: PlusCircle,
        title: `${getTerminology(ContentTerms.Course, SystemTerms.Course)} Creation`,
        id: 'course-creation',
        category: 'LMS',
        subItems: [
            {
                subItem: `Create new ${getTerminology(ContentTerms.Course, SystemTerms.Course).toLowerCase()} from scratch`,
                subItemLink: '/study-library/courses?action=create',
                subItemId: 'create-course-scratch',
            },
            {
                subItem: `Create ${getTerminology(ContentTerms.Course, SystemTerms.Course).toLowerCase()} from AI`,
                subItemLink: '/study-library/ai-copilot',
                subItemId: 'create-course-ai',
            },
            // Hidden by default — per-institute gate (see bulk-content-uploading/feature-gate.ts)
            ...(isBulkContentUploadEnabled()
                ? [
                      {
                          subItem: 'Bulk Content Upload',
                          subItemLink: '/study-library/bulk-content-uploading',
                          subItemId: 'bulk-content-uploading',
                      },
                  ]
                : []),
        ],
    },
    {
        icon: Video,
        title: getTerminologyPlural(ContentTerms.LiveSession, SystemTerms.LiveSession),
        id: 'live-sessions',
        category: 'LMS',
        subItems: [
            {
                subItem: `Scheduled ${getTerminologyPlural(ContentTerms.LiveSession, SystemTerms.LiveSession)}`,
                subItemLink: '/study-library/live-session',
                subItemId: 'scheduled-sessions',
            },
            {
                subItem: 'Create new',
                subItemLink: '/study-library/live-session/schedule/step1',
                subItemId: 'create-live-session',
            },
            {
                subItem: 'Bulk Schedule',
                subItemLink: '/study-library/live-session/schedule/bulk',
                subItemId: 'bulk-schedule-live-session',
            },
            {
                subItem: `${getTerminology(ContentTerms.LiveSession, SystemTerms.LiveSession)} Attendance`,
                subItemLink: '/study-library/attendance-tracker',
                subItemId: 'session-attendance',
            },
            {
                subItem: `${getTerminology(ContentTerms.LiveSession, SystemTerms.LiveSession)} Feedback`,
                subItemLink: '/study-library/live-session/feedback',
                subItemId: 'live-session-feedback',
            },
        ],
    },
    {
        icon: CalendarCheck,
        title: `${getTerminology(ContentTerms.Course, SystemTerms.Course)} Planning and Logbook`,
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
                subItem: `Log ${getTerminology(ContentTerms.Course, SystemTerms.Course)} Progress`,
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
        title: `AI ${getTerminology(ContentTerms.Course, SystemTerms.Course)} Creator`,
        id: 'ai-copilot-tab',
        category: 'AI',
        to: '/study-library/ai-copilot',
    },
    {
        icon: FilmStrip,
        title: 'Vimotion - Content Studio',
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

/** @deprecated Use getSidebarItemsData() instead — this static reference won't reflect naming changes */
export const SidebarItemsData: SidebarItemsType[] = getSidebarItemsData();
