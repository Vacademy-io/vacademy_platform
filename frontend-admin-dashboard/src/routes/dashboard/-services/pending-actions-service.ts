import type { TFunction } from 'i18next';
import { fetchPendingAdjustments } from '@/services/manage-finances';
import { fetchSystemAlerts, stripHtml } from '@/services/notifications/system-alerts';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { formatInstituteMoney, resolveInstituteCurrency } from '@/utils/institute-currency';

export type PendingActionType = 'OVERDUE_PAYMENT' | 'PENDING_APPROVAL' | 'UNREAD_ALERT';

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

/**
 * Overdue-fee amounts have no currency of their own, and this runs outside React, so the
 * institute's currency is read straight off the store rather than a hook. Hardcoding ₹ here
 * mislabelled every non-Indian institute's pending actions.
 */
const formatMoney = (n: number): string =>
    formatInstituteMoney(
        n,
        resolveInstituteCurrency(useInstituteDetailsStore.getState().instituteDetails),
        { compact: false }
    );

const safeSettled = async <T>(p: Promise<T>): Promise<T | null> => {
    try {
        return await p;
    } catch {
        return null;
    }
};

// Map fetchPendingAdjustments rows into overdue-payment actions.
// An item is "overdue" when is_overdue=true OR status='OVERDUE'.
const buildOverduePaymentActions = async (t: TFunction): Promise<PendingAction[]> => {
    const rows = await safeSettled(fetchPendingAdjustments());
    if (!rows) return [];
    const learnerLabel = getTerminology(RoleTerms.Learner, SystemTerms.Learner);
    const defaultFeeType = t('dashboardPendingActionsService:overduePayment.defaultFeeType');
    return rows
        .filter((r) => r.is_overdue || r.status === 'OVERDUE')
        .map((r) => ({
            id: `overdue:${r.id}`,
            type: 'OVERDUE_PAYMENT' as const,
            title: t('dashboardPendingActionsService:overduePayment.title', {
                name: r.student_name || learnerLabel,
                amount: formatMoney(r.amount_due || 0),
            }),
            subtitle: t('dashboardPendingActionsService:overduePayment.subtitle', {
                count: r.days_overdue,
                feeType: r.fee_type_name || r.cpo_name || defaultFeeType,
            }),
            ageHours: Math.max(r.days_overdue * 24, hoursSince(r.due_date)),
            deepLink: '/financial-management/collection-dashboard',
            severity: r.days_overdue >= 14 ? 'high' : r.days_overdue >= 7 ? 'medium' : 'low',
        }));
};

// Same source, different slice: items awaiting concession/adjustment approval.
const buildPendingApprovalActions = async (t: TFunction): Promise<PendingAction[]> => {
    const rows = await safeSettled(fetchPendingAdjustments());
    if (!rows) return [];
    const learnerLabel = getTerminology(RoleTerms.Learner, SystemTerms.Learner);
    const defaultAdjustmentType = t('dashboardPendingActionsService:pendingApproval.defaultType');
    return rows
        .filter((r) => r.adjustment_status === 'PENDING_APPROVAL')
        .map((r) => ({
            id: `approval:${r.id}`,
            type: 'PENDING_APPROVAL' as const,
            title: t('dashboardPendingActionsService:pendingApproval.title', {
                name: r.student_name || learnerLabel,
            }),
            subtitle: t('dashboardPendingActionsService:pendingApproval.subtitle', {
                type: r.adjustment_type || defaultAdjustmentType,
                amount: formatMoney(r.adjustment_amount || 0),
            }),
            ageHours: hoursSince(r.due_date),
            deepLink: '/financial-management/collection-dashboard',
            severity: 'medium',
        }));
};

// Unread system alerts (top 5) — clicking opens the existing alerts modal.
const buildUnreadAlertActions = async (userId: string, t: TFunction): Promise<PendingAction[]> => {
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
                title: a.title || t('dashboardPendingActionsService:unreadAlert.defaultTitle'),
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
    t: TFunction;
    /** Current i18next language — included so the query cache re-fetches on language switch. */
    language: string;
}

export const getPendingActions = async (args: GetPendingActionsArgs): Promise<PendingAction[]> => {
    const { userId, limit = 20, t } = args;
    const groups = await Promise.all([
        buildOverduePaymentActions(t),
        buildPendingApprovalActions(t),
        buildUnreadAlertActions(userId, t),
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
    const { instituteId, userId, limit, t, language } = args;
    return {
        queryKey: ['PENDING_ACTIONS', instituteId, userId, limit ?? null, language] as const,
        queryFn: () => getPendingActions({ instituteId, userId, limit, t, language }),
        staleTime: 60_000,
        retry: false,
    };
};
