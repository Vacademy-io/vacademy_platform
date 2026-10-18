import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { instituteTerms } from '@/components/shared/crm-enhance/institute-terms';
import { QuickViews, type QuickView } from '@/components/shared/crm-enhance';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { getSubOrgsWithDetails } from '../../-services/custom-team-services';

const TONE: Record<string, QuickView['tone']> = {
    ACTIVE: 'success',
    PENDING_PAYMENT: 'warning',
    EXPIRED: 'danger',
};

/**
 * Manage Sub-Orgs: Sub-Orgs per plan status. Same cached request as the
 * summary cards and the list (limited to the Sub-Orgs the caller is assigned).
 */
export function SubOrgPlanCounts() {
    const { t } = useTranslation('crmPages');
    const instituteId = getCurrentInstituteId();
    const { data } = useQuery({
        queryKey: ['sub-orgs-with-details', instituteId],
        queryFn: () => getSubOrgsWithDetails(instituteId),
        enabled: !!instituteId,
    });
    if (!data?.content?.length) return null;
    const counts = new Map<string, number>();
    data.content.forEach((o) => {
        const k = o.plan_status || 'NONE';
        counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    const views: QuickView[] = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => ({
            key: k,
            label: t(`institute.subOrgs.status.${k}`, {
                defaultValue: k.replace(/_/g, ' ').toLowerCase(),
            }),
            count: n,
            tone: TONE[k] ?? 'neutral',
        }));
    return (
        <div className="mb-4">
            <QuickViews views={views} caption={t('subOrgs.caption', instituteTerms())} />
        </div>
    );
}
