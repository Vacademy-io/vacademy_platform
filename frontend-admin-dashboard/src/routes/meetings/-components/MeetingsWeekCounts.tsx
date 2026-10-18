import { useTranslation } from 'react-i18next';
import { QuickViews } from '@/components/shared/crm-enhance';
import type { BookingInstanceDTO } from '../-types/meetings-types';

/**
 * Status counts for the meetings already on screen (the week or month shown), for
 * My Schedule and Team Meetings. No extra request.
 */
export function MeetingsWeekCounts({ bookings }: { bookings: BookingInstanceDTO[] | undefined }) {
    const { t } = useTranslation('crmPages');
    if (!bookings) return null;
    const n = (s: string) => bookings.filter((b) => b.status === s).length;
    return (
        <QuickViews
            caption={t('meetings.weekCaption')}
            views={[
                { key: 'all', label: t('meetings.week.all'), count: bookings.length },
                {
                    key: 'confirmed',
                    label: t('meetings.week.confirmed'),
                    count: n('CONFIRMED'),
                    tone: 'success',
                },
                {
                    key: 'pending',
                    label: t('meetings.week.pending'),
                    count: n('PENDING'),
                    tone: 'warning',
                },
                {
                    key: 'rescheduled',
                    label: t('meetings.week.rescheduled'),
                    count: n('RESCHEDULED'),
                    tone: 'info',
                },
                {
                    key: 'cancelled',
                    label: t('meetings.week.cancelled'),
                    count: n('CANCELLED'),
                    tone: 'danger',
                },
            ]}
        />
    );
}
