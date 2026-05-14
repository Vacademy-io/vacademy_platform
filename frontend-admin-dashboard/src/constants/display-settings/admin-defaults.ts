import { SidebarItemsData } from '@/components/common/layout-container/sidebar/utils';
import type { SidebarItemsType } from '@/types/layout-container/layout-container-types';
import type {
    DisplaySettingsData,
    SidebarTabConfig,
    DashboardWidgetConfig,
} from '@/types/display-settings';

// Sub-items that should default to hidden. Admins can opt them in via display settings.
const SUB_ITEMS_HIDDEN_BY_DEFAULT = new Set<string>(['suborg-teams']);

function mapSidebarToConfig(menu: SidebarItemsType[]): SidebarTabConfig[] {
    return menu.map((item, index) => ({
        id: item.id,
        label: item.title,
        route: item.to,
        order: index + 1,
        visible: item.id !== 'admissions' && item.id !== 'fee-management',
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
    const ids: DashboardWidgetConfig['id'][] = [
        'recentNotifications',
        'realTimeActiveUsers',
        'currentlyActiveUsers',
        'userActivitySummary',
        'enrollLearners',
        'learningCenter',
        'assessmentCenter',
        'roleTypeUsers',
        'unresolvedDoubts',
        'instituteOverview',
        'aiFeaturesCard',
        'liveClasses',
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
            { id: 'PLANNING', order: 6, visible: false },
            { id: 'ACTIVITY', order: 7, visible: false },
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
    },
    authoredCoursesCard: {
        showCopyToEdit: true,
        showDelete: true,
    },
    courseListCard: {
        showEnrolledStudentCount: false,
    },
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
        fileTab: false,
        portalAccessTab: false,
        reportsTab: false,
        enrollDerollTab: false,
        enquiryTab: false,
        applicationTab: false,
        leadTab: false,
        fullHistoryTab: false,
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
            files: 9,
            portalAccess: 10,
            reports: 11,
            enrollDeroll: 12,
            enquiry: 13,
            application: 14,
            lead: 15,
            fullHistory: 16,
        },
        defaultTab: 'overview',
    },
    learnerManagement: {
        allowPortalAccess: true,
        allowViewPassword: true,
        allowSendResetPasswordMail: true,
        showApprovalToggle: true,
    },
    postLoginRedirectRoute: '/dashboard',
};
