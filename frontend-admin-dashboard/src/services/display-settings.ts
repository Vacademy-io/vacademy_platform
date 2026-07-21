import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getInstituteId } from '@/constants/helper';
import { BASE_URL } from '@/constants/urls';
import {
    ADMIN_DISPLAY_SETTINGS_KEY,
    TEACHER_DISPLAY_SETTINGS_KEY,
    CUSTOM_ROLE_DISPLAY_SETTINGS_KEY,
    type DisplaySettingsData,
} from '@/types/display-settings';
import { StorageKey } from '@/constants/storage/storage';
import { DEFAULT_ADMIN_DISPLAY_SETTINGS } from '@/constants/display-settings/admin-defaults';
import { DEFAULT_TEACHER_DISPLAY_SETTINGS } from '@/constants/display-settings/teacher-defaults';
import { SidebarItemsData } from '@/components/common/layout-container/sidebar/utils';

const CACHE_EXPIRY_HOURS = 24;
const LEGACY_ADMIN_KEY = StorageKey.ADMIN_DISPLAY_SETTINGS;
const LEGACY_TEACHER_KEY = StorageKey.TEACHER_DISPLAY_SETTINGS;

type RoleKey = string;

interface CachedDisplaySettings {
    data: DisplaySettingsData;
    timestamp: number;
    instituteId: string;
}

function getLocalStorageKey(role: RoleKey, instituteId?: string | null): string {
    let prefix: string = StorageKey.TEACHER_DISPLAY_SETTINGS;
    if (role === ADMIN_DISPLAY_SETTINGS_KEY) prefix = StorageKey.ADMIN_DISPLAY_SETTINGS;
    else if (role.startsWith(CUSTOM_ROLE_DISPLAY_SETTINGS_KEY)) prefix = role;
    const id = instituteId ?? getInstituteId();
    return id ? `${prefix}-${id}` : prefix;
}

function getDefaults(role: RoleKey): DisplaySettingsData {
    if (role === ADMIN_DISPLAY_SETTINGS_KEY) return DEFAULT_ADMIN_DISPLAY_SETTINGS;
    // Both teacher and custom role can use teacher defaults as baseline
    return DEFAULT_TEACHER_DISPLAY_SETTINGS;
}

function mergeArrayById<T extends { id: string }>(
    partial: Array<Partial<T>> | undefined,
    defaults: Array<T>
): Array<T> {
    const byId = new Map<string, Partial<T>>();
    (partial || []).forEach((item) => {
        if (item && item.id) byId.set(item.id, item);
    });
    const merged: Array<T> = [];
    // Start from defaults to guarantee presence of new fields/tabs
    defaults.forEach((def) => {
        const incoming = byId.get(def.id) || {};
        merged.push({ ...def, ...(incoming as T) });
    });
    // Include custom/unknown items that are not in defaults
    (partial || []).forEach((p) => {
        if (!p.id) return;
        if (!merged.some((m) => m.id === p.id)) {
            // Preserve explicitly-custom items (custom top-level tabs carry
            // isCustom) AND admin-added custom sub-tabs. Sub-tabs have no
            // isCustom flag, but both custom tabs ("custom-…") and custom
            // sub-tabs ("custom-sub-…") use a "custom" id prefix — so without
            // this, every saved sub-tab was stripped on the post-save cache
            // write and on every reload. Anything else absent from defaults is
            // treated as a stale default and dropped.
            if ((p as any).isCustom || (typeof p.id === 'string' && p.id.startsWith('custom'))) {
                merged.push(p as T);
            }
        }
    });
    return merged;
}

function mergeDisplayWithDefaults(
    incoming: Partial<DisplaySettingsData> | null | undefined,
    role: RoleKey
): DisplaySettingsData {
    const defaults = getDefaults(role);
    const merged: DisplaySettingsData = {
        sidebar: [],
        dashboard: { widgets: [] },
        permissions: {
            canViewInstituteDetails: false,
            canEditInstituteDetails: false,
            canViewProfileDetails: false,
            canEditProfileDetails: false,
        },
        postLoginRedirectRoute: '/dashboard',
    };

    // Sidebar merge
    const mergedSidebar = mergeArrayById(
        incoming?.sidebar as Array<Partial<DisplaySettingsData['sidebar'][number]>> | undefined,
        defaults.sidebar
    );
    // Deep-merge subTabs by id
    merged.sidebar = mergedSidebar.map((tab) => {
        const defTab =
            defaults.sidebar.find((d) => d.id === tab.id) ||
            ({
                id: tab.id,
                order: 0,
                visible: true,
                subTabs: [],
            } as DisplaySettingsData['sidebar'][number]);
        const subTabsMerged = mergeArrayById(
            tab.subTabs as
                | Array<
                      Partial<
                          NonNullable<DisplaySettingsData['sidebar'][number]['subTabs']>[number]
                      >
                  >
                | undefined,
            defTab.subTabs || []
        );
        return {
            id: tab.id,
            label: tab.label ?? defTab.label,
            route: tab.route ?? defTab.route,
            order: tab.order ?? defTab.order ?? 0,
            visible: tab.visible ?? defTab.visible ?? true,
            locked: tab.locked ?? defTab.locked ?? false,
            isCustom: tab.isCustom ?? (defTab as Partial<typeof defTab>).isCustom ?? false,
            category: tab.category ?? (defTab as Partial<typeof defTab>).category,
            subTabs: subTabsMerged.map((s) => {
                const defSub =
                    (defTab.subTabs || []).find((d) => d.id === s.id) ||
                    ({ id: s.id!, order: 0, route: '#', visible: true } as NonNullable<
                        DisplaySettingsData['sidebar'][number]['subTabs']
                    >[number]);
                return {
                    id: s.id!,
                    label: s.label ?? defSub.label,
                    route: s.route ?? defSub.route ?? '#',
                    order: s.order ?? defSub.order ?? 0,
                    visible: s.visible ?? defSub.visible ?? true,
                    locked: s.locked ?? defSub.locked ?? false,
                };
            }),
        };
    });

    // Dashboard widgets merge
    //
    // Behavior:
    //  - The user's previously-saved widgets keep their saved visibility +
    //    order as-is.
    //  - Any widget present in the defaults but missing from the user's
    //    saved list is a "newly-introduced widget". It's auto-added using
    //    the default visibility AND assigned an order that places it AFTER
    //    the user's last saved widget — so it appears at the bottom of the
    //    existing user's dashboard rather than colliding with an in-use
    //    order slot. Among themselves, new widgets preserve the priority
    //    order from the defaults list.
    //  - For brand-new institutes (no saved widgets) the defaults' own
    //    order numbers stand, giving them a priority-ordered dashboard.
    const incomingWidgetsRaw = incoming?.dashboard?.widgets as
        | Array<Partial<DisplaySettingsData['dashboard']['widgets'][number]>>
        | undefined;
    const mergedWidgets = mergeArrayById(incomingWidgetsRaw, defaults.dashboard.widgets);

    const incomingIds = new Set<string>(
        (incomingWidgetsRaw || [])
            .map((w) => (w?.id ? String(w.id) : ''))
            .filter(Boolean)
    );
    const maxIncomingOrder = (incomingWidgetsRaw || []).reduce(
        (max, w) => (typeof w?.order === 'number' && w.order > max ? w.order : max),
        0
    );
    // Walk defaults in their declared (priority) order so new widgets keep
    // that relative ordering when appended below the user's saved widgets.
    let nextAppendOrder = maxIncomingOrder;
    const appendOrderById = new Map<string, number>();
    defaults.dashboard.widgets.forEach((def) => {
        if (!incomingIds.has(String(def.id))) {
            nextAppendOrder += 1;
            appendOrderById.set(String(def.id), nextAppendOrder);
        }
    });

    merged.dashboard.widgets = mergedWidgets.map((w) => {
        const def =
            defaults.dashboard.widgets.find((d) => d.id === w.id) ||
            ({
                id: w.id as DisplaySettingsData['dashboard']['widgets'][number]['id'],
                order: 0,
                visible: true,
            } as DisplaySettingsData['dashboard']['widgets'][number]);
        const isNewForExistingUser =
            incomingIds.size > 0 && !incomingIds.has(String(w.id));
        const resolvedOrder = isNewForExistingUser
            ? (appendOrderById.get(String(w.id)) ?? def.order ?? 0)
            : (w.order ?? def.order ?? 0);
        return {
            id: w.id as DisplaySettingsData['dashboard']['widgets'][number]['id'],
            order: resolvedOrder,
            visible: w.visible ?? def.visible ?? true,
        };
    });

    // Permissions
    merged.permissions = {
        canViewInstituteDetails:
            incoming?.permissions?.canViewInstituteDetails ??
            defaults.permissions.canViewInstituteDetails,
        canEditInstituteDetails:
            incoming?.permissions?.canEditInstituteDetails ??
            defaults.permissions.canEditInstituteDetails,
        canViewProfileDetails:
            incoming?.permissions?.canViewProfileDetails ??
            defaults.permissions.canViewProfileDetails,
        canEditProfileDetails:
            incoming?.permissions?.canEditProfileDetails ??
            defaults.permissions.canEditProfileDetails,
    };

    // Course List merge with defaults
    const defaultCourseList: NonNullable<DisplaySettingsData['courseList']> =
        defaults.courseList || {
            tabs: [
                { id: 'AllCourses', order: 1, visible: true },
                { id: 'AuthoredCourses', order: 2, visible: true },
                { id: 'CourseApproval', order: 3, visible: true },
                { id: 'CourseInReview', order: 4, visible: true },
            ],
            defaultTab: 'AllCourses' as const,
        };
    const mergedCourseListTabs = mergeArrayById(
        incoming?.courseList?.tabs as
            | Array<{
                  id: string;
                  label?: string;
                  order?: number;
                  visible?: boolean;
              }>
            | undefined,
        defaultCourseList.tabs as Array<{
            id: string;
            label?: string;
            order: number;
            visible: boolean;
        }>
    );
    merged.courseList = {
        tabs: mergedCourseListTabs.map((t) => ({
            id: t.id as unknown as DisplaySettingsData['courseList'] extends infer C
                ? C extends { tabs: Array<infer U> }
                    ? U extends { id: infer I }
                        ? I
                        : never
                    : never
                : never,
            label: t.label,
            order: t.order ?? 0,
            visible: t.visible ?? true,
        })) as NonNullable<DisplaySettingsData['courseList']>['tabs'],
        defaultTab: (incoming?.courseList?.defaultTab ||
            defaultCourseList.defaultTab) as NonNullable<
            DisplaySettingsData['courseList']
        >['defaultTab'],
    };

    // Course Details merge with defaults
    const defaultDetails: NonNullable<DisplaySettingsData['courseDetails']> =
        defaults.courseDetails || {
            tabs: [
                { id: 'OUTLINE', order: 1, visible: true },
                { id: 'CONTENT_STRUCTURE', order: 2, visible: true },
                { id: 'LEARNER', order: 3, visible: true },
                { id: 'TEACHER', order: 4, visible: true },
                { id: 'ASSESSMENT', order: 5, visible: true },
                { id: 'PLANNING', order: 6, visible: false },
                { id: 'ACTIVITY', order: 7, visible: false },
                { id: 'SETTINGS', order: 8, visible: false },
            ],
            defaultTab: 'OUTLINE' as const,
        };
    const mergedDetailsTabs = mergeArrayById(
        incoming?.courseDetails?.tabs as
            | Array<{
                  id: string;
                  label?: string;
                  order?: number;
                  visible?: boolean;
              }>
            | undefined,
        defaultDetails.tabs as Array<{
            id: string;
            label?: string;
            order: number;
            visible: boolean;
        }>
    );
    merged.courseDetails = {
        tabs: mergedDetailsTabs.map((t) => ({
            id: t.id as unknown as DisplaySettingsData['courseDetails'] extends infer C
                ? C extends { tabs: Array<infer U> }
                    ? U extends { id: infer I }
                        ? I
                        : never
                    : never
                : never,
            label: t.label,
            order: t.order ?? 0,
            visible: t.visible ?? true,
        })) as NonNullable<DisplaySettingsData['courseDetails']>['tabs'],
        defaultTab: (incoming?.courseDetails?.defaultTab ||
            defaultDetails.defaultTab) as NonNullable<
            DisplaySettingsData['courseDetails']
        >['defaultTab'],
    };

    // UI
    merged.ui = {
        showSupportButton:
            incoming?.ui?.showSupportButton ?? defaults.ui?.showSupportButton ?? true,
        showSidebar: incoming?.ui?.showSidebar ?? defaults.ui?.showSidebar ?? true,
        showAiCredits: incoming?.ui?.showAiCredits ?? defaults.ui?.showAiCredits ?? true,
    };

    // Content Types
    const defCT = defaults.contentTypes || {
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
    };
    merged.contentTypes = {
        pdf: incoming?.contentTypes?.pdf ?? defCT.pdf,
        video: {
            enabled: incoming?.contentTypes?.video?.enabled ?? defCT.video.enabled,
            showInVideoQuestion:
                incoming?.contentTypes?.video?.showInVideoQuestion ??
                defCT.video.showInVideoQuestion,
        },
        codeEditor: incoming?.contentTypes?.codeEditor ?? defCT.codeEditor,
        document: incoming?.contentTypes?.document ?? defCT.document,
        question: incoming?.contentTypes?.question ?? defCT.question,
        quiz: incoming?.contentTypes?.quiz ?? defCT.quiz,
        assignment: incoming?.contentTypes?.assignment ?? defCT.assignment,
        jupyterNotebook: incoming?.contentTypes?.jupyterNotebook ?? defCT.jupyterNotebook,
        scratch: incoming?.contentTypes?.scratch ?? defCT.scratch,
        ppt: incoming?.contentTypes?.ppt ?? defCT.ppt ?? true,
        audio: incoming?.contentTypes?.audio ?? defCT.audio ?? true,
        scorm: incoming?.contentTypes?.scorm ?? defCT.scorm ?? true,
        assessment: incoming?.contentTypes?.assessment ?? defCT.assessment ?? true,
    };

    // Course Page Settings
    const defCoursePage = defaults.coursePage || {
        viewInviteLinks: true,
        viewShortInviteLinks: false,
        viewCourseConfiguration: true,
        viewCourseOverviewItem: true,
        viewContentNumbering: true,
        allowViewSlidesInReadOnly: true,
        directEditPublishedCourse: false,
        canEditCourseStructure: false,
        canDeleteCourseStructure: false,
        showAdvancedCourseIds: false,
        showBulkUpload: false,
        showAddSubject: true,
        showAddModule: true,
        showAddChapter: true,
        showAddSlide: true,
    };
    merged.coursePage = {
        viewInviteLinks: incoming?.coursePage?.viewInviteLinks ?? defCoursePage.viewInviteLinks,
        viewShortInviteLinks:
            incoming?.coursePage?.viewShortInviteLinks ?? defCoursePage.viewShortInviteLinks,
        viewCourseConfiguration:
            incoming?.coursePage?.viewCourseConfiguration ?? defCoursePage.viewCourseConfiguration,
        viewCourseOverviewItem:
            incoming?.coursePage?.viewCourseOverviewItem ?? defCoursePage.viewCourseOverviewItem,
        viewContentNumbering:
            incoming?.coursePage?.viewContentNumbering ?? defCoursePage.viewContentNumbering,
        allowViewSlidesInReadOnly:
            incoming?.coursePage?.allowViewSlidesInReadOnly ??
            defCoursePage.allowViewSlidesInReadOnly ??
            true,
        directEditPublishedCourse:
            incoming?.coursePage?.directEditPublishedCourse ??
            defCoursePage.directEditPublishedCourse ??
            false,
        canEditCourseStructure:
            incoming?.coursePage?.canEditCourseStructure ??
            defCoursePage.canEditCourseStructure ??
            false,
        canDeleteCourseStructure:
            incoming?.coursePage?.canDeleteCourseStructure ??
            defCoursePage.canDeleteCourseStructure ??
            false,
        showAdvancedCourseIds:
            incoming?.coursePage?.showAdvancedCourseIds ??
            defCoursePage.showAdvancedCourseIds ??
            false,
        showBulkUpload:
            incoming?.coursePage?.showBulkUpload ?? defCoursePage.showBulkUpload ?? false,
        showAddSubject:
            incoming?.coursePage?.showAddSubject ?? defCoursePage.showAddSubject ?? true,
        showAddModule:
            incoming?.coursePage?.showAddModule ?? defCoursePage.showAddModule ?? true,
        showAddChapter:
            incoming?.coursePage?.showAddChapter ?? defCoursePage.showAddChapter ?? true,
        showAddSlide:
            incoming?.coursePage?.showAddSlide ?? defCoursePage.showAddSlide ?? true,
    };

    // Redirect
    merged.postLoginRedirectRoute =
        incoming?.postLoginRedirectRoute ?? defaults.postLoginRedirectRoute;

    // Slide View Settings
    const defSlideView = defaults.slideView || {
        showCopyTo: true,
        showMoveTo: true,
        showDelete: true,
        showAddVideoQuestion: true,
        showConvertToSplitScreen: true,
    };
    merged.slideView = {
        showCopyTo: incoming?.slideView?.showCopyTo ?? defSlideView.showCopyTo,
        showMoveTo: incoming?.slideView?.showMoveTo ?? defSlideView.showMoveTo,
        showDelete: incoming?.slideView?.showDelete ?? defSlideView.showDelete ?? true,
        showAddVideoQuestion:
            incoming?.slideView?.showAddVideoQuestion ??
            defSlideView.showAddVideoQuestion ??
            true,
        showConvertToSplitScreen:
            incoming?.slideView?.showConvertToSplitScreen ??
            defSlideView.showConvertToSplitScreen ??
            true,
    };

    // Authored Courses Card Settings
    const defAuthoredCard = defaults.authoredCoursesCard || {
        showCopyToEdit: true,
        showDelete: true,
    };
    merged.authoredCoursesCard = {
        showCopyToEdit:
            incoming?.authoredCoursesCard?.showCopyToEdit ?? defAuthoredCard.showCopyToEdit,
        showDelete: incoming?.authoredCoursesCard?.showDelete ?? defAuthoredCard.showDelete,
    };

    // Course List Card Settings (toggles for content shown on each course card).
    // Defaults OFF — only shown when admin explicitly enables it.
    const defCourseListCard = defaults.courseListCard || {
        showEnrolledStudentCount: false,
    };
    merged.courseListCard = {
        showEnrolledStudentCount:
            incoming?.courseListCard?.showEnrolledStudentCount ??
            defCourseListCard.showEnrolledStudentCount,
    };

    const defCourseCreation = defaults.courseCreation || {
        showCreateCourse: false,
        showCreateCourseWithAI: false,
        requirePackageSelectionForNewChapter: true,
        showAdvancedSettings: true,
        limitToSingleLevel: false,
    };
    merged.courseCreation = {
        // Carry the per-role "Allow creating courses" override through the merge.
        // Without this, the saved flag was dropped on every fetch, so the
        // Display Settings toggle never reached the Explore Courses page.
        showCreateCourse:
            incoming?.courseCreation?.showCreateCourse ?? defCourseCreation.showCreateCourse,
        showCreateCourseWithAI:
            incoming?.courseCreation?.showCreateCourseWithAI ??
            defCourseCreation.showCreateCourseWithAI,
        requirePackageSelectionForNewChapter:
            incoming?.courseCreation?.requirePackageSelectionForNewChapter ??
            defCourseCreation.requirePackageSelectionForNewChapter,
        showAdvancedSettings:
            incoming?.courseCreation?.showAdvancedSettings ??
            defCourseCreation.showAdvancedSettings,
        limitToSingleLevel:
            incoming?.courseCreation?.limitToSingleLevel ?? defCourseCreation.limitToSingleLevel,
    };

    const defStudentSideView = defaults.studentSideView || {
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
        parentTab: false,
        onboardingTab: false,
    };
    merged.studentSideView = {
        overviewTab: incoming?.studentSideView?.overviewTab ?? defStudentSideView.overviewTab,
        testTab: incoming?.studentSideView?.testTab ?? defStudentSideView.testTab,
        progressTab: incoming?.studentSideView?.progressTab ?? defStudentSideView.progressTab,
        coursesTab: incoming?.studentSideView?.coursesTab ?? defStudentSideView.coursesTab,
        notificationTab:
            incoming?.studentSideView?.notificationTab ?? defStudentSideView.notificationTab,
        membershipTab: incoming?.studentSideView?.membershipTab ?? defStudentSideView.membershipTab,
        paymentHistoryTab:
            incoming?.studentSideView?.paymentHistoryTab ?? defStudentSideView.paymentHistoryTab,
        userTaggingTab:
            incoming?.studentSideView?.userTaggingTab ?? defStudentSideView.userTaggingTab,
        badgesTab: incoming?.studentSideView?.badgesTab ?? defStudentSideView.badgesTab,
        fileTab: incoming?.studentSideView?.fileTab ?? defStudentSideView.fileTab,
        portalAccessTab:
            incoming?.studentSideView?.portalAccessTab ?? defStudentSideView.portalAccessTab,
        reportsTab: incoming?.studentSideView?.reportsTab ?? defStudentSideView.reportsTab,
        enrollDerollTab:
            incoming?.studentSideView?.enrollDerollTab ?? defStudentSideView.enrollDerollTab,
        enquiryTab: incoming?.studentSideView?.enquiryTab ?? defStudentSideView.enquiryTab,
        applicationTab: incoming?.studentSideView?.applicationTab ?? defStudentSideView.applicationTab,
        leadTab: incoming?.studentSideView?.leadTab ?? defStudentSideView.leadTab,
        fullHistoryTab:
            incoming?.studentSideView?.fullHistoryTab ?? defStudentSideView.fullHistoryTab ?? false,
        parentTab: incoming?.studentSideView?.parentTab ?? defStudentSideView.parentTab ?? false,
        onboardingTab:
            incoming?.studentSideView?.onboardingTab ?? defStudentSideView.onboardingTab ?? false,
        // Preserve user-supplied ordering and default-tab choice; fall back to
        // the role's defaults so older saved settings (which lacked these
        // fields) still render in a sensible order.
        tabOrders: incoming?.studentSideView?.tabOrders ?? defStudentSideView.tabOrders,
        defaultTab: incoming?.studentSideView?.defaultTab ?? defStudentSideView.defaultTab,
    };

    const defLearnerManagement = defaults.learnerManagement || {
        allowPortalAccess: true,
        allowViewPassword: true,
        allowSendResetPasswordMail: true,
        showApprovalToggle: false,
    };
    // Learner Management ...
    merged.learnerManagement = {
        allowPortalAccess:
            incoming?.learnerManagement?.allowPortalAccess ??
            defLearnerManagement.allowPortalAccess,
        allowViewPassword:
            incoming?.learnerManagement?.allowViewPassword ??
            defLearnerManagement.allowViewPassword,
        allowSendResetPasswordMail:
            incoming?.learnerManagement?.allowSendResetPasswordMail ??
            defLearnerManagement.allowSendResetPasswordMail,
        showApprovalToggle:
            incoming?.learnerManagement?.showApprovalToggle ??
            defLearnerManagement.showApprovalToggle,
    };

    // Learner-list column visibility (per-role overlay). Passes through whatever
    // the role has saved. Empty/missing = institute defaults apply at render time:
    // system columns visible, custom fields hidden until admin opts in.
    if (incoming?.learnerListColumns || defaults.learnerListColumns) {
        merged.learnerListColumns = {
            hiddenColumns:
                incoming?.learnerListColumns?.hiddenColumns ??
                defaults.learnerListColumns?.hiddenColumns ??
                [],
            enabledCustomFields:
                incoming?.learnerListColumns?.enabledCustomFields ??
                defaults.learnerListColumns?.enabledCustomFields,
            // Count badges show by default; only false when a role explicitly turns them off.
            showCountBadges:
                incoming?.learnerListColumns?.showCountBadges ??
                defaults.learnerListColumns?.showCountBadges ??
                true,
        };
    }

    // Leads-filter custom fields (institute-wide: which custom fields show as
    // filters on the leads views). Pass the saved list through so it survives
    // this field-by-field merge — otherwise it's silently dropped on every read
    // (and on the post-save cache write), so the toggles reset on refresh.
    merged.leadsFilterCustomFields =
        incoming?.leadsFilterCustomFields ?? defaults.leadsFilterCustomFields ?? [];

    // Live class scheduling (role-level overlay on top of institute-level
    // Live Session Settings). Both flags default ON so existing roles aren't
    // suddenly locked out of either flow.
    merged.liveClassScheduling = {
        bulkScheduleEnabled:
            incoming?.liveClassScheduling?.bulkScheduleEnabled ??
            defaults.liveClassScheduling?.bulkScheduleEnabled ??
            true,
        singleScheduleEnabled:
            incoming?.liveClassScheduling?.singleScheduleEnabled ??
            defaults.liveClassScheduling?.singleScheduleEnabled ??
            true,
    };

    // Team-tab role visibility + Org Chart tab visibility. Preserve any
    // explicitly-set keys; consumers treat missing visibleRoles keys as
    // visible (true). orgChartTabVisible defaults to undefined → treated as
    // false at read sites (the tab is opt-in per institute). incoming wins
    // over defaults when present, so a saved value survives this merge.
    merged.teamManagement = {
        visibleRoles: {
            ...(defaults.teamManagement?.visibleRoles || {}),
            ...(incoming?.teamManagement?.visibleRoles || {}),
        },
        orgChartTabVisible:
            incoming?.teamManagement?.orgChartTabVisible
            ?? defaults.teamManagement?.orgChartTabVisible,
    };

    // Workbench gates (counsellors page, sales dashboard). Same pattern as
    // orgChartTabVisible — both default to undefined (read as false) so the
    // features stay hidden until an admin opts in. We materialize the
    // object even when both flags are absent so consumers can safely chain
    // settings.workbench?.counsellorsPageVisible without an extra guard.
    merged.workbench = {
        counsellorsPageVisible:
            incoming?.workbench?.counsellorsPageVisible
            ?? defaults.workbench?.counsellorsPageVisible,
        salesDashboardVisible:
            incoming?.workbench?.salesDashboardVisible
            ?? defaults.workbench?.salesDashboardVisible,
    };

    // Sidebar Categories
    const defSidebarCategories: NonNullable<DisplaySettingsData['sidebarCategories']> = [
        { id: 'CRM', visible: true, default: true, order: 0 },
        { id: 'LMS', visible: true, default: false, order: 1 },
        { id: 'AI', visible: true, default: false, order: 2 },
    ];

    const mergedSidebarCategories = mergeArrayById(
        incoming?.sidebarCategories,
        defSidebarCategories
    );

    merged.sidebarCategories = mergedSidebarCategories.map((c) => ({
        id: c.id as 'CRM' | 'LMS' | 'AI',
        visible: c.visible ?? true,
        locked: c.locked ?? false,
        default: c.default ?? c.id === 'CRM',
        order: c.order ?? 0,
    }));

    // Final sort by order
    merged.sidebar.sort((a, b) => (a.order || 0) - (b.order || 0));
    merged.sidebar.forEach((t) => t.subTabs?.sort((a, b) => (a.order || 0) - (b.order || 0)));
    merged.dashboard.widgets.sort((a, b) => (a.order || 0) - (b.order || 0));
    merged.sidebarCategories?.sort((a, b) => (a.order || 0) - (b.order || 0));

    return merged;
}

function readCache(role: RoleKey): DisplaySettingsData | null {
    try {
        const instituteId = getInstituteId();
        if (!instituteId) return null;

        // Migrate legacy cache (without institute suffix) to per-institute key
        const legacyKey =
            role === ADMIN_DISPLAY_SETTINGS_KEY ? LEGACY_ADMIN_KEY : LEGACY_TEACHER_KEY;
        const legacyRaw = localStorage.getItem(legacyKey);
        if (legacyRaw) {
            try {
                const legacyParsed: CachedDisplaySettings = JSON.parse(legacyRaw);
                if (legacyParsed?.instituteId === instituteId && legacyParsed?.data) {
                    const newKey = getLocalStorageKey(role, instituteId);
                    localStorage.setItem(newKey, JSON.stringify(legacyParsed));
                }
            } catch {
                // ignore
            } finally {
                localStorage.removeItem(legacyKey);
            }
        }

        const key = getLocalStorageKey(role, instituteId);
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed: CachedDisplaySettings = JSON.parse(raw);
        const age = Date.now() - parsed.timestamp;
        const expiry = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
        if (age > expiry) {
            localStorage.removeItem(key);
            return null;
        }
        return mergeDisplayWithDefaults(parsed.data, role);
    } catch (e) {
        console.error('Error reading display settings cache', e);
        try {
            const instituteId = getInstituteId();
            const key = getLocalStorageKey(role, instituteId);
            localStorage.removeItem(key);
        } catch {
            // ignore
        }
        return null;
    }
}

function writeCache(role: RoleKey, data: DisplaySettingsData): void {
    try {
        const instituteId = getInstituteId();
        if (!instituteId) return;
        const key = getLocalStorageKey(role, instituteId);
        const payload: CachedDisplaySettings = {
            data,
            timestamp: Date.now(),
            instituteId,
        };
        localStorage.setItem(key, JSON.stringify(payload));
    } catch (e) {
        console.error('Error writing display settings cache', e);
    }
}

export function clearDisplaySettingsCache(role?: RoleKey): void {
    try {
        const instituteId = getInstituteId();
        if (role) {
            localStorage.removeItem(getLocalStorageKey(role, instituteId));
            // Clean legacy key too
            localStorage.removeItem(
                role === ADMIN_DISPLAY_SETTINGS_KEY ? LEGACY_ADMIN_KEY : LEGACY_TEACHER_KEY
            );
            if (role.startsWith(CUSTOM_ROLE_DISPLAY_SETTINGS_KEY)) {
                localStorage.removeItem(role);
            }
            return;
        }
        if (instituteId) {
            localStorage.removeItem(getLocalStorageKey(ADMIN_DISPLAY_SETTINGS_KEY, instituteId));
            localStorage.removeItem(getLocalStorageKey(TEACHER_DISPLAY_SETTINGS_KEY, instituteId));
            localStorage.removeItem(
                getLocalStorageKey(CUSTOM_ROLE_DISPLAY_SETTINGS_KEY, instituteId)
            );
        }
        // Clean legacy keys as well
        localStorage.removeItem(LEGACY_ADMIN_KEY);
        localStorage.removeItem(LEGACY_TEACHER_KEY);
    } catch {
        // ignore
    }
}

export async function getDisplaySettings(
    role: RoleKey,
    forceRefresh = false
): Promise<DisplaySettingsData> {
    if (!forceRefresh) {
        const cached = readCache(role);
        if (cached) return cached;
    }

    const instituteId = getInstituteId();
    if (!instituteId) return getDefaults(role);

    try {
        const isCustomRole = role.startsWith(CUSTOM_ROLE_DISPLAY_SETTINGS_KEY + '_');
        const apiSettingKey = isCustomRole ? 'ROLE_DISPLAY_SETTINGS' : role;

        const res = await authenticatedAxiosInstance.get<{ data: any | null }>(
            `${BASE_URL}/admin-core-service/institute/setting/v1/get`,
            {
                params: {
                    instituteId,
                    settingKey: apiSettingKey,
                },
            }
        );

        let serverData: any = null;
        if (res.data) {
            const resDataDynamic = res.data as any;
            if (resDataDynamic[apiSettingKey] && resDataDynamic[apiSettingKey].data) {
                serverData = resDataDynamic[apiSettingKey].data;
            } else if (
                resDataDynamic.data &&
                resDataDynamic.data[apiSettingKey] &&
                resDataDynamic.data[apiSettingKey].data
            ) {
                serverData = resDataDynamic.data[apiSettingKey].data;
            } else if (resDataDynamic.data) {
                serverData = resDataDynamic.data;
            }
        }

        if (isCustomRole && serverData) {
            const roleId = role.split('_').pop() || '';
            serverData = serverData[roleId] || null;
        }

        const merged = mergeDisplayWithDefaults(
            serverData && Object.keys(serverData).length > 0 ? serverData : getDefaults(role),
            role
        );
        writeCache(role, merged);
        return merged;
    } catch (error: unknown) {
        const isCustomRole = role.startsWith(CUSTOM_ROLE_DISPLAY_SETTINGS_KEY + '_');

        // if 510 or not found, use defaults and cache them
        const anyErr = error as { response?: { status?: number; data?: { ex?: string } } };
        if (
            anyErr.response?.status === 510 ||
            anyErr.response?.data?.ex?.includes('Setting not found') ||
            (isCustomRole && anyErr.response?.status === 404) // Handle 404 for missing role setting
        ) {
            const defaults = mergeDisplayWithDefaults(getDefaults(role), role);
            writeCache(role, defaults);
            return defaults;
        }

        // For other errors (like 403), throw the error so retry logic can handle it
        throw error;
    }
}

/**
 * Fetch display settings with fallback to defaults (no retry logic)
 * Use this when you want the old behavior of always returning something
 */
export async function getDisplaySettingsWithFallback(
    role: RoleKey,
    forceRefresh = false
): Promise<DisplaySettingsData> {
    try {
        return await getDisplaySettings(role, forceRefresh);
    } catch (error) {
        console.warn('Failed to fetch display settings; using defaults');
        return mergeDisplayWithDefaults(getDefaults(role), role);
    }
}

export async function saveDisplaySettings(
    role: RoleKey,
    settings: DisplaySettingsData
): Promise<void> {
    const instituteId = getInstituteId();
    if (!instituteId) return;

    const isCustomRole = role.startsWith(CUSTOM_ROLE_DISPLAY_SETTINGS_KEY + '_');
    const apiSettingKey = isCustomRole ? 'ROLE_DISPLAY_SETTINGS' : role;

    let finalSettingData: any = settings;

    if (isCustomRole) {
        const roleId = role.split('_').pop() || '';
        let existingData: Record<string, any> = {};

        try {
            const res = await authenticatedAxiosInstance.get<{ data: any | null }>(
                `${BASE_URL}/admin-core-service/institute/setting/v1/get`,
                { params: { instituteId, settingKey: apiSettingKey } }
            );
            let tempExisting = null;
            if (res.data) {
                const resDataDynamic = res.data as any;
                if (resDataDynamic[apiSettingKey] && resDataDynamic[apiSettingKey].data) {
                    tempExisting = resDataDynamic[apiSettingKey].data;
                } else if (
                    resDataDynamic.data &&
                    resDataDynamic.data[apiSettingKey] &&
                    resDataDynamic.data[apiSettingKey].data
                ) {
                    tempExisting = resDataDynamic.data[apiSettingKey].data;
                } else if (resDataDynamic.data) {
                    tempExisting = resDataDynamic.data;
                }
            }

            if (tempExisting) {
                existingData = tempExisting;
            }
        } catch (e) {
            // Ignore if not found
        }

        finalSettingData = {
            ...existingData,
            [roleId]: settings,
        };
    }

    const requestData = {
        setting_name:
            role === ADMIN_DISPLAY_SETTINGS_KEY
                ? 'Admin Display Settings'
                : isCustomRole
                  ? 'Role Display Settings'
                  : 'Teacher Display Settings',
        setting_data: finalSettingData,
    };

    await authenticatedAxiosInstance.post(
        `${BASE_URL}/admin-core-service/institute/setting/v1/save-setting`,
        requestData,
        {
            params: { instituteId, settingKey: apiSettingKey },
            headers: { 'Content-Type': 'application/json' },
        }
    );
    const merged = mergeDisplayWithDefaults(settings, role);
    writeCache(role, merged);
}

// Synchronous accessor for router usage
export function getDisplaySettingsFromCache(role: RoleKey): DisplaySettingsData | null {
    return readCache(role);
}

type CategoryId = 'CRM' | 'LMS' | 'AI';

/**
 * Resolve the effective post-login redirect URL for a role.
 *
 * If the candidate URL points into a sidebar category that is hidden for the
 * role (e.g. CRM is disabled but `/dashboard` is the default redirect), this
 * returns the first visible tab in the role's default visible category instead.
 * Otherwise the candidate is returned unchanged.
 */
export function resolveEffectivePostLoginRoute(
    candidate: string,
    ds: DisplaySettingsData | null | undefined
): string {
    if (!candidate || !ds) return candidate || '/dashboard';
    const cats = ds.sidebarCategories;
    if (!cats || cats.length === 0) return candidate;

    const tabCategory = (tabId: string, fallback?: CategoryId): CategoryId => {
        const base = SidebarItemsData.find((i) => i.id === tabId);
        return (base?.category as CategoryId) || fallback || 'CRM';
    };

    // Determine the category that the candidate URL belongs to.
    let candidateCategory: CategoryId | null = null;
    for (const t of ds.sidebar) {
        const base = SidebarItemsData.find((i) => i.id === t.id);
        const tabRoute = t.route || base?.to;
        if (tabRoute && candidate.startsWith(tabRoute)) {
            candidateCategory = tabCategory(t.id, t.category as CategoryId | undefined);
            break;
        }
        const subRoutes: string[] = [
            ...(t.subTabs || []).map((s) => s.route),
            ...(base?.subItems || []).map((s) => s.subItemLink || ''),
        ].filter(Boolean) as string[];
        if (subRoutes.some((r) => candidate.startsWith(r))) {
            candidateCategory = tabCategory(t.id, t.category as CategoryId | undefined);
            break;
        }
    }

    if (!candidateCategory) return candidate;

    const candidateCatCfg = cats.find((c) => c.id === candidateCategory);
    const candidateVisible = candidateCatCfg ? candidateCatCfg.visible !== false : true;
    if (candidateVisible) return candidate;

    // Candidate lands in a hidden category — pick the default visible one.
    const sortedCats = cats.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const defaultCat =
        sortedCats.find((c) => c.default && c.visible !== false) ||
        sortedCats.find((c) => c.visible !== false);
    if (!defaultCat) return candidate;

    const tabsInCat = ds.sidebar
        .filter((t) => {
            if (t.visible === false) return false;
            const cat = tabCategory(t.id, t.category as CategoryId | undefined);
            return cat === defaultCat.id;
        })
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    for (const t of tabsInCat) {
        const base = SidebarItemsData.find((i) => i.id === t.id);
        const tabRoute = t.route || base?.to;
        if (tabRoute) return tabRoute;
        const firstVisibleSub = (t.subTabs || []).find((s) => s.visible !== false);
        if (firstVisibleSub?.route) return firstVisibleSub.route;
        const firstBaseSub = base?.subItems?.[0]?.subItemLink;
        if (firstBaseSub) return firstBaseSub;
    }

    return candidate;
}
