import { SidebarItemsData } from '@/components/common/layout-container/sidebar/utils';
import type { SidebarItemsType } from '@/types/layout-container/layout-container-types';
import type {
    DisplaySettingsData,
    SidebarTabConfig,
    DashboardWidgetConfig,
} from '@/types/display-settings';

function mapSidebarToTeacherConfig(menu: SidebarItemsType[]): SidebarTabConfig[] {
    return menu
        .filter((item) => item.id !== 'settings') // settings tab must be hidden for teacher
        .map((item, index) => ({
            id: item.id,
            label: item.title,
            route: item.to,
            order: index + 1,
            // By default, show everything except tabs which are inherently admin-only filtered elsewhere;
            // allow the settings engine to toggle visibility later
            visible:
                item.id !== 'manage-institute' &&
                item.id !== 'user-tags' &&
                item.id !== 'manage-payments' &&
                item.id !== 'membership-expiry' &&
                item.id !== 'membership-stats' &&
                item.id !== 'membership-stats' &&
                item.id !== 'manage-contacts' &&
                item.id !== 'admissions' &&
                item.id !== 'fee-management' &&
                item.id !== 'membership-management' &&
                item.id !== 'automations' &&
                item.id !== 'manage-contacts'
                    ? true
                    : false,
            subTabs:
                item.subItems?.map((sub, subIndex) => ({
                    id: sub.subItemId || sub.subItem || `${item.id}-${subIndex + 1}`,
                    label: sub.subItem,
                    route: sub.subItemLink || '#',
                    order: subIndex + 1,
                    visible: true,
                })) || [],
        }));
}

function defaultDashboardWidgetsTeacher(): DashboardWidgetConfig[] {
    // Teacher defaults: no institute overview/admin analytics widgets by default
    const ids: DashboardWidgetConfig['id'][] = [
        'myCourses',
        'unresolvedDoubts',
        'learningCenter',
        'assessmentCenter',
        'aiFeaturesCard',
        'liveClasses',
    ];
    return ids.map((id, idx) => ({ id, order: idx + 1, visible: true }));
}

export const DEFAULT_TEACHER_DISPLAY_SETTINGS: DisplaySettingsData = {
    sidebar: mapSidebarToTeacherConfig(SidebarItemsData),
    dashboard: {
        widgets: defaultDashboardWidgetsTeacher(),
    },
    coursePage: {
        viewInviteLinks: true,
        viewShortInviteLinks: false,
        viewCourseConfiguration: true,
        viewCourseOverviewItem: true,
        viewContentNumbering: true,
    },
    courseList: {
        tabs: [
            { id: 'AllCourses', order: 1, visible: true },
            { id: 'AuthoredCourses', order: 2, visible: true },
            { id: 'CourseInReview', order: 3, visible: true },
            { id: 'CourseApproval', order: 4, visible: false },
        ],
        defaultTab: 'AuthoredCourses',
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
        defaultTab: 'CONTENT_STRUCTURE',
    },
    permissions: {
        canViewInstituteDetails: false,
        canEditInstituteDetails: false,
        canViewProfileDetails: true,
        canEditProfileDetails: false,
    },
    ui: {
        showSupportButton: true,
        showSidebar: true,
        showAiCredits: false,
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
    },
    slideView: {
        showCopyTo: true,
        showMoveTo: true,
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
    },
    learnerManagement: {
        allowPortalAccess: true,
        allowViewPassword: true,
        allowSendResetPasswordMail: true,
    },
    postLoginRedirectRoute: '/dashboard',
};
