import { useMemo } from 'react';
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    isToday,
    startOfMonth,
    startOfWeek,
    subMonths,
} from 'date-fns';
import { CaretLeft, CaretRight, VideoCamera } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { MyButton } from '@/components/design-system/button';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { BookingInstanceDTO } from '../-types/meetings-types';
import { parseUtc } from '../-utils/meetings-utils';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_CHIPS = 3;

const dayKeyOf = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const chipTitle = (b: BookingInstanceDTO): string =>
    b.invitee_name || b.booking_page_title || 'Meeting';

interface MeetingsCalendarProps {
    bookings: BookingInstanceDTO[];
    /** Any date within the month being shown. */
    month: Date;
    onMonthChange: (next: Date) => void;
    isLoading?: boolean;
}

/** Month-grid calendar of the host's bookings (reuses the /my-calendar data). */
export const MeetingsCalendar = ({
    bookings,
    month,
    onMonthChange,
    isLoading,
}: MeetingsCalendarProps) => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    const days = useMemo(
        () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
        [gridStart, gridEnd]
    );

    const byDay = useMemo(() => {
        const map = new Map<string, BookingInstanceDTO[]>();
        for (const b of bookings) {
            if (b.status === 'CANCELLED' || b.status === 'RESCHEDULED') continue;
            const key = dayKeyOf(parseUtc(b.scheduled_start_utc));
            (map.get(key) ?? map.set(key, []).get(key)!).push(b);
        }
        for (const list of map.values()) {
            list.sort(
                (a, b) =>
                    parseUtc(a.scheduled_start_utc).getTime() - parseUtc(b.scheduled_start_utc).getTime()
            );
        }
        return map;
    }, [bookings]);

    return (
        <div className="rounded-lg border border-neutral-200 bg-white">
            {/* Month toolbar */}
            <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
                <h2 className="text-base font-semibold text-neutral-800">
                    {format(month, 'MMMM yyyy')}
                </h2>
                <div className="flex items-center gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        layoutVariant="icon"
                        onClick={() => onMonthChange(subMonths(month, 1))}
                        aria-label="Previous month"
                    >
                        <CaretLeft size={16} />
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        onClick={() => onMonthChange(new Date())}
                    >
                        Today
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        layoutVariant="icon"
                        onClick={() => onMonthChange(addMonths(month, 1))}
                        aria-label="Next month"
                    >
                        <CaretRight size={16} />
                    </MyButton>
                </div>
            </div>

            {/* Weekday header */}
            <div className="grid grid-cols-7 border-b border-neutral-100">
                {WEEKDAYS.map((d) => (
                    <div
                        key={d}
                        className="px-2 py-2 text-center text-caption font-medium uppercase tracking-wide text-neutral-400"
                    >
                        {d}
                    </div>
                ))}
            </div>

            {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                    <DashboardLoader />
                </div>
            ) : (
                <div className="grid grid-cols-7">
                    {days.map((day) => {
                        const items = byDay.get(dayKeyOf(day)) ?? [];
                        const inMonth = isSameMonth(day, month);
                        const today = isToday(day);
                        return (
                            <div
                                key={day.toISOString()}
                                className={cn(
                                    'min-h-24 border-b border-r border-neutral-100 p-1.5 align-top',
                                    !inMonth && 'bg-neutral-50'
                                )}
                            >
                                <div className="mb-1 flex justify-end">
                                    <span
                                        className={cn(
                                            'flex h-6 w-6 items-center justify-center rounded-full text-caption',
                                            today
                                                ? 'bg-primary-500 font-semibold text-white'
                                                : inMonth
                                                  ? 'text-neutral-600'
                                                  : 'text-neutral-300'
                                        )}
                                    >
                                        {format(day, 'd')}
                                    </span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    {items.slice(0, MAX_CHIPS).map((b) => {
                                        const start = parseUtc(b.scheduled_start_utc);
                                        const chip = (
                                            <span className="flex items-center gap-1 truncate">
                                                {b.meet_link && (
                                                    <VideoCamera size={11} className="shrink-0" />
                                                )}
                                                <span className="truncate">
                                                    {format(start, 'h:mm a')} · {chipTitle(b)}
                                                </span>
                                            </span>
                                        );
                                        return b.meet_link ? (
                                            <a
                                                key={b.id}
                                                href={b.meet_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title={`${format(start, 'h:mm a')} — ${chipTitle(b)}`}
                                                className="truncate rounded bg-primary-50 px-1.5 py-0.5 text-caption text-primary-700 hover:bg-primary-100"
                                            >
                                                {chip}
                                            </a>
                                        ) : (
                                            <span
                                                key={b.id}
                                                title={`${format(start, 'h:mm a')} — ${chipTitle(b)}`}
                                                className="truncate rounded bg-neutral-100 px-1.5 py-0.5 text-caption text-neutral-600"
                                            >
                                                {chip}
                                            </span>
                                        );
                                    })}
                                    {items.length > MAX_CHIPS && (
                                        <span className="px-1 text-caption text-neutral-400">
                                            +{items.length - MAX_CHIPS} more
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
