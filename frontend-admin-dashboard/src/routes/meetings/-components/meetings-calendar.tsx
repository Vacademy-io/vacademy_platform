import { useMemo, useState } from 'react';
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
import { CaretLeft, CaretRight, Clock, EnvelopeSimple, VideoCamera } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { BookingInstanceDTO, BookingInstanceStatus } from '../-types/meetings-types';
import { parseUtc } from '../-utils/meetings-utils';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_CHIPS = 3;

const dayKeyOf = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const chipTitle = (b: BookingInstanceDTO): string =>
    b.invitee_name || b.booking_page_title || 'Meeting';

/** Status → chip styling for the day-details dialog. */
const STATUS_CHIP: Record<string, string> = {
    CONFIRMED: 'bg-success-50 text-success-600',
    PENDING: 'bg-warning-50 text-warning-600',
    COMPLETED: 'bg-neutral-100 text-neutral-500',
    NO_SHOW: 'bg-danger-50 text-danger-600',
};

const statusChipClass = (status: BookingInstanceStatus): string =>
    STATUS_CHIP[status] ?? 'bg-neutral-100 text-neutral-500';

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
    // Day the admin clicked — its meetings open in a details dialog.
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
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
                        const clickable = items.length > 0;
                        return (
                            <div
                                key={day.toISOString()}
                                role={clickable ? 'button' : undefined}
                                tabIndex={clickable ? 0 : undefined}
                                aria-label={
                                    clickable
                                        ? `View ${items.length} meeting${items.length === 1 ? '' : 's'} on ${format(day, 'd MMMM yyyy')}`
                                        : undefined
                                }
                                onClick={clickable ? () => setSelectedDay(day) : undefined}
                                onKeyDown={
                                    clickable
                                        ? (e) => {
                                              if (e.key === 'Enter' || e.key === ' ') {
                                                  e.preventDefault();
                                                  setSelectedDay(day);
                                              }
                                          }
                                        : undefined
                                }
                                className={cn(
                                    'min-h-24 border-b border-r border-neutral-100 p-1.5 align-top',
                                    !inMonth && 'bg-neutral-50',
                                    clickable &&
                                        'cursor-pointer transition-colors hover:bg-primary-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300'
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
                                                onClick={(e) => e.stopPropagation()}
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

            {/* Day details: every meeting of the clicked day, with time, invitee and join link. */}
            <MyDialog
                heading={selectedDay ? format(selectedDay, 'EEEE, d MMMM yyyy') : ''}
                open={!!selectedDay}
                onOpenChange={(o) => {
                    if (!o) setSelectedDay(null);
                }}
                dialogWidth="max-w-lg"
            >
                <div className="flex flex-col gap-3 p-4">
                    {(selectedDay ? (byDay.get(dayKeyOf(selectedDay)) ?? []) : []).map((b) => {
                        const start = parseUtc(b.scheduled_start_utc);
                        const end = parseUtc(b.scheduled_end_utc);
                        return (
                            <div
                                key={b.id}
                                className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-body font-semibold text-neutral-700">
                                        {chipTitle(b)}
                                    </span>
                                    <span
                                        className={cn(
                                            'rounded-full px-2 py-0.5 text-caption font-medium',
                                            statusChipClass(b.status)
                                        )}
                                    >
                                        {b.status}
                                    </span>
                                </div>
                                {b.booking_page_title && b.invitee_name && (
                                    <span className="text-caption text-neutral-500">
                                        {b.booking_page_title}
                                    </span>
                                )}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-neutral-500">
                                    <span className="flex items-center gap-1">
                                        <Clock size={14} />
                                        {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                                    </span>
                                    {b.invitee_email && (
                                        <span className="flex items-center gap-1">
                                            <EnvelopeSimple size={14} />
                                            {b.invitee_email}
                                        </span>
                                    )}
                                </div>
                                {b.meet_link && (
                                    <a
                                        href={b.meet_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex w-fit items-center gap-1.5 text-caption font-medium text-primary-500 hover:text-primary-600"
                                    >
                                        <VideoCamera size={14} /> Join meeting
                                    </a>
                                )}
                            </div>
                        );
                    })}
                </div>
            </MyDialog>
        </div>
    );
};
