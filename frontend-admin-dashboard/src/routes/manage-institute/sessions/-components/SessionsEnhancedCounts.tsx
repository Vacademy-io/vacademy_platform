import { useTranslation } from 'react-i18next';
import { QuickViews } from '@/components/shared/crm-enhance';
import type { SessionsResponse } from '@/types/study-library/session-types';

/** Sessions: session and batch counts from the list the page already loaded. */
export function SessionsEnhancedCounts({ sessions }: { sessions: SessionsResponse | undefined }) {
    const { t } = useTranslation('crmPages');
    if (!sessions?.length) return null;
    const active = sessions.filter((s) => s.session.status === 'ACTIVE').length;
    const batches = sessions.flatMap((s) => s.packages.flatMap((p) => p.level));
    const activeBatches = batches.filter((b) => b.package_session_status === 'ACTIVE').length;
    const courses = new Set(sessions.flatMap((s) => s.packages.map((p) => p.package_dto.id))).size;
    return (
        <div className="mt-4">
            <QuickViews
                views={[
                    { key: 'all', label: t('sessions.all'), count: sessions.length },
                    { key: 'active', label: t('sessions.active'), count: active, tone: 'success' },
                    {
                        key: 'inactive',
                        label: t('sessions.inactive'),
                        count: sessions.length - active,
                    },
                    { key: 'courses', label: t('sessions.courses'), count: courses, tone: 'info' },
                    {
                        key: 'batches',
                        label: t('sessions.batches'),
                        count: activeBatches,
                        tone: 'info',
                    },
                ]}
            />
        </div>
    );
}
