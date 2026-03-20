import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';
import {
    STUDENT_DISPLAY_SETTINGS_KEY,
    type StudentDisplaySettingsData,
    type StudentSidebarTabConfig,
    type StudentDashboardWidgetConfig,
} from '@/types/student-display-settings';
import { DEFAULT_STUDENT_DISPLAY_SETTINGS } from '@/constants/display-settings/student-defaults';

const LS_KEY = `${STUDENT_DISPLAY_SETTINGS_KEY}_CACHE_V1`;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function readCache(): StudentDisplaySettingsData | null {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { ts: number; data: StudentDisplaySettingsData };
        if (!parsed?.ts || Date.now() - parsed.ts > ONE_DAY_MS) return null;
        return mergeWithDefaults(parsed.data);
    } catch {
        return null;
    }
}

function writeCache(data: StudentDisplaySettingsData): void {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch {
        // ignore
    }
}

function mergeArrayById<T extends { id: string }>(
    incoming: Array<Partial<T>> | undefined,
    defaults: Array<T>
): Array<T> {
    const byId = new Map<string, T>();
    defaults.forEach((d) => byId.set(d.id, { ...d }));
    (incoming || []).forEach((i) => {
        if (!i?.id) return;
        const def = byId.get(i.id);
        if (def) byId.set(i.id, { ...def, ...i } as T);
        else byId.set(i.id, i as T);
    });
    return Array.from(byId.values());
}

function mergeWithDefaults(
    incoming?: Partial<StudentDisplaySettingsData> | null
): StudentDisplaySettingsData {
    const d = DEFAULT_STUDENT_DISPLAY_SETTINGS;
    const out: StudentDisplaySettingsData = {
        sidebar: {
            visible: incoming?.sidebar?.visible ?? d.sidebar.visible,
            tabs: mergeArrayById<StudentSidebarTabConfig>(
                incoming?.sidebar?.tabs,
                d.sidebar.tabs
            ).map((t) => ({
                id: t.id,
                label: t.label ?? d.sidebar.tabs.find((x) => x.id === t.id)?.label,
                route: t.route ?? d.sidebar.tabs.find((x) => x.id === t.id)?.route,
                order: t.order ?? d.sidebar.tabs.find((x) => x.id === t.id)?.order ?? 0,
                visible: t.visible ?? d.sidebar.tabs.find((x) => x.id === t.id)?.visible ?? true,
                isCustom: t.isCustom ?? false,
                subTabs: mergeArrayById(
                    incoming?.sidebar?.tabs?.find((x) => x?.id === t.id)?.subTabs,
                    d.sidebar.tabs.find((x) => x.id === t.id)?.subTabs || []
                ).map((s) => ({
                    id: s.id,
                    label:
                        s.label ??
                        d.sidebar.tabs
                            .find((x) => x.id === t.id)
                            ?.subTabs?.find((y) => y.id === s.id)?.label,
                    route:
                        s.route ??
                        d.sidebar.tabs
                            .find((x) => x.id === t.id)
                            ?.subTabs?.find((y) => y.id === s.id)?.route ??
                        '/',
                    order:
                        s.order ??
                        d.sidebar.tabs
                            .find((x) => x.id === t.id)
                            ?.subTabs?.find((y) => y.id === s.id)?.order ??
                        0,
                    visible:
                        s.visible ??
                        d.sidebar.tabs
                            .find((x) => x.id === t.id)
                            ?.subTabs?.find((y) => y.id === s.id)?.visible ??
                        true,
                })),
            })),
        },
        dashboard: {
            widgets: mergeArrayById<StudentDashboardWidgetConfig>(
                incoming?.dashboard?.widgets,
                d.dashboard.widgets
            ).map((w) => ({
                id: w.id,
                order: w.order ?? d.dashboard.widgets.find((x) => x.id === w.id)?.order ?? 0,
                visible:
                    w.visible ?? d.dashboard.widgets.find((x) => x.id === w.id)?.visible ?? true,
                isCustom: w.isCustom ?? false,
                title: w.title ?? d.dashboard.widgets.find((x) => x.id === w.id)?.title,
                subTitle: w.subTitle ?? d.dashboard.widgets.find((x) => x.id === w.id)?.subTitle,
                link: w.link ?? d.dashboard.widgets.find((x) => x.id === w.id)?.link,
            })),
        },
        ui: {
            type: incoming?.ui?.type ?? d.ui.type,
        },
        signup: {
            providers: {
                google: incoming?.signup?.providers?.google ?? d.signup.providers.google,
                github: incoming?.signup?.providers?.github ?? d.signup.providers.github,
                usernamePassword:
                    incoming?.signup?.providers?.usernamePassword ??
                    d.signup.providers.usernamePassword,
                emailOtp: incoming?.signup?.providers?.emailOtp ?? d.signup.providers.emailOtp,
                defaultProvider:
                    incoming?.signup?.providers?.defaultProvider ??
                    d.signup.providers.defaultProvider,
            },
            usernameStrategy: incoming?.signup?.usernameStrategy ?? d.signup.usernameStrategy,
            passwordStrategy: incoming?.signup?.passwordStrategy ?? d.signup.passwordStrategy,
            passwordDelivery: incoming?.signup?.passwordDelivery ?? d.signup.passwordDelivery,
        },
        permissions: {
            canViewProfile: incoming?.permissions?.canViewProfile ?? d.permissions.canViewProfile,
            canEditProfile: incoming?.permissions?.canEditProfile ?? d.permissions.canEditProfile,
            canDeleteProfile:
                incoming?.permissions?.canDeleteProfile ?? d.permissions.canDeleteProfile,
            canViewFiles: incoming?.permissions?.canViewFiles ?? d.permissions.canViewFiles,
            canViewReports: incoming?.permissions?.canViewReports ?? d.permissions.canViewReports,
        },
        courseDetails: {
            tabs: mergeArrayById(incoming?.courseDetails?.tabs, d.courseDetails.tabs).map((t) => ({
                id: t.id,
                label: t.label ?? d.courseDetails.tabs.find((x) => x.id === t.id)?.label,
                order: t.order ?? d.courseDetails.tabs.find((x) => x.id === t.id)?.order ?? 0,
                visible:
                    t.visible ?? d.courseDetails.tabs.find((x) => x.id === t.id)?.visible ?? true,
            })),
            defaultTab: incoming?.courseDetails?.defaultTab ?? d.courseDetails.defaultTab,
            outlineMode: incoming?.courseDetails?.outlineMode ?? d.courseDetails.outlineMode,
            ratingsAndReviewsVisible:
                incoming?.courseDetails?.ratingsAndReviewsVisible ??
                d.courseDetails.ratingsAndReviewsVisible,
            showCourseConfiguration:
                incoming?.courseDetails?.showCourseConfiguration ??
                d.courseDetails.showCourseConfiguration,
            showCourseContentPrefixes:
                incoming?.courseDetails?.showCourseContentPrefixes ??
                d.courseDetails.showCourseContentPrefixes,
            courseOverview: {
                visible:
                    incoming?.courseDetails?.courseOverview?.visible ??
                    d.courseDetails.courseOverview.visible,
                showSlidesData:
                    incoming?.courseDetails?.courseOverview?.showSlidesData ??
                    d.courseDetails.courseOverview.showSlidesData,
            },
            slidesView: {
                showLearningPath:
                    incoming?.courseDetails?.slidesView?.showLearningPath ??
                    d.courseDetails.slidesView.showLearningPath,
                feedbackVisible:
                    incoming?.courseDetails?.slidesView?.feedbackVisible ??
                    d.courseDetails.slidesView.feedbackVisible,
                canAskDoubt:
                    incoming?.courseDetails?.slidesView?.canAskDoubt ??
                    d.courseDetails.slidesView.canAskDoubt,
            },
        },
        courseSettings: {
            quiz: {
                moveOnlyOnCorrectAnswer:
                    incoming?.courseSettings?.quiz?.moveOnlyOnCorrectAnswer ??
                    d.courseSettings.quiz.moveOnlyOnCorrectAnswer,
                celebrateOnQuizComplete:
                    incoming?.courseSettings?.quiz?.celebrateOnQuizComplete ??
                    d.courseSettings.quiz.celebrateOnQuizComplete,
                showReportAndCorrectAnswers:
                    incoming?.courseSettings?.quiz?.showReportAndCorrectAnswers ??
                    d.courseSettings.quiz.showReportAndCorrectAnswers,
            },
        },
        allCourses: {
            tabs: mergeArrayById(incoming?.allCourses?.tabs, d.allCourses.tabs).map((t) => ({
                id: t.id,
                label: t.label ?? d.allCourses.tabs.find((x) => x.id === t.id)?.label,
                order: t.order ?? d.allCourses.tabs.find((x) => x.id === t.id)?.order ?? 0,
                visible: t.visible ?? d.allCourses.tabs.find((x) => x.id === t.id)?.visible ?? true,
            })),
            defaultTab: incoming?.allCourses?.defaultTab ?? d.allCourses.defaultTab,
        },
        notifications: {
            allowSystemAlerts:
                incoming?.notifications?.allowSystemAlerts ?? d.notifications.allowSystemAlerts,
            allowDashboardPins:
                incoming?.notifications?.allowDashboardPins ?? d.notifications.allowDashboardPins,
            allowBatchStream:
                incoming?.notifications?.allowBatchStream ?? d.notifications.allowBatchStream,
        },
        certificates: {
            enabled: incoming?.certificates?.enabled ?? d.certificates.enabled,
            generationThresholdPercent:
                incoming?.certificates?.generationThresholdPercent ??
                d.certificates.generationThresholdPercent,
        },
        postLoginRedirectRoute: incoming?.postLoginRedirectRoute ?? d.postLoginRedirectRoute,
    };

    // Sort
    out.sidebar.tabs.sort((a, b) => (a.order || 0) - (b.order || 0));
    out.sidebar.tabs.forEach((t) => t.subTabs?.sort((a, b) => (a.order || 0) - (b.order || 0)));
    out.dashboard.widgets.sort((a, b) => (a.order || 0) - (b.order || 0));
    out.courseDetails.tabs.sort((a, b) => (a.order || 0) - (b.order || 0));
    out.allCourses.tabs.sort((a, b) => (a.order || 0) - (b.order || 0));

    return out;
}

export const getStudentDisplaySettingsFromCache = (): StudentDisplaySettingsData | null => {
    return readCache();
};

export async function getStudentDisplaySettings(
    forceRefresh = false
): Promise<StudentDisplaySettingsData> {
    const instituteId = getInstituteId();
    if (!instituteId) return DEFAULT_STUDENT_DISPLAY_SETTINGS;
    if (!forceRefresh) {
        const cached = readCache();
        if (cached) return cached;
    }
    try {
        const res = await authenticatedAxiosInstance.get<{
            data: StudentDisplaySettingsData | null;
        }>(`${BASE_URL}/admin-core-service/institute/setting/v1/get`, {
            params: { instituteId, settingKey: STUDENT_DISPLAY_SETTINGS_KEY },
        });
        const serverData = res.data?.data;
        const merged = mergeWithDefaults(
            serverData && Object.keys(serverData).length
                ? serverData
                : DEFAULT_STUDENT_DISPLAY_SETTINGS
        );
        writeCache(merged);
        return merged;
    } catch (error) {
        const defaults = DEFAULT_STUDENT_DISPLAY_SETTINGS;
        writeCache(defaults);
        return defaults;
    }
}

export async function saveStudentDisplaySettings(
    settings: StudentDisplaySettingsData
): Promise<void> {
    const instituteId = getInstituteId();
    if (!instituteId) return;
    const requestData = {
        setting_name: 'Student Display Settings',
        setting_data: settings,
    };
    await authenticatedAxiosInstance.post(
        `${BASE_URL}/admin-core-service/institute/setting/v1/save-setting`,
        requestData,
        {
            params: { instituteId, settingKey: STUDENT_DISPLAY_SETTINGS_KEY },
            headers: { 'Content-Type': 'application/json' },
        }
    );
    writeCache(settings);
}

export function clearStudentDisplaySettingsCache(): void {
    try {
        localStorage.removeItem(LS_KEY);
    } catch {
        // ignore
    }
}
