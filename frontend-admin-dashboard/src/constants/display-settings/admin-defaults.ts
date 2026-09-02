import { SidebarItemsData } from '@/components/common/layout-container/sidebar/utils';
import type { SidebarItemsType } from '@/types/layout-container/layout-container-types';
import type {
    DisplaySettingsData,
    SidebarTabConfig,
    DashboardWidgetConfig,
} from '@/types/display-settings';
import { DEFAULT_ASSESSMENT_ACTION_SETTINGS } from '@/types/display-settings';

// Sub-items that should default to hidden. Admins can opt them in via display settings.
const SUB_ITEMS_HIDDEN_BY_DEFAULT = new Set<string>([
    'suborg-teams',
    'manage-institute-suborgs',
    'notification-hub',
    // Workbench routes — gated until the institute has set up a leads team
    // and counsellor rating strategy. Admins flip them on per-institute from
    // Display Settings → CRM → Leads.
    'counsellors',
    'sales-dashboard',
    // AI calls waiting to go out. Off until an institute is actually running enough
    // AI calling for a queue to mean anything -- on a quiet institute nothing ever
    // waits, so the page would only ever show an empty table.
    'calling-call-queue',
]);

// Tabs that ship hidden until an institute admin opts them in via the
// Display Settings UI. Distinct from admissions/fee-management which are
// shipped hidden for historical sub-org reasons.
const OPT_IN_TAB_IDS = new Set<string>([
    'admin-activity-logs',
    'ai-copilot-tab',
    'mentorship',
    // NOTE: the ERP modules are deliberately NOT listed here. The opt-in gate
    // for ERP is the rail CATEGORY, which ships `visible: false` (see
    // display-settings.ts). Hiding the modules as well made turning the
    // category on produce an empty panel with no obvious way to fill it —
    // one deliberate switch is the gate, not eight.
]);

function mapSidebarToConfig(menu: SidebarItemsType[]): SidebarTabConfig[] {
    return menu.map((item, index) => ({
        id: item.id,
        label: item.title,
        route: item.to,
        order: index + 1,
        visible:
            item.id !== 'admissions' &&
            item.id !== 'fee-management' &&
            !OPT_IN_TAB_IDS.has(item.id),
        subTabs:
            item.subItems?.map((sub, subIndex) => {
                const id = sub.subItemId || sub.subItem || `${item.id}-${subIndex + 1}`;
                return {
                    id,
                    label: sub.subItem,
                    route: sub.subItemLink || '#',
                    order: subIndex + 1,
                    visible: !SUB_ITEMS_HIDDEN_BY_DEFAULT.has(id),
                };
            }) || [],
    }));
}

function defaultDashboardWidgetsAdmin(): DashboardWidgetConfig[] {
    // Every DashboardWidgetId must be listed here so it shows up as a row in
    // Settings → Display Settings → Dashboard Widgets. The list is ordered
    // top-to-bottom by operational priority so a brand-new institute lands on
    // a sensible dashboard, and so newly-added widgets (for existing users)
    // slot into the right priority bucket.
    //
    // Priority buckets (high → low):
    //   1. Navigation shortcuts          — always at top
    //   2. KPIs                          — at-a-glance metrics
    //   3. Tasks                         — work requiring action
    //   4. Operational health (finance)  — money flow + collections
    //   5. Engagement signals            — activity, doubts, notifications
    //   6. LMS operations                — classes, courses, assessments
    //   7. Reference data                — team makeup, institute summary
    //   8. Promotional                   — discovery cards, last slot
    const ids: DashboardWidgetConfig['id'][] = [
        // 1. Navigation shortcuts
        'quickActions',
        // 2. KPIs
        'kpiBand',
        // 3. Tasks
        'pendingActions',
        // 4. Operational health (finance)
        'financeSummary',
        'revenueTrends',
        'recentTransactions',
        'subOrgOverview',
        'subOrgSelfStats',
        'subOrgRevenueTrends',
        'subOrgGeography',
        'vleAnalytics',
        'topVles',
        'subOrgSeatCourses',
        'subOrgActivityDues',
        // 5. Engagement signals
        'unresolvedDoubts',
        'recentNotifications',
        'dailyActivityTrend',
        'userActivitySummary',
        'realTimeActiveUsers',
        'currentlyActiveUsers',
        // 6. LMS operations
        'liveClasses',
        'enrollLearners',
        'learningCenter',
        'assessmentCenter',
        'myCourses',
        'mentorshipStats',
        // 7. Reference data
        'roleTypeUsers',
        'instituteOverview',
        // 8. Promotional
        'aiFeaturesCard',
    ];
    return ids.map((id, idx) => ({ id, order: idx + 1, visible: true }));
}

export const DEFAULT_ADMIN_DISPLAY_SETTINGS: DisplaySettingsData = {
    sidebar: mapSidebarToConfig(SidebarItemsData),
    dashboard: {
        widgets: defaultDashboardWidgetsAdmin(),
    },
    coursePage: {
        viewInviteLinks: true,
        viewShortInviteLinks: false,
        viewCourseConfiguration: true,
        viewCourseOverviewItem: true,
        viewContentNumbering: true,
        allowViewSlidesInReadOnly: true,
        directEditPublishedCourse: true,
        canEditCourseStructure: true,
        canDeleteCourseStructure: true,
        showBulkUpload: false,
        showAddSubject: true,
        showAddModule: true,
        showAddChapter: true,
        showAddSlide: true,
        showLearnerProgressReport: true,
    },
    courseList: {
        tabs: [
            { id: 'AllCourses', order: 1, visible: true },
            { id: 'AuthoredCourses', order: 2, visible: true },
            { id: 'CourseApproval', order: 3, visible: true },
            { id: 'CourseInReview', order: 4, visible: false },
        ],
        defaultTab: 'AllCourses',
    },
    courseDetails: {
        tabs: [
            { id: 'OUTLINE', order: 1, visible: true },
            { id: 'CONTENT_STRUCTURE', order: 2, visible: true },
            { id: 'LEARNER', order: 3, visible: true },
            { id: 'TEACHER', order: 4, visible: true },
            { id: 'ASSESSMENT', order: 5, visible: true },
            { id: 'LIVE_SESSION', order: 6, visible: false },
            { id: 'PLANNING', order: 7, visible: false },
            { id: 'ACTIVITY', order: 8, visible: false },
            { id: 'PULSE', order: 9, visible: true },
            { id: 'REPORTS', order: 10, visible: true },
            { id: 'CERTIFICATES', order: 11, visible: false },
            // Listed here (rather than left implicit) so a saved `visible: false`
            // survives the merge-with-defaults on read/cache — ids absent from
            // the defaults are dropped as stale. Gated at render time on the
            // institute OFFLINE_ACCESS_SETTING master switch.
            { id: 'DOWNLOADS', order: 12, visible: true },
            { id: 'SETTINGS', order: 13, visible: false },
        ],
        defaultTab: 'OUTLINE',
    },
    permissions: {
        canViewInstituteDetails: true,
        canEditInstituteDetails: true,
        canViewProfileDetails: true,
        canEditProfileDetails: true,
    },
    ui: {
        showSupportButton: true,
        showSidebar: true,
        showAiCredits: true,
        showAssistDock: true,
        showStatus: true,
        showSettings: true,
    },
    contentTypes: {
        pdf: true,
        video: { enabled: true, showInVideoQuestion: true },
        codeEditor: true,
        document: true,
        question: true,
        quiz: true,
        assignment: true,
        jupyterNotebook: true,
        scratch: true,
        ppt: true,
        audio: true,
        scorm: true,
        assessment: true,
    },
    slideView: {
        showCopyTo: true,
        showMoveTo: true,
        showDelete: true,
        showAddVideoQuestion: true,
        showConvertToSplitScreen: true,
    },
    authoredCoursesCard: {
        showCopyToEdit: true,
        showDelete: true,
    },
    courseListCard: {
        showEnrolledStudentCount: false,
    },
    assessmentPage: { ...DEFAULT_ASSESSMENT_ACTION_SETTINGS },
    courseCreation: {
        showCreateCourseWithAI: false,
        requirePackageSelectionForNewChapter: true,
        showAdvancedSettings: true,
        limitToSingleLevel: false,
    },
    studentSideView: {
        overviewTab: true,
        testTab: true,
        progressTab: true,
        coursesTab: true,
        notificationTab: false,
        membershipTab: false,
        paymentHistoryTab: true,
        userTaggingTab: false,
        badgesTab: true,
        fileTab: false,
        portalAccessTab: false,
        reportsTab: false,
        enrollDerollTab: false,
        enquiryTab: false,
        applicationTab: false,
        leadTab: false,
        fullHistoryTab: false,
        // OFF by default for every role. Re-running an automation re-sends its
        // messages, so the tab is opt-in per role from Display Settings rather
        // than something that appears on every learner profile unasked.
        workflowsTab: false,
        parentTab: false,
        onboardingTab: false,
        // Default rendering order. Tabs render left-to-right by ascending number.
        // The keys match `StudentSideViewTabId` and the side-view's category strings.
        tabOrders: {
            overview: 1,
            courses: 2,
            learningProgress: 3,
            testRecord: 4,
            notifications: 5,
            membership: 6,
            paymentHistory: 7,
            userTagging: 8,
            badges: 9,
            files: 10,
            portalAccess: 11,
            reports: 12,
            enrollDeroll: 13,
            enquiry: 14,
            application: 15,
            lead: 16,
            fullHistory: 17,
            parent: 18,
            workflows: 19,
        },
        defaultTab: 'overview',
    },
    learnerManagement: {
        allowPortalAccess: true,
        allowViewPassword: true,
        allowSendResetPasswordMail: true,
        showApprovalToggle: true,
        // ON for admins, OFF for every other role (see teacher/custom defaults).
        // Changing credentials signs the learner out, so it stays an admin
        // capability unless an admin explicitly grants it to another role.
        allowEditCredentials: true,
    },
    studentManagementActions: {
        showEnrollButton: true,
        showInviteButton: true,
        customButtons: [],
    },
    subOrganizations: {
        // Off by default for every role — institutes opt in from Display Settings.
        // Keeps parity with the sidebar sub-item, which also ships hidden.
        moduleEnabled: false,
        // No channel partners granted at role level by default.
        assignedSubOrgIds: [],
        // Read-only out of the box; admins opt each write capability in per role.
        permissions: {
            canCreate: false,
            canEditConfig: false,
            canManageTeam: false,
            canViewFinance: true,
            canManageFinance: false,
            canExport: true,
        },
    },
    leadsFilterCustomFields: [],
    postLoginRedirectRoute: '/dashboard',
};
