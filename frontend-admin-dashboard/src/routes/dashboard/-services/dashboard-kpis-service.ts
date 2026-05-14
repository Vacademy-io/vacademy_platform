import { fetchPendingAdjustments } from '@/services/manage-finances';
import { getUpcomingSessions } from '@/routes/study-library/live-session/-services/utils';
import { fetchInstituteDashboardDetails, fetchInstituteDashboardUsers } from './dashboard-services';

export type KpiFormat = 'number' | 'currency' | 'percent';

export interface DashboardKpi {
    id: string;
    label: string;
    value: number;
    format: KpiFormat;
    deepLink?: string;
    subtitle?: string;
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

// Sum of all non-student users at the institute, across active + disabled +
// invited. The endpoint is paginated; we only need the totals so we ask for
// pageSize=1 and read `totalElements`.
const ALL_TEAM_ROLES = [
    { id: '1', name: 'ADMIN' },
    { id: '2', name: 'COURSE CREATOR' },
    { id: '3', name: 'ASSESSMENT CREATOR' },
    { id: '4', name: 'EVALUATOR' },
    { id: '5', name: 'TEACHER' },
];

const totalElementsFromResponse = (resp: unknown): number => {
    if (!resp) return 0;
    if (Array.isArray(resp)) return resp.length;
    const r = resp as { totalElements?: number; content?: unknown[] };
    if (typeof r.totalElements === 'number') return r.totalElements;
    if (Array.isArray(r.content)) return r.content.length;
    return 0;
};

const fetchTeamMemberCount = async (instituteId: string): Promise<number> => {
    if (!instituteId) return 0;
    const [active, invited] = await Promise.all([
        safe(
            fetchInstituteDashboardUsers(
                instituteId,
                {
                    roles: ALL_TEAM_ROLES,
                    status: [
                        { id: '1', name: 'ACTIVE' },
                        { id: '2', name: 'DISABLED' },
                    ],
                },
                0,
                1
            )
        ),
        safe(
            fetchInstituteDashboardUsers(
                instituteId,
                {
                    roles: ALL_TEAM_ROLES,
                    status: [{ id: '1', name: 'INVITED' }],
                },
                0,
                1
            )
        ),
    ]);
    return totalElementsFromResponse(active) + totalElementsFromResponse(invited);
};

const buildAdminKpis = async (instituteId: string): Promise<DashboardKpi[]> => {
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

    return [
        {
            id: 'activeLearners',
            label: 'Total Students',
            value: counts?.student_count || 0,
            format: 'number',
            subtitle: 'Enrolled across batches',
            deepLink: '/manage-students',
        },
        {
            id: 'totalCourses',
            label: 'Total Courses',
            value: counts?.course_count || 0,
            format: 'number',
            subtitle: 'Across all subjects',
            deepLink: '/study-library/courses',
        },
        {
            id: 'teamMembers',
            label: 'Team Members',
            value: teamCount,
            format: 'number',
            subtitle: 'Admins, teachers & staff',
        },
        {
            id: 'outstandingFees',
            label: 'Outstanding Fees',
            value: Math.round(outstanding),
            format: 'currency',
            subtitle: 'Due across overdue items',
            deepLink: '/financial-management/collection-dashboard',
        },
        {
            id: 'overdueItems',
            label: 'Overdue Items',
            value: overdueCount,
            format: 'number',
            subtitle: 'Need follow-up',
            deepLink: '/financial-management/collection-dashboard',
        },
        {
            id: 'classesToday',
            label: 'Classes Today',
            value: classesToday,
            format: 'number',
            subtitle: 'Scheduled live sessions',
            deepLink: '/study-library/live-session',
        },
    ];
};

const buildTeacherKpis = async (instituteId: string): Promise<DashboardKpi[]> => {
    const sessions = instituteId ? await safe(getUpcomingSessions(instituteId)) : null;
    const today = todayKey();
    const classesToday =
        sessions?.find((d) => (d.date || '').slice(0, 10) === today)?.sessions?.length || 0;
    return [
        {
            id: 'classesToday',
            label: 'Classes Today',
            value: classesToday,
            format: 'number',
            deepLink: '/study-library/live-session',
        },
    ];
};

export interface GetDashboardKpisArgs {
    instituteId: string;
    roles: string[];
}

export const getDashboardKpis = async (args: GetDashboardKpisArgs): Promise<DashboardKpi[]> => {
    const { instituteId, roles } = args;
    if (roles.includes('ADMIN')) return buildAdminKpis(instituteId);
    if (roles.includes('TEACHER')) return buildTeacherKpis(instituteId);
    return [];
};

export const getDashboardKpisQuery = (args: GetDashboardKpisArgs) => {
    const { instituteId, roles } = args;
    return {
        queryKey: ['DASHBOARD_KPIS', instituteId, roles] as const,
        queryFn: () => getDashboardKpis({ instituteId, roles }),
        staleTime: 60_000,
        retry: false,
    };
};
