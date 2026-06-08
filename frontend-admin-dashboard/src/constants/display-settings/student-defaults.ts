import type {
    StudentDisplaySettingsData,
    StudentSidebarTabConfig,
    StudentDashboardWidgetConfig,
} from '@/types/student-display-settings';

function defaultSidebarTabs(): StudentSidebarTabConfig[] {
    return [
        { id: 'dashboard', order: 1, visible: true },
        {
            id: 'learning-center',
            order: 2,
            visible: true,
            subTabs: [
                { id: 'study-library', route: '/study-library', order: 1, visible: true },
                { id: 'attendance', route: '/learning-centre/attendance', order: 2, visible: true },
                { id: 'live-classes', route: '/study-library/live-class', order: 3, visible: true },
            ],
        },
        {
            id: 'homework',
            order: 3,
            // Hidden from learners by default; admins can enable it in Student Display settings.
            visible: false,
            subTabs: [
                { id: 'homework-list', route: '/homework/list', order: 1, visible: true },
                { id: 'homework-reports', route: '/homework/reports', order: 2, visible: true },
            ],
        },
        {
            id: 'assessment-center',
            order: 4,
            visible: true,
            subTabs: [
                { id: 'assessment-list', route: '/assessment/list', order: 1, visible: true },
                { id: 'assessment-reports', route: '/assessment/reports', order: 2, visible: true },
            ],
        },
        {
            id: 'planning',
            order: 5,
            // Hidden from learners by default; admins can enable it in Student Display settings.
            visible: false,
            subTabs: [
                { id: 'planning-logs', route: '/planning/planning-logs', order: 1, visible: true },
                { id: 'activity-logs', route: '/planning/activity-logs', order: 2, visible: true },
            ],
        },
        // Hidden from learners by default; admins can enable it in Student Display settings.
        { id: 'referral', order: 6, visible: false },
        { id: 'attendance', order: 7, visible: true },
    ];
}

function defaultDashboardWidgets(): StudentDashboardWidgetConfig[] {
    const ids: StudentDashboardWidgetConfig['id'][] = [
        'coursesStat',
        'assessmentsStat',
        'evaluationStat',
        'continueLearning',
        'learningAnalytics',
        'activityTrend',
        'dailyProgress',
        'liveClasses',
        'thisWeekAttendance',
        'referAFriend',
        'myClasses',
        'myMembership',
        'myBooks',
        'upcomingLiveClasses',
    ];
    return ids.map((id, idx) => ({ id, order: idx + 1, visible: true }));
}

export const DEFAULT_STUDENT_DISPLAY_SETTINGS: StudentDisplaySettingsData = {
    sidebar: {
        visible: true,
        tabs: defaultSidebarTabs(),
    },
    dashboard: {
        widgets: defaultDashboardWidgets(),
    },
    ui: {
        type: 'default',
    },
    signup: {
        enabled: true,
        providers: {
            google: true,
            github: false,
            usernamePassword: true,
            emailOtp: false,
            defaultProvider: 'google',
        },
        usernameStrategy: 'email',
        passwordStrategy: 'manual',
        passwordDelivery: 'none',
        presentation: 'page',
    },
    permissions: {
        canViewProfile: true,
        canEditProfile: true,
        canDeleteProfile: false,
        canViewFiles: false,
        canViewReports: false,
    },
    courseDetails: {
        tabs: [
            { id: 'OUTLINE', order: 1, visible: true },
            { id: 'CONTENT_STRUCTURE', order: 2, visible: true },
            { id: 'TEACHERS', order: 3, visible: true },
            { id: 'ASSESSMENTS', order: 4, visible: true },
        ],
        defaultTab: 'OUTLINE',
        outlineMode: 'expanded',
        ratingsAndReviewsVisible: true,
        showCourseConfiguration: true,
        showCourseContentPrefixes: true,
        courseOverview: { visible: true, showSlidesData: true },
        slidesView: {
            showLearningPath: true,
            feedbackVisible: true,
            canAskDoubt: true,
            // "breadcrumb" = legacy chapter-scoped slide list; cross-module
            // navigation happens via the breadcrumb popovers at the top of
            // the viewer. Switch to "ancestors" to show the full
            // Subject → Module → Chapter → Slide tree in the sidebar.
            sidebarNavigation: 'breadcrumb',
        },
    },
    courseSettings: {
        quiz: {
            moveOnlyOnCorrectAnswer: false,
            celebrateOnQuizComplete: true,
            showReportAndCorrectAnswers: true,
        },
    },
    allCourses: {
        tabs: [
            { id: 'InProgress', order: 1, visible: true },
            { id: 'Completed', order: 2, visible: true },
            { id: 'AllCourses', order: 3, visible: true },
        ],
        defaultTab: 'InProgress',
    },
    notifications: {
        allowSystemAlerts: true,
        allowDashboardPins: true,
        allowBatchStream: true,
    },
    certificates: {
        enabled: true,
        generationThresholdPercent: 80,
    },
    postLoginRedirectRoute: '/dashboard',
};
