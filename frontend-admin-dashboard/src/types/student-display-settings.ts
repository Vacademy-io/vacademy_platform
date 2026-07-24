// Types for Student Display Settings (Learner Portal)

import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

export const STUDENT_DISPLAY_SETTINGS_KEY = 'STUDENT_DISPLAY_SETTINGS' as const;

// Sidebar
export interface StudentSidebarSubTabConfig {
    id: string;
    label?: string;
    route: string;
    order: number;
    visible: boolean;
}

export interface StudentSidebarTabConfig {
    id: string; // dashboard, learning-center, homework, assessment-center, referral, attendance, etc.
    label?: string;
    route?: string;
    order: number;
    visible: boolean;
    subTabs?: StudentSidebarSubTabConfig[];
    isCustom?: boolean;
}

// Dashboard Widgets
export type StudentDashboardWidgetId =
    | 'coursesStat'
    | 'assessmentsStat'
    | 'evaluationStat'
    | 'continueLearning'
    | 'learningAnalytics'
    | 'activityTrend'
    | 'dailyProgress'
    | 'liveClasses'
    | 'thisWeekAttendance'
    | 'referAFriend'
    | 'myClasses'
    | 'myMembership'
    | 'myBooks'
    | 'upcomingLiveClasses'
    | 'custom';

export interface StudentDashboardWidgetConfig {
    id: StudentDashboardWidgetId;
    order: number;
    visible: boolean;
    isCustom?: boolean;
    title?: string;
    subTitle?: string;
    link?: string; // route or external link for onClick
}

// Signup/Login configuration
export type StudentSignupProvider = 'google' | 'github' | 'usernamePassword' | 'emailOtp';
export type StudentDefaultProvider = StudentSignupProvider;
export type UsernameStrategy = 'email' | 'random' | 'manual';
export type PasswordStrategy = 'manual' | 'autoRandom';
export type PasswordDelivery = 'showOnScreen' | 'sendEmail' | 'none';
// Controls how catalogue-header login/signup buttons surface auth.
// - "page" (default): navigate to /login or /signup
// - "modal": open the AuthModal in-place
export type StudentAuthPresentation = 'page' | 'modal';

export interface StudentSignupSettings {
    // Master toggle: when false, signup is hidden in catalogue UI
    // (e.g. "Sign Up" auth links are filtered out). Default: true.
    enabled?: boolean;
    providers: {
        google: boolean;
        github: boolean;
        usernamePassword: boolean;
        emailOtp: boolean;
        defaultProvider: StudentDefaultProvider;
    };
    usernameStrategy: UsernameStrategy;
    passwordStrategy: PasswordStrategy;
    passwordDelivery: PasswordDelivery;
    presentation?: StudentAuthPresentation;
}

// UI
export type StudentUiType = 'default' | 'vibrant' | 'play' | 'cleanerPlay';
export interface StudentUiSettings {
    type: StudentUiType;
}

// Course details settings
export type StudentCourseDetailsTabId =
    | 'OUTLINE'
    | 'CONTENT_STRUCTURE'
    | 'TEACHERS'
    | 'ASSESSMENTS';

export interface StudentCourseDetailsTabConfig {
    id: StudentCourseDetailsTabId;
    label?: string;
    order: number;
    visible: boolean;
}

export type OutlineMode = 'expanded' | 'collapsed';

/**
 * How the slide viewer's left sidebar lets the learner navigate course content.
 * - "breadcrumb": Sidebar shows only the current chapter's slide list; learners
 *   jump across modules/subjects via breadcrumb popovers (legacy layout).
 * - "ancestors": Sidebar shows the full Subject → Module → Chapter → Slide tree.
 */
export type SlidesSidebarNavigation = 'breadcrumb' | 'ancestors';

export interface StudentCourseDetailsSettings {
    tabs: StudentCourseDetailsTabConfig[];
    defaultTab: StudentCourseDetailsTabId;
    outlineMode: OutlineMode;
    ratingsAndReviewsVisible: boolean;
    /** Hide the "Author" row in the course-details Course Overview panel. Default false (author shown). */
    hideAuthorName?: boolean;
    /** Show the Teachers/Instructors section on the course-details page. Default false (hidden). */
    showInstructors?: boolean;
    // New toggles
    showCourseConfiguration: boolean;
    showCourseContentPrefixes: boolean;
    courseOverview: { visible: boolean; showSlidesData: boolean };
    slidesView: {
        showLearningPath: boolean;
        feedbackVisible: boolean;
        canAskDoubt: boolean;
        /** Optional for backwards compat. Missing means default ("breadcrumb"). */
        sidebarNavigation?: SlidesSidebarNavigation;
    };
}

// Course Settings
export interface StudentCourseSettings {
    quiz: {
        moveOnlyOnCorrectAnswer: boolean;
        celebrateOnQuizComplete: boolean;
        showReportAndCorrectAnswers: boolean;
    };
}

// All Courses page settings
export type StudentAllCoursesTabId = 'InProgress' | 'Completed' | 'AllCourses';

export interface StudentAllCoursesTabConfig {
    id: StudentAllCoursesTabId;
    label?: string;
    order: number;
    visible: boolean;
}

export interface StudentAllCoursesSettings {
    tabs: StudentAllCoursesTabConfig[];
    defaultTab: StudentAllCoursesTabId;
    /** Hide the instructor/teacher name block on each course card in the All Courses list. Default false (shown). */
    hideInstructorName?: boolean;
}

// Permissions
export interface StudentPermissions {
    canViewProfile: boolean;
    canEditProfile: boolean;
    canDeleteProfile: boolean;
    canViewFiles: boolean;
    canViewReports: boolean;
}

// Profile page
export interface StudentProfileSettings {
    // Whether the "Membership Status" card (Access Days + expiry date) is shown
    // on the learner's Profile tab. Default: false (hidden).
    showMembershipStatus: boolean;
}

// Certificates
export interface StudentCertificateSettings {
    // Whether certificates feature is enabled
    enabled: boolean;
    // Percentage threshold after which certificate can be generated
    generationThresholdPercent: number;
}

// Guided in-app tutorials (learner Help menu). The learner app reads exactly
// these keys from STUDENT_DISPLAY_SETTINGS — do not rename.
export interface StudentTutorialSettings {
    // Master toggle. Default false (tutorials hidden).
    enabled: boolean;
    // Which tours are offered. Default: all LEARNER_TOUR_KEYS.
    enabledTours: string[];
    // Offer a downloadable, institute-branded how-to PDF (chapters follow
    // enabledTours) in the learner Help menu. Default false.
    pdfGuideEnabled: boolean;
}

// Fixed tour registry keys — the learner app matches on these exact strings.
export const LEARNER_TOUR_KEYS = [
    'dashboard-overview',
    'browse-courses',
    'watch-content',
    'take-assessment',
    'join-live-class',
    'view-progress',
] as const;

export type LearnerTourKey = (typeof LEARNER_TOUR_KEYS)[number];

export interface LearnerTourOption {
    key: LearnerTourKey;
    label: string;
    description: string;
}

// Labels/descriptions read the institute's Naming Settings at call time, so this
// is a function rather than a module-scope const (terminology loads after boot).
export function getLearnerTourOptions(): LearnerTourOption[] {
    const courses = getTerminologyPlural(ContentTerms.Course, SystemTerms.Course).toLowerCase();
    const course = getTerminology(ContentTerms.Course, SystemTerms.Course).toLowerCase();
    const slides = getTerminologyPlural(ContentTerms.Slide, SystemTerms.Slide).toLowerCase();
    const liveSession = getTerminology(
        ContentTerms.LiveSession,
        SystemTerms.LiveSession
    ).toLowerCase();
    const learners = getTerminologyPlural(RoleTerms.Learner, SystemTerms.Learner).toLowerCase();
    return [
        {
            key: 'dashboard-overview',
            label: 'Getting around the app',
            description: `A quick orientation of the dashboard and sidebar for new ${learners}.`,
        },
        {
            key: 'browse-courses',
            label: `Browse & open ${courses}`,
            description: `How to find ${courses} and open one from the library.`,
        },
        {
            key: 'watch-content',
            label: `Watch videos & study ${slides}`,
            description: `How to play videos and move through ${course} ${slides}.`,
        },
        {
            key: 'take-assessment',
            label: 'Take an assessment',
            description: 'How to start, answer and submit an assessment.',
        },
        {
            key: 'join-live-class',
            label: `Join a ${liveSession}`,
            description: `How to find the schedule and join a ${liveSession}.`,
        },
        {
            key: 'view-progress',
            label: 'Track learning progress',
            description: 'Where to see completion, scores and learning analytics.',
        },
    ];
}

// Live classes — what learners may see about PAST live sessions. All default
// false; enforced server-side by the learner past-sessions endpoint.
export interface StudentLiveClassesSettings {
    showPastSessions: boolean;
    showRecordings: boolean;
    showAttendance: boolean;
    showActivityStats: boolean;
    showClassMaterials: boolean;
}

// Root schema
export interface StudentDisplaySettingsData {
    sidebar: {
        visible: boolean; // toggle to show/hide entire sidebar
        tabs: StudentSidebarTabConfig[];
    };
    dashboard: {
        widgets: StudentDashboardWidgetConfig[];
    };
    ui: StudentUiSettings;
    signup: StudentSignupSettings;
    permissions: StudentPermissions;
    profile: StudentProfileSettings;
    courseDetails: StudentCourseDetailsSettings;
    courseSettings: StudentCourseSettings;
    allCourses: StudentAllCoursesSettings;
    notifications: {
        allowSystemAlerts: boolean;
        allowDashboardPins: boolean;
        allowBatchStream: boolean;
        // Full-screen APP_OVERLAY announcements on app open. Default true.
        allowAppOverlays: boolean;
    };
    certificates: StudentCertificateSettings;
    liveClasses: StudentLiveClassesSettings;
    tutorials: StudentTutorialSettings;
    postLoginRedirectRoute: string;
}
