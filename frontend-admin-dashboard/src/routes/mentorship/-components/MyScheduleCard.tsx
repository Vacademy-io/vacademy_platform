import { useMemo } from 'react';
import { CalendarBlank, VideoCamera } from '@phosphor-icons/react';
import { useMySchedule } from '../-hooks/use-mentorship';
import type { BookingInstance } from '../-types/mentorship-types';

const ymd = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const startMs = (b: BookingInstance): number => {
    if (b.scheduled_start_utc == null) return Number.MAX_SAFE_INTEGER;
    const d = new Date(b.scheduled_start_utc);
    return Number.isNaN(d.getTime()) ? Number.MAX_SAFE_INTEGER : d.getTime();
};

const fmtWhen = (v?: string | number | null): string => {
    if (v == null) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const isToday = (v?: string | number | null): boolean => {
    if (v == null) return false;
    const d = new Date(v);
    const now = new Date();
    return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
    );
};

interface MyScheduleCardProps {
    instituteId: string | undefined;
}

/** The mentor's own upcoming 1:1 sessions across all mentees (today + next 30 days). */
export function MyScheduleCard({ instituteId }: MyScheduleCardProps) {
    const { startDate, endDate } = useMemo(() => {
        const now = new Date();
        const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        return { startDate: ymd(now), endDate: ymd(end) };
    }, []);

    const { data, isLoading } = useMySchedule(instituteId, startDate, endDate);

    const sessions = useMemo(
        () =>
            (data ?? [])
                .filter((b) => b.status !== 'CANCELLED' && b.status !== 'RESCHEDULED')
                .sort((a, b) => startMs(a) - startMs(b))
                .slice(0, 12),
        [data]
    );

    if (!isLoading && sessions.length === 0) return null;

    return (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
                <CalendarBlank size={18} weight="bold" className="text-primary-600" />
                <span className="text-body font-semibold text-neutral-700">Upcoming sessions</span>
            </div>
            {isLoading ? (
                <div className="py-4 text-caption text-neutral-400">Loading…</div>
            ) : (
                <div className="flex flex-col divide-y divide-neutral-100">
                    {sessions.map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                            <div className="flex min-w-0 flex-col">
                                <span className="flex items-center gap-2 text-body text-neutral-700">
                                    <span className="truncate font-medium">
                                        {s.invitee_name || 'Learner'}
                                    </span>
                                    {isToday(s.scheduled_start_utc) && (
                                        <span className="rounded-full bg-primary-50 px-2 py-0.5 text-caption font-medium text-primary-600">
                                            Today
                                        </span>
                                    )}
                                </span>
                                <span className="text-caption text-neutral-500">
                                    {fmtWhen(s.scheduled_start_utc)}
                                    {s.status && s.status !== 'CONFIRMED' ? ` · ${s.status}` : ''}
                                </span>
                            </div>
                            {s.meet_link ? (
                                <a
                                    href={s.meet_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex shrink-0 items-center gap-1 text-caption font-medium text-primary-500 hover:text-primary-600"
                                >
                                    <VideoCamera size={16} /> Join
                                </a>
                            ) : (
                                // Meet links are minted after the booking commits, so a
                                // brand-new session can legitimately have none yet — and a
                                // row with no control at all reads as broken.
                                <span
                                    className="shrink-0 text-caption text-neutral-400"
                                    title="The meeting link is still being created. If it doesn't appear, ask your admin to check the Google connection."
                                >
                                    Link pending
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
