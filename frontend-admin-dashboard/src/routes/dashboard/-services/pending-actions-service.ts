import { fetchPendingAdjustments } from '@/services/manage-finances';
import { fetchSystemAlerts, stripHtml } from '@/services/notifications/system-alerts';
import { getUpcomingSessions } from '@/routes/study-library/live-session/-services/utils';

export type PendingActionType =
    | 'OVERDUE_PAYMENT'
    | 'PENDING_APPROVAL'
    | 'LIVE_CLASS_TODAY'
    | 'UNREAD_ALERT';

export type PendingActionSeverity = 'high' | 'medium' | 'low';

export interface PendingAction {
    id: string;
    type: PendingActionType;
    title: string;
    subtitle?: string;
    ageHours: number;
    deepLink: string;
    severity: PendingActionSeverity;
}

const HOURS = 1000 * 60 * 60;

const hoursSince = (iso: string | null | undefined): number => {
    if (!iso) return 0;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return 0;
    return Math.max(0, Math.round((Date.now() - t) / HOURS));
};

const formatMoney = (n: number): string => {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(n);
    } catch {
        return `₹${Math.round(n).toLocaleString('en-IN')}`;
    }
};

const safeSettled = async <T>(p: Promise<T>): Promise<T | null> => {
    try {
        return await p;
    } catch {
        return null;
    }
};

const todayKey = (): string => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

// Map fetchPendingAdjustments rows into overdue-payment actions.
// An item is "overdue" when is_overdue=true OR status='OVERDUE'.
const buildOverduePaymentActions = async (): Promise<PendingAction[]> => {
    const rows = await safeSettled(fetchPendingAdjustments());
    if (!rows) return [];
    return rows
        .filter((r) => r.is_overdue || r.status === 'OVERDUE')
        .map((r) => ({
            id: `overdue:${r.id}`,
            type: 'OVERDUE_PAYMENT' as const,
            title: `${r.student_name || 'Student'} — ${formatMoney(r.amount_due || 0)} overdue`,
            subtitle: `${r.days_overdue} day${r.days_overdue === 1 ? '' : 's'} late · ${r.fee_type_name || r.cpo_name || 'Fee'}`,
            ageHours: Math.max(r.days_overdue * 24, hoursSince(r.due_date)),
            deepLink: '/financial-management/collection-dashboard',
            severity: r.days_overdue >= 14 ? 'high' : r.days_overdue >= 7 ? 'medium' : 'low',
        }));
};

// Same source, different slice: items awaiting concession/adjustment approval.
const buildPendingApprovalActions = async (): Promise<PendingAction[]> => {
    const rows = await safeSettled(fetchPendingAdjustments());
    if (!rows) return [];
    return rows
        .filter((r) => r.adjustment_status === 'PENDING_APPROVAL')
        .map((r) => ({
            id: `approval:${r.id}`,
            type: 'PENDING_APPROVAL' as const,
            title: `Approve adjustment for ${r.student_name || 'Student'}`,
            subtitle: `${r.adjustment_type || 'Adjustment'} · ${formatMoney(r.adjustment_amount || 0)}`,
            ageHours: hoursSince(r.due_date),
            deepLink: '/financial-management/collection-dashboard',
            severity: 'medium',
        }));
};

// Live classes scheduled for today (across the institute).
const buildLiveClassTodayActions = async (instituteId: string): Promise<PendingAction[]> => {
    if (!instituteId) return [];
    const days = await safeSettled(getUpcomingSessions(instituteId));
    if (!days) return [];
    const today = todayKey();
    const todayDay = days.find((d) => (d.date || '').slice(0, 10) === today);
    if (!todayDay) return [];
    return todayDay.sessions.slice(0, 5).map((s) => ({
        id: `live:${s.session_id}-${s.schedule_id}`,
        type: 'LIVE_CLASS_TODAY' as const,
        title: s.title || 'Live class',
        subtitle: `${s.start_time?.slice(0, 5) || ''}${s.subject ? ' · ' + s.subject : ''}`,
        ageHours: 0,
        deepLink: '/study-library/live-session',
        severity: 'low',
    }));
};

// Unread system alerts (top 5) — clicking opens the existing alerts modal.
const buildUnreadAlertActions = async (userId: string): Promise<PendingAction[]> => {
    if (!userId) return [];
    const page = await safeSettled(fetchSystemAlerts({ userId, page: 0, size: 10 }));
    if (!page) return [];
    return page.content
        .filter((a) => a.isRead === false && a.isDismissed !== true)
        .slice(0, 5)
        .map((a) => {
            const preview =
                a.content?.type === 'html'
                    ? stripHtml(a.content?.content || '')
                    : a.content?.content || '';
            return {
                id: `alert:${a.messageId}`,
                type: 'UNREAD_ALERT' as const,
                title: a.title || 'Notification',
                subtitle: preview ? preview.slice(0, 80) : undefined,
                ageHours: hoursSince(a.createdAt),
                deepLink: '/dashboard?alerts=open',
                severity: 'low',
            };
        });
};

const SEVERITY_RANK: Record<PendingActionSeverity, number> = {
    high: 3,
    medium: 2,
    low: 1,
};

export interface GetPendingActionsArgs {
    instituteId: string;
    userId: string;
    limit?: number;
}

export const getPendingActions = async (args: GetPendingActionsArgs): Promise<PendingAction[]> => {
    const { instituteId, userId, limit = 20 } = args;
    const groups = await Promise.all([
        buildOverduePaymentActions(),
        buildPendingApprovalActions(),
        buildLiveClassTodayActions(instituteId),
        buildUnreadAlertActions(userId),
    ]);
    const all = groups.flat();
    all.sort((a, b) => {
        const sev = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
        if (sev !== 0) return sev;
        return b.ageHours - a.ageHours;
    });
    return all.slice(0, limit);
};

export const getPendingActionsQuery = (args: GetPendingActionsArgs) => {
    const { instituteId, userId, limit } = args;
    return {
        queryKey: ['PENDING_ACTIONS', instituteId, userId, limit ?? null] as const,
        queryFn: () => getPendingActions({ instituteId, userId, limit }),
        staleTime: 60_000,
        retry: false,
    };
};
