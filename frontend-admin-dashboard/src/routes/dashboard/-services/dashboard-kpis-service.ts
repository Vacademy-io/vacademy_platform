import type { TFunction } from 'i18next';
import { fetchPendingAdjustments } from '@/services/manage-finances';
import { getUpcomingSessions } from '@/routes/study-library/live-session/-services/utils';
import { fetchInstituteDashboardDetails } from './dashboard-services';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_USER_ROLES_COUNT } from '@/constants/urls';
import { getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import {
    ContentTerms,
    RoleTerms,
    SystemTerms,
} from '@/routes/settings/-components/NamingSettings';

export type KpiFormat = 'number' | 'currency' | 'percent';

export type KpiBreakdownTone = 'neutral' | 'success' | 'warning' | 'danger';

/** A secondary count shown as a chip under the headline value (e.g. Inactive 29). */
export interface KpiBreakdownItem {
    label: string;
    value: number;
    tone: KpiBreakdownTone;
}

export interface DashboardKpi {
    id: string;
    label: string;
    value: number;
    format: KpiFormat;
    deepLink?: string;
    subtitle?: string;
    breakdown?: KpiBreakdownItem[];
}

const safe = async <T>(p: Promise<T>): Promise<T | null> => {
    try {
        return await p;
    } catch {
        return null;
    }
};

const todayKey = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
    ).padStart(2, '0')}`;
};

interface InstituteCounts {
    student_count?: number;
    // Learner status breakdown, matching the Learner Management header badges. Each
    // is a distinct-learner count, so a learner active in one batch and terminated in
    // another is in both buckets — they need not sum to total_student_count.
    total_student_count?: number;
    active_student_count?: number;
    inactive_student_count?: number;
    terminated_student_count?: number;
    batch_count?: number;
    course_count?: number;
    subject_count?: number;
    level_count?: number;
    profile_completion_percentage?: number;
}

const fetchInstituteCounts = async (instituteId: string): Promise<InstituteCounts | null> => {
    if (!instituteId) return null;
    return safe(fetchInstituteDashboardDetails(instituteId) as Promise<InstituteCounts>);
};

// Sum of all non-student users at the institute. Uses the dedicated count
// endpoint, which groups by role across the institute (excluding STUDENT) and
// naturally includes any custom roles defined for the institute.
interface RoleCountRow {
    role_name?: string;
    roleName?: string;
    user_count?: number;
    userCount?: number;
}

const fetchTeamMemberCount = async (instituteId: string): Promise<number> => {
    if (!instituteId) return 0;
    const rows = await safe(
        authenticatedAxiosInstance({
            method: 'GET',
            url: GET_USER_ROLES_COUNT,
            params: { instituteId },
        }).then((r) => r.data as RoleCountRow[])
    );
    if (!Array.isArray(rows)) return 0;
    return rows.reduce((sum, row) => sum + Number(row.user_count ?? row.userCount ?? 0), 0);
};


const buildAdminKpis = async (instituteId: string, t: TFunction): Promise<DashboardKpi[]> => {
    const [counts, dues, sessions, teamCount] = await Promise.all([
        fetchInstituteCounts(instituteId),
        safe(fetchPendingAdjustments()),
        instituteId ? safe(getUpcomingSessions(instituteId)) : Promise.resolve(null),
        fetchTeamMemberCount(instituteId),
    ]);

    const overdueRows = (dues || []).filter((r) => r.is_overdue || r.status === 'OVERDUE');
    const outstanding = overdueRows.reduce((sum, r) => sum + (r.amount_due || 0), 0);
    const overdueCount = overdueRows.length;
    const today = todayKey();
    const classesToday =
        sessions?.find((d) => (d.date || '').slice(0, 10) === today)?.sessions?.length || 0;

    const activeLearners = counts?.active_student_count ?? counts?.student_count ?? 0;
    const inactiveLearners = counts?.inactive_student_count ?? 0;
    const terminatedLearners = counts?.terminated_student_count ?? 0;
    const totalLearners = counts?.total_student_count ?? activeLearners;

    const learnersPlural = getTerminologyPlural(RoleTerms.Learner, SystemTerms.Learner);
    const coursesPlural = getTerminologyPlural(ContentTerms.Course, SystemTerms.Course);
    const batchesPlural = getTerminologyPlural(ContentTerms.Batch, SystemTerms.Batch);
    const liveSessionsPlural = getTerminologyPlural(
        ContentTerms.LiveSession,
        SystemTerms.LiveSession
    );

    return [
        {
            id: 'activeLearners',
            // "Active", not "Total" — the value is the active count, and labelling it
            // Total made it read as contradicting Learner Management's own Total badge.
            label: t('dashboardKpisService:kpis.activeLearners.label', { learners: learnersPlural }),
            value: activeLearners,
            format: 'number',
            subtitle: t('dashboardKpisService:kpis.activeLearners.subtitle', {
                total: totalLearners.toLocaleString('en-IN'),
            }),
            deepLink: '/manage-students/students-list',
            // Always rendered, zeros included — "0 terminated" is itself the answer
            // an admin is looking for. Empty buckets drop to a neutral tone so a
            // healthy institute isn't showing amber/red chips for nothing.
            breakdown: [
                {
                    label: t('dashboardKpisService:breakdown.inactive'),
                    value: inactiveLearners,
                    tone: inactiveLearners > 0 ? 'warning' : 'neutral',
                },
                {
                    label: t('dashboardKpisService:breakdown.terminated'),
                    value: terminatedLearners,
                    tone: terminatedLearners > 0 ? 'danger' : 'neutral',
                },
            ] as KpiBreakdownItem[],
        },
        {
            id: 'totalCourses',
            label: t('dashboardKpisService:kpis.totalCourses.label', { courses: coursesPlural }),
            value: counts?.course_count || 0,
            format: 'number',
            subtitle: t('dashboardKpisService:kpis.totalCourses.subtitle', {
                courses: coursesPlural.toLowerCase(),
            }),
            deepLink: '/study-library/courses',
        },
        {
            id: 'teamMembers',
            label: t('dashboardKpisService:kpis.teamMembers.label'),
            value: teamCount,
            format: 'number',
            subtitle: t('dashboardKpisService:kpis.teamMembers.subtitle', {
                admins: getTerminologyPlural(RoleTerms.Admin, SystemTerms.Admin),
                teachers: getTerminologyPlural(RoleTerms.Teacher, SystemTerms.Teacher).toLowerCase(),
            }),
        },
        {
            id: 'outstandingFees',
            label: t('dashboardKpisService:kpis.outstandingFees.label'),
            value: Math.round(outstanding),
            format: 'currency',
            subtitle: t('dashboardKpisService:kpis.outstandingFees.subtitle'),
        },
        {
            id: 'overdueItems',
            label: t('dashboardKpisService:kpis.overdueItems.label'),
            value: overdueCount,
            format: 'number',
            subtitle: t('dashboardKpisService:kpis.overdueItems.subtitle'),
        },
        {
            id: 'classesToday',
            label: t('dashboardKpisService:kpis.classesToday.label', { sessions: liveSessionsPlural }),
            value: classesToday,
            format: 'number',
            subtitle: t('dashboardKpisService:kpis.classesToday.subtitle', {
                sessions: liveSessionsPlural.toLowerCase(),
            }),
            deepLink: '/study-library/live-session',
        },
    ];
};

const buildTeacherKpis = async (instituteId: string, t: TFunction): Promise<DashboardKpi[]> => {
    const sessions = instituteId ? await safe(getUpcomingSessions(instituteId)) : null;
    const today = todayKey();
    const classesToday =
        sessions?.find((d) => (d.date || '').slice(0, 10) === today)?.sessions?.length || 0;
    const liveSessionsPlural = getTerminologyPlural(
        ContentTerms.LiveSession,
        SystemTerms.LiveSession
    );
    return [
        {
            id: 'classesToday',
            label: t('dashboardKpisService:kpis.classesToday.label', { sessions: liveSessionsPlural }),
            value: classesToday,
            format: 'number',
            deepLink: '/study-library/live-session',
        },
    ];
};

export interface GetDashboardKpisArgs {
    instituteId: string;
    roles: string[];
    t: TFunction;
    /** Current i18next language — included so the query cache re-fetches on language switch. */
    language: string;
}

export const getDashboardKpis = async (args: GetDashboardKpisArgs): Promise<DashboardKpi[]> => {
    const { instituteId, roles, t } = args;
    if (roles.includes('ADMIN')) return buildAdminKpis(instituteId, t);
    if (roles.includes('TEACHER')) return buildTeacherKpis(instituteId, t);
    return [];
};

export const getDashboardKpisQuery = (args: GetDashboardKpisArgs) => {
    const { instituteId, roles, t, language } = args;
    return {
        queryKey: ['DASHBOARD_KPIS', instituteId, roles, language] as const,
        queryFn: () => getDashboardKpis({ instituteId, roles, t, language }),
        staleTime: 60_000,
        retry: false,
    };
};
