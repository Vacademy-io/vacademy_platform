import { useTranslation } from 'react-i18next';
import { QuickViews } from '@/components/shared/crm-enhance';

/** WhatsApp Templates: a count per approval status, from the list already loaded. */
export function TemplatesEnhancedCounts({ statuses }: { statuses: string[] }) {
    const { t } = useTranslation('crmPages');
    const live = statuses.filter((s) => s !== 'DELETED');
    const n = (s: string) => live.filter((x) => x === s).length;
    return (
        <div className="mb-4">
            <QuickViews
                caption={t('templates.caption')}
                views={[
                    { key: 'all', label: t('templates.all'), count: live.length },
                    {
                        key: 'approved',
                        label: t('templates.approved'),
                        count: n('APPROVED'),
                        tone: 'success',
                    },
                    {
                        key: 'pending',
                        label: t('templates.pending'),
                        count: n('PENDING'),
                        tone: 'warning',
                    },
                    {
                        key: 'rejected',
                        label: t('templates.rejected'),
                        count: n('REJECTED'),
                        tone: 'danger',
                    },
                    { key: 'draft', label: t('templates.draft'), count: n('DRAFT') },
                    { key: 'disabled', label: t('templates.disabled'), count: n('DISABLED') },
                ]}
            />
        </div>
    );
}
