// Types for Student Display Settings (Learner Portal)

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
export type StudentUiType = 'default' | 'vibrant' | 'play';
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
    };
    certificates: StudentCertificateSettings;
    liveClasses: StudentLiveClassesSettings;
    postLoginRedirectRoute: string;
}
