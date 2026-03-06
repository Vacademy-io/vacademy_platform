// Types that define Admin/Teacher display settings configuration

export type UserRoleForDisplaySettings = 'ADMIN' | 'TEACHER';

// Identifier for a top-level sidebar tab
export interface SidebarTabConfig {
    id: string; // e.g., 'dashboard', 'manage-institute'
    label?: string; // optional custom display label
    route?: string; // route for non-collapsible tabs or custom tabs
    order: number; // ordering among tabs
    visible: boolean; // whether the tab is visible for the role
    locked?: boolean; // whether the tab is locked for the role
    // List of sub-tabs (if any). For non-collapsible tabs this can be empty
    subTabs?: Array<{
        id: string; // e.g., 'batches', 'sessions'
        label?: string; // optional custom label
        route: string; // route to navigate when selected
        order: number; // ordering among sub-tabs
        visible: boolean; // whether the sub-tab is visible for the role
        locked?: boolean; // whether the sub-tab is locked for the role
    }>;
    // Whether this tab was added as a custom tab from settings
    isCustom?: boolean;
}

// Dashboard widget identifiers. These are string literal ids that we can enforce in UI.
// The list is derived from widgets present in `src/routes/dashboard/index.tsx`.
export type DashboardWidgetId =
    | 'recentNotifications'
    | 'realTimeActiveUsers'
    | 'currentlyActiveUsers'
    | 'userActivitySummary'
    | 'enrollLearners'
    | 'learningCenter'
    | 'assessmentCenter'
    | 'roleTypeUsers'
    | 'myCourses'
    | 'unresolvedDoubts'
    | 'liveClasses'
    | 'aiFeaturesCard'
    | 'instituteOverview';

export interface DashboardWidgetConfig {
    id: DashboardWidgetId;
    order: number;
    visible: boolean;
}

export type CourseListTabId =
    | 'AllCourses'
    | 'AuthoredCourses'
    | 'CourseApproval'
    | 'CourseInReview';

export interface CourseListTabConfig {
    id: CourseListTabId;
    label?: string;
    order: number;
    visible: boolean;
}

export type CourseDetailsTabId =
    | 'OUTLINE'
    | 'CONTENT_STRUCTURE'
    | 'LEARNER'
    | 'TEACHER'
    | 'ASSESSMENT'
    | 'PLANNING'
    | 'ACTIVITY';

export interface CourseDetailsTabConfig {
    id: CourseDetailsTabId;
    label?: string;
    order: number;
    visible: boolean;
}

// 5) Course content type visibility controls
export interface CourseContentTypeSettings {
    pdf: boolean;
    video: {
        enabled: boolean;
        showInVideoQuestion: boolean;
    };
    codeEditor: boolean;
    document: boolean;
    question: boolean;
    quiz: boolean;
    assignment: boolean;
    jupyterNotebook: boolean;
    scratch: boolean;
}

export interface CourseCreationSettings {
    // Whether to expose the "Create Course with AI" entry points
    showCreateCourseWithAI: boolean;
    // Require selecting package sessions when creating a new chapter
    requirePackageSelectionForNewChapter: boolean;
    // Toggle visibility of advanced options inside course creation flows
    showAdvancedSettings: boolean;
    // Restrict the course hierarchy to a single level (no nested modules)
    limitToSingleLevel: boolean;
}

export interface StudentSideViewSettings {
    overviewTab: boolean;
    testTab: boolean;
    progressTab: boolean;
    coursesTab: boolean;
    notificationTab: boolean;
    membershipTab: boolean;
    paymentHistoryTab: boolean;
    userTaggingTab: boolean;
    fileTab: boolean;
    portalAccessTab: boolean;
    reportsTab: boolean;
    enrollDerollTab: boolean;
    enquiryTab: boolean;
}

export interface LearnerManagementSettings {
    allowPortalAccess: boolean;
    allowViewPassword: boolean;
    allowSendResetPasswordMail: boolean;
}

export interface DisplaySettingsData {
    // 1) Sidebar tabs and sub-tabs configuration and ordering
    sidebar: SidebarTabConfig[];

    // 2) Dashboard widgets visibility and ordering
    dashboard: {
        widgets: DashboardWidgetConfig[];
    };

    // 3) Course list page tab configuration
    courseList?: {
        tabs: CourseListTabConfig[];
        defaultTab: CourseListTabId;
    };

    // 4) Course details tab configuration
    courseDetails?: {
        tabs: CourseDetailsTabConfig[];
        defaultTab: CourseDetailsTabId;
    };

    // 5) Permissions and profile visibility/editing controls
    permissions: {
        canViewInstituteDetails: boolean;
        canEditInstituteDetails: boolean;
        canViewProfileDetails: boolean;
        canEditProfileDetails: boolean;
    };

    // 6) Global UI toggles
    ui?: {
        showSupportButton: boolean;
        // Controls whether the left sidebar is shown for this role
        showSidebar?: boolean;
        showAiCredits?: boolean;
    };

    // 7) Course content types (slides) visibility
    contentTypes?: CourseContentTypeSettings;

    // 8) Post-login redirect route
    postLoginRedirectRoute: string; // e.g., '/dashboard'

    // 9) Course page level visibility toggles
    coursePage?: {
        viewInviteLinks: boolean;
        viewShortInviteLinks: boolean;
        viewCourseConfiguration: boolean;
        viewCourseOverviewItem: boolean;
        viewContentNumbering: boolean;
    };

    // 10) Slide view action visibility toggles
    slideView?: {
        showCopyTo: boolean;
        showMoveTo: boolean;
    };

    // 11) Course creation configuration
    courseCreation?: CourseCreationSettings;

    // 12) Student portal side-view tab visibility
    studentSideView?: StudentSideViewSettings;

    // 13) Learner management permissions for admins/teachers
    learnerManagement?: LearnerManagementSettings;

    // 14) Sidebar Category Configuration
    sidebarCategories?: Array<{
        id: 'CRM' | 'LMS' | 'AI';
        visible: boolean;
        locked?: boolean; // whether the category is locked
        default: boolean; // Is this the default category on load?
        order?: number; // Optional ordering
    }>;
}

export const ADMIN_DISPLAY_SETTINGS_KEY = 'ADMIN_DISPLAY_SETTINGS' as const;
export const TEACHER_DISPLAY_SETTINGS_KEY = 'TEACHER_DISPLAY_SETTINGS' as const;
export const CUSTOM_ROLE_DISPLAY_SETTINGS_KEY = 'CUSTOM_ROLE_DISPLAY_SETTINGS_KEY' as const;
