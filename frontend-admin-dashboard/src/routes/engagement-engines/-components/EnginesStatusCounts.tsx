import { useTranslation } from 'react-i18next';
import { QuickViews, type QuickView } from '@/components/shared/crm-enhance';
import { buildEngineStatusMeta } from '../-constants';

const TONE: Record<string, QuickView['tone']> = {
    ACTIVE: 'success',
    PAUSED: 'warning',
    TEMPLATES_PENDING: 'warning',
    DRY_RUN: 'info',
};

/** Engagement Engines: a count per engine status, from the list already loaded. */
export function EnginesStatusCounts({ statuses }: { statuses: string[] }) {
    const { t } = useTranslation('crmPages');
    const { t: tConstants } = useTranslation('engagementEnginesConstants');
    if (statuses.length === 0) return null;
    const meta = buildEngineStatusMeta(tConstants) as Record<string, { label: string }>;
    const order = ['ACTIVE', 'DRY_RUN', 'TEMPLATES_PENDING', 'PAUSED', 'DRAFT', 'ARCHIVED'];
    const views: QuickView[] = [
        { key: 'all', label: t('engines.all'), count: statuses.length },
        ...order
            .map((s) => ({ s, n: statuses.filter((x) => x === s).length }))
            .filter((x) => x.n > 0)
            .map((x) => ({
                key: x.s,
                label: meta[x.s]?.label ?? x.s,
                count: x.n,
                tone: TONE[x.s] ?? 'neutral',
            })),
    ];
    return <QuickViews views={views} />;
}
