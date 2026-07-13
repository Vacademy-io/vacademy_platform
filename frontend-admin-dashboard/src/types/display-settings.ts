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
    // For custom tabs: which sidebar category (CRM/LMS/AI) it belongs to.
    // Built-in tabs derive their category from SidebarItemsData; this only applies
    // to user-added custom tabs whose id isn't in SidebarItemsData.
    category?: 'CRM' | 'LMS' | 'AI';
}

// Dashboard widget identifiers. These are string literal ids that we can enforce in UI.
// The list is derived from widgets present in `src/routes/dashboard/index.tsx`.
export type DashboardWidgetId =
    | 'quickActions'
    | 'pendingActions'
    | 'kpiBand'
    | 'financeSummary'
    | 'recentTransactions'
    | 'recentNotifications'
    | 'realTimeActiveUsers'
    | 'currentlyActiveUsers'
    | 'userActivitySummary'
    | 'dailyActivityTrend'
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
    | 'LIVE_SESSION'
    | 'PLANNING'
    | 'ACTIVITY'
    | 'SETTINGS';

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
    ppt: boolean;
    audio: boolean;
    scorm: boolean;
    assessment: boolean;
}

export interface CourseCreationSettings {
    // Allow a permission-gated custom role to see the "Add Course" button even
    // without a CREATE_COURSE access mapping. Opt-in per role; undefined/false
    // preserves the default gating (admins/CREATE_COURSE holders only).
    showCreateCourse?: boolean;
    // Whether to expose the "Create Course with AI" entry points
    showCreateCourseWithAI: boolean;
    // Require selecting package sessions when creating a new chapter
    requirePackageSelectionForNewChapter: boolean;
    // Toggle visibility of advanced options inside course creation flows
    showAdvancedSettings: boolean;
    // Restrict the course hierarchy to a single level (no nested modules)
    limitToSingleLevel: boolean;
}

// Stable identifiers for the student side-view tabs. Used as keys in the
// settings ordering map and as values for the default-tab selector. These
// match the `setCategory(...)` strings the side-view component already uses.
export type StudentSideViewTabId =
    | 'overview'
    | 'courses'
    | 'learningProgress'
    | 'testRecord'
    | 'notifications'
    | 'membership'
    | 'paymentHistory'
    | 'userTagging'
    | 'badges'
    | 'files'
    | 'portalAccess'
    | 'reports'
    | 'enrollDeroll'
    | 'enquiry'
    | 'application'
    | 'lead'
    | 'fullHistory'
    | 'parent';

export interface StudentSideViewSettings {
    overviewTab: boolean;
    testTab: boolean;
    progressTab: boolean;
    coursesTab: boolean;
    notificationTab: boolean;
    membershipTab: boolean;
    paymentHistoryTab: boolean;
    userTaggingTab: boolean;
    badgesTab: boolean;
    fileTab: boolean;
    portalAccessTab: boolean;
    reportsTab: boolean;
    enrollDerollTab: boolean;
    enquiryTab: boolean;
    applicationTab: boolean;
    leadTab: boolean;
    fullHistoryTab?: boolean;
    // Guardian tab — surfaces the linked guardian/children (parent-link feature).
    // Optional for backward-compat with settings saved before this tab existed.
    parentTab?: boolean;
    // Custom ordering by tab id. Lower numbers render first. Tabs missing
    // from the map fall back to the default order. Optional for
    // backward-compat with settings that pre-date this feature.
    tabOrders?: Partial<Record<StudentSideViewTabId, number>>;
    // Tab to open by default when the side view first renders. Falls back to
    // the first visible tab if unset or if the chosen tab is hidden.
    defaultTab?: StudentSideViewTabId;

    // ─── Vacademy design-handoff tenant settings ────────────────────────
    // Phase C of the Learner Profile redesign. All optional + back-compat:
    // missing values fall through to sensible defaults so today's clients
    // see no change.

    /**
     * Navigation style inside the learner profile drawer.
     * 'tabs' (default) — horizontal scrolling tab bar (existing UX).
     * 'grouped'        — vertical 208px left-rail with sections grouped
     *                    under uppercase labels (Snapshot · Learning ·
     *                    Finance · CRM · Account · Records).
     */
    profileNavStyle?: 'tabs' | 'grouped';

    /**
     * Feature modules per the handoff's GROUP_TO_MODULE mapping. Disabling
     * a module removes its entire section group from the rail / tab bar.
     * Snapshot is always on (it has the Overview entry surface).
     */
    profileModules?: {
        learning?: boolean;
        finance?: boolean;
        crm?: boolean;
        account?: boolean;
        records?: boolean;
    };

    /**
     * Quick-action toggles for the Overview tab. Hides individual buttons
     * (Email / Call / WhatsApp) when off. Other actions (Edit Details,
     * Report, Copy credentials) are always shown.
     */
    profileQuickActions?: {
        email?: boolean;
        call?: boolean;
        whatsapp?: boolean;
    };
}

// Keys of StudentSideViewSettings that toggle a tab's visibility. Used by
// the settings UI to iterate only over the boolean visibility fields and
// avoid widening to ordering/default-tab fields.
export type StudentSideViewVisibilityKey =
    | 'overviewTab'
    | 'testTab'
    | 'progressTab'
    | 'coursesTab'
    | 'notificationTab'
    | 'membershipTab'
    | 'paymentHistoryTab'
    | 'userTaggingTab'
    | 'badgesTab'
    | 'fileTab'
    | 'portalAccessTab'
    | 'reportsTab'
    | 'enrollDerollTab'
    | 'enquiryTab'
    | 'applicationTab'
    | 'leadTab'
    | 'fullHistoryTab'
    | 'parentTab';

export interface LearnerManagementSettings {
    allowPortalAccess: boolean;
    allowViewPassword: boolean;
    allowSendResetPasswordMail: boolean;
    showApprovalToggle: boolean;
}

// Per-role column visibility on the manage-students learner-list. Holds the
// set of column accessors (system field accessorKey, e.g. 'mobile_number', or
// a custom-field UUID) this role must NOT see. Missing/empty list = role
// inherits the institute-wide defaults configured in CustomFieldsSettings.
//
// Precedence at render time:
//   1. Filter-driven visibility (Batch/Invite/Plan/Amount) ALWAYS wins — when
//      the filter is active those columns must be visible so the admin can
//      see what they filtered on.
//   2. Role hiddenColumns — forces those accessors hidden.
//   3. Institute-wide system field setting — admin-level defaults.
export interface LearnerListColumnSettings {
    // System field accessors this role has EXPLICITLY HIDDEN. Missing/empty list = role
    // sees all system columns. Default semantics: visible unless listed here.
    hiddenColumns: string[];

    // Custom field accessors (custom_field UUIDs) this role has EXPLICITLY ENABLED for
    // the learner-list table. Missing/empty = no custom fields visible for this role.
    // Default semantics: hidden unless listed here. (Opposite of hiddenColumns above.)
    // Admins opt in per role; new custom fields added later default to hidden until
    // an admin toggles them on.
    enabledCustomFields?: string[];

    // Whether the Total/Active/Inactive count badges show in the learner-list header
    // (Student list + Course Details → Learner tab). Missing = visible (default true).
    showCountBadges?: boolean;
}

export interface LiveClassSchedulingSettings {
    /** Whether the "Bulk Schedule" entry point is available for this role. */
    bulkScheduleEnabled: boolean;
    /** Whether the single-class scheduling page is available for this role. */
    singleScheduleEnabled: boolean;
}

export const DEFAULT_LIVE_CLASS_SCHEDULING_SETTINGS: LiveClassSchedulingSettings = {
    bulkScheduleEnabled: true,
    singleScheduleEnabled: true,
};

// Per-role control over which roles this role can see/select in the Team tab —
// in the role-type filter chips and the "Role Type" dropdown of the Invite
// User dialog. Keys are role names uppercased (matches backend authorities and
// RoleType.name from dummy-data), e.g. 'ADMIN', 'TEACHER', 'CONTENT CREATOR'.
// Missing keys default to true so existing institutes are unaffected.
export interface TeamManagementSettings {
    visibleRoles: Record<string, boolean>;
    // Whether the Org Chart tab shows up on /manage-institute/teams. Defaults
    // to FALSE (hidden) so the feature is opt-in per institute until we are
    // confident it works for that institute's users. Admins flip this on
    // from Settings → Admin Display Settings when they're ready to roll it out.
    orgChartTabVisible?: boolean;
}

// Opt-in flags for the counsellor workbench + sales dashboard routes. Both
// default to FALSE so the features stay hidden until an admin explicitly
// enables them. The routes themselves check these flags and render a
// "feature not enabled" message when off, so even a direct URL hit doesn't
// expose them to users whose institute hasn't opted in.
export interface WorkbenchVisibilitySettings {
    counsellorsPageVisible?: boolean;
    salesDashboardVisible?: boolean;
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
        // When true, non-admin users with HAS_FACULTY_ASSIGNED can navigate
        // into slides on a published / in-review course in read-only mode.
        // When false, slide click is blocked entirely (legacy behavior).
        allowViewSlidesInReadOnly?: boolean;
        // When true, non-admin roles bypass the read-only lock on published
        // courses and the Copy-to-Edit / Submit-for-Review approval flow —
        // they can edit and publish published courses directly.
        directEditPublishedCourse?: boolean;
        // When true, Edit buttons on Subject / Module / Chapter rows in the
        // Outline & Content Structure tabs are visible regardless of course
        // status. Admin always sees these; this flag is for non-admin roles.
        canEditCourseStructure?: boolean;
        // When true, Delete buttons on Subject / Module / Chapter rows are
        // visible regardless of course status.
        canDeleteCourseStructure?: boolean;
        // When true, the Course Details header shows a "..." menu exposing
        // raw IDs (course / package session / session / level) with copy.
        // Off by default — intended for admins debugging configuration.
        showAdvancedCourseIds?: boolean;
        // When true, the "Bulk Upload (ZIP)" button is shown in the Course
        // Structure header. Off by default for every role — opt-in per role
        // from Display Settings.
        showBulkUpload?: boolean;
    };

    // 10) Slide view action visibility toggles
    slideView?: {
        showCopyTo: boolean;
        showMoveTo: boolean;
        showDelete?: boolean;
        // Show the "Add Question" button on video slides (in-video question authoring)
        showAddVideoQuestion?: boolean;
        // Show the "Convert to Split Screen" button on video slides
        showConvertToSplitScreen?: boolean;
    };

    // 10b) Authored Courses card action visibility (Explore Courses → Authored tab)
    authoredCoursesCard?: {
        showCopyToEdit: boolean;
        showDelete: boolean;
    };

    // 10c) Course list card content visibility (Explore Courses → All / Authored cards)
    courseListCard?: {
        // Show the number of ACTIVE enrolled students on each course card
        showEnrolledStudentCount: boolean;
    };

    // 11) Course creation configuration
    courseCreation?: CourseCreationSettings;

    // 12) Student portal side-view tab visibility
    studentSideView?: StudentSideViewSettings;

    // 12b) Manage-students learner-list column visibility for this role.
    //      Independent from the institute-wide custom-field settings — this is the
    //      per-role overlay that admins use to hide columns from teachers etc.
    learnerListColumns?: LearnerListColumnSettings;

    // 12c) custom_field_ids exposed as filters on the leads views (open Lead List
    //      + Recent Leads). Each enabled field renders a searchable multi-select
    //      in the filter bar; empty/absent = no custom-field filters and the
    //      distinct-values API is never called. Saved with the rest of this blob
    //      via the display-settings unsaved-changes bar.
    leadsFilterCustomFields?: string[];

    // 13) Learner management permissions for admins/teachers
    learnerManagement?: LearnerManagementSettings;

    // 13b) Live class scheduling controls. Role-level overlay on top of the
    //      institute-level Live Session Settings — admin can hide bulk
    //      scheduling for specific roles even if it's institute-enabled.
    //      Both flags default to true so existing institutes are unaffected.
    liveClassScheduling?: LiveClassSchedulingSettings;

    // 13c) Team tab role-visibility controls. Restricts which roles the
    //      viewing role can see/select in the Team tab's role-type filter and
    //      the Invite User dialog. Self-role is always treated as visible by
    //      consumers to prevent lockout.
    teamManagement?: TeamManagementSettings;

    // Opt-in gates for the counsellor workbench (/counsellors) and the
    // sales dashboard (/sales-dashboard). Both default to false. See
    // WorkbenchVisibilitySettings for details.
    workbench?: WorkbenchVisibilitySettings;

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
