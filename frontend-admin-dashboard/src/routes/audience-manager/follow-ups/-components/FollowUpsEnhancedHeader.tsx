import { useTranslation } from 'react-i18next';
import { UsersThree } from '@phosphor-icons/react';
import { InsightStrip, type Insight } from '@/components/shared/crm-enhance';
import { useCrmDashboardBlocks } from '@/routes/dashboard/-services/use-crm-blocks';
import type {
    CrmCounsellorRow,
    CrmFollowupsBlock,
} from '@/routes/dashboard/-services/crm-dashboard';
import { formatNumber } from '@/routes/dashboard/-utils/crm-dashboard';
import { Meter } from '@/routes/dashboard/-components/crm/crm-cards';
import { SectionCard } from '@/routes/study-library/live-session/-components/dashboard/dashboard-charts';

/**
 * Follow-ups: who holds the overdue work and what closed today, under the
 * existing tiles. Only for admins and hierarchy-scoped counsellors — other roles are
 * limited to their own follow-ups on this page, and a team breakdown would show more.
 */
export function FollowUpsEnhancedHeader({ allowed }: { allowed: boolean }) {
    const enabled = allowed;
    const { t } = useTranslation('crmPages');
    const { pick } = useCrmDashboardBlocks(['followups', 'counsellors'], { enabled });
    if (!enabled) return null;
    const followups = pick<CrmFollowupsBlock>('followups');
    const rows = (pick<{ rows: CrmCounsellorRow[] }>('counsellors')?.rows ?? [])
        .filter((r) => r.overdue > 0)
        .sort((a, b) => b.overdue - a.overdue);
    if (!followups && rows.length === 0) return null;

    const insights: Insight[] = [];
    const worst = rows[0];
    if (worst) {
        insights.push({
            key: 'worst',
            tone: 'danger',
            title: t('followUps.insights.worst.title', {
                name: worst.name || '—',
                total: worst.overdue,
            }),
            text: t('followUps.insights.worst.text'),
        });
    }
    if (followups?.completed_today !== undefined) {
        insights.push({
            key: 'closed',
            tone: 'success',
            title: t('followUps.insights.closed.title', {
                total: formatNumber(followups.completed_today),
            }),
            text: t('followUps.insights.closed.text', { total: formatNumber(followups.today) }),
            href: '/audience-manager/follow-ups?bucket=completed',
        });
    }
    if (followups && followups.upcoming > 0) {
        insights.push({
            key: 'upcoming',
            tone: 'info',
            title: t('followUps.insights.upcoming.title', {
                total: formatNumber(followups.upcoming),
            }),
            text: t('followUps.insights.upcoming.text'),
            href: '/audience-manager/follow-ups?bucket=upcoming',
        });
    }
    const max = Math.max(1, ...rows.map((r) => r.overdue));
    return (
        <div className="flex flex-col gap-4">
            <InsightStrip insights={insights} />
            {rows.length > 1 && (
                <SectionCard
                    icon={UsersThree}
                    title={t('followUps.byCounsellor.title')}
                    subtitle={t('followUps.byCounsellor.subtitle')}
                >
                    <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
                        {rows.slice(0, 10).map((r) => (
                            <div key={r.owner_id} className="grid grid-cols-12 items-center gap-3">
                                <span className="col-span-4 truncate text-neutral-700">
                                    <span className="text-caption">{r.name || '—'}</span>
                                </span>
                                <span className="col-span-7">
                                    <Meter value={r.overdue} max={max} tone="danger" />
                                </span>
                                <span className="col-span-1 text-right font-semibold tabular-nums text-neutral-900">
                                    <span className="text-caption">{r.overdue}</span>
                                </span>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            )}
        </div>
    );
}
