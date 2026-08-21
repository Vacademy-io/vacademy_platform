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
/**
 * Every id the learner dashboard actually renders. Keep in sync with the
 * learner app's StudentDashboardWidgetId.
 */
export type StudentDashboardWidgetId =
    // The "Let's get you started" first-run onboarding checklist in the hero
    // band. Only the default/vibrant hero has one — the play / cleaner-play
    // heroes show a greeting band instead, which this flag does not affect.
    | 'gettingStarted'
    // The XP / streak / badges block at the bottom of the dashboard. Covers
    // both the standard panel and the play theme's own trio of widgets. Note
    // the badges card has a second, narrower switch of its own (the badge
    // config's master toggle); this flag hides the whole block.
    | 'gamification'
    | 'coursesStat'
    | 'evaluationStat'
    | 'continueLearning'
    | 'learningAnalytics'
    | 'liveClasses'
    | 'thisWeekAttendance'
    | 'myMembership'
    | 'myBooks'
    | 'upcomingLiveClasses'
    | 'myMentors'
    | 'myOrders'
    // Bottom-of-page commerce CTAs. Separate from myMembership / myBooks so the
    // widget and the "go buy more" button can be controlled independently.
    | 'exploreMemberships'
    | 'exploreBooks'
    | 'custom';

/**
 * Ids that used to be offered here but that the learner dashboard never reads.
 * Toggling them did nothing, so they are filtered out of the settings UI. They
 * may still exist in an institute's saved JSON — harmless, and left in place so
 * this list stays a pure display filter rather than a destructive migration.
 */
export const RETIRED_WIDGET_IDS: ReadonlySet<string> = new Set([
    'assessmentsStat',
    'activityTrend',
    'dailyProgress',
    'myClasses',
    'referAFriend',
]);

/** Human labels for the settings screen — `w.id` alone reads like a variable name. */
export const WIDGET_LABELS: Record<string, string> = {
    gettingStarted: "Getting Started checklist (“Let's get you started”)",
    continueLearning: 'Continue Learning',
    coursesStat: 'Courses (stat card)',
    liveClasses: 'Live Sessions (stat card)',
    evaluationStat: 'Assessments (stat card)',
    learningAnalytics: 'Learning Analytics',
    myMembership: 'My Membership',
    myBooks: 'My Books',
    myOrders: 'My Orders',
    upcomingLiveClasses: 'Upcoming Live Classes',
    myMentors: 'My Mentors',
    thisWeekAttendance: 'Attendance (this week)',
    gamification: 'Gamification (XP, streak, badges)',
    exploreMemberships: 'Explore Memberships (button)',
    exploreBooks: 'Explore Books (button)',
    custom: 'Custom',
};

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
export type SlidesSidebarNavigation = 'breadcrumb' | 'ancestors' | 'hidden';

/**
 * Layout of the course-details page once the learner is ENROLLED in the course.
 *
 * - "full" (default): today's page — banner, description/tags, course
 *   highlights, the enrollment/configuration block and the right-hand overview
 *   card, with every visible tab.
 * - "contentOnly": a focused page for institutes that treat course-details as
 *   a table of contents rather than a sales page. Everything marketing-shaped
 *   is dropped (description, tags, media, highlights, author, right-hand card)
 *   and the page renders the Content Structure card alone, which drills
 *   Subject → Module → Chapter → Slides as cards.
 *
 * Scope: the learner's own course page under /study-library — the surface they
 * land on after enrolling. The shopper-facing pages (/courses/course-details
 * and the public catalogue) are separate components and are never affected, so
 * a buyer still gets the description, price and author they need to decide.
 */
export type EnrolledCourseLayout = 'full' | 'contentOnly';

/**
 * How a Content Structure card fits its thumbnail.
 *
 * - `cover`   fills the 16:9 frame and crops whatever overflows (today's
 *             behaviour, and what the admin dashboard does)
 * - `contain` shows the whole image, letterboxed inside the frame
 *
 * Worth a setting because it depends entirely on the artwork: a photo wants
 * `cover`, a designed thumbnail with a title baked into it gets its wording
 * sliced off and wants `contain`.
 */
export type ContentCardImageFit = 'cover' | 'contain';

/**
 * How far the learner must get before the "Give Feedback" slide is offered.
 * "CHAPTER" (default) is today's behaviour — after every chapter. MODULE /
 * SUBJECT / COURSE ask once per section instead, which is what a long course
 * wants; NEVER disables the auto-open while leaving the sidebar's Feedback
 * button working.
 */
export type FeedbackTrigger = 'CHAPTER' | 'MODULE' | 'SUBJECT' | 'COURSE' | 'NEVER';

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
        /**
         * Collapse the app's own left nav rail while the slide viewer is open,
         * the way focus mode does. Unset means "follow the sidebar mode": the
         * sidebar-less viewer collapses the rail, every other mode leaves it
         * alone. An explicit true/false always wins.
         */
        collapseSidebarOnOpen?: boolean;
        /**
         * Show an explicit "Mark as complete" control in the slide viewer — the
         * checkbox Udemy, Coursera and LinkedIn Learning put beside a lesson.
         * Automatic tracking is unchanged; this is the manual override for what
         * dwell-time and watch-percentage cannot see. Writes the same progress
         * record as the automatic path and is reversible.
         *
         * Tri-state, like collapseSidebarOnOpen: unset follows the sidebar mode
         * (the sidebar-less viewer shows it, since it has no tick list or
         * progress readout of its own), explicit true/false wins.
         */
        manualCompletion?: boolean;
        /**
         * "Chapter complete — next up" hand-off bar. Tri-state: unset follows
         * the sidebar mode (shown only in the sidebar-less viewer, the one that
         * dead-ends without it), explicit true/false wins.
         */
        chapterCompleteCta?: boolean;
        /**
         * Whether the "Give Feedback" slide sits in the Prev/Next sequence.
         * Tri-state: unset follows the sidebar mode. Independent of
         * feedbackVisible, which is the master switch.
         */
        feedbackInSlideNav?: boolean;
        /** See {@link FeedbackTrigger}. Missing means 'CHAPTER' (today). */
        feedbackTrigger?: FeedbackTrigger;
    };
    /** See {@link EnrolledCourseLayout}. Optional for backwards compat; missing
     *  means "full" so saved settings keep rendering today's page. */
    enrolledLayout?: EnrolledCourseLayout;
    /**
     * Tapping a chapter card opens its first available slide straight in the
     * viewer instead of listing the chapter's slides first. Tri-state: unset
     * follows enrolledLayout (content-only skips the list), explicit wins.
     */
    chapterOpensFirstSlide?: boolean;
  /** See {@link ContentCardImageFit}. Missing means "cover" (today). */
  contentCardImageFit?: ContentCardImageFit;
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

// Certificate settings used to be duplicated here. Certificate Settings is now
// the single source of truth; the learner app reads the resolved values from
// GET /admin-core-service/certificate/learner/v1/config.

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
    liveClasses: StudentLiveClassesSettings;
    tutorials: StudentTutorialSettings;
    postLoginRedirectRoute: string;
}
