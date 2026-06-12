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
    parse,
    startOfMonth,
    startOfWeek,
    subMonths,
} from 'date-fns';
import { CaretLeft, CaretRight, CalendarBlank } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { MyButton } from '@/components/design-system/button';
import type { LeadProfileSummary } from '@/hooks/use-lead-profiles';
import type { LeadStatus as LeadStatusCatalogItem } from '@/hooks/use-lead-statuses';
import {
    LeadEmptyState,
    LeadTable,
    type LeadActionHandlers,
    type LeadCardVM,
    type LeadTableExtraColumn,
} from '@/components/shared/leads';
import type { LeadNotesSummary } from '@/components/shared/leads/lead-table';
import { classify } from './follow-up-buckets';
import {
    bucketPillClasses,
    dayBucketCounts,
    dominantBucket,
    groupByDay,
} from './follow-up-calendar-helpers';

/**
 * FollowUpsCalendarView — month-grid view of pending follow-ups.
 *
 * Pure presentational: it receives the same `LeadCardVM[]` the list view uses
 * and renders them as event pills on a 6×7 day grid. Clicking a date filters
 * the panel below (which re-uses the canonical `LeadTable`). Mobile falls back
 * to an agenda list of days-with-events.
 *
 * Design-system: tokens only — semantic surfaces (`bg-card`, `bg-muted`,
 * `border-border`), typography tokens (`text-h3`, `text-subtitle`,
 * `text-caption`), semantic colour palettes (`primary/danger/warning/info`).
 */

const MAX_PILLS_PER_DAY = 3;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

interface FollowUpsCalendarViewProps {
    vms: LeadCardVM[];
    monthStr: string; // yyyy-MM (local)
    onMonthChange: (m: string) => void;
    selectedDateStr: string; // yyyy-MM-dd (local)
    onSelectDate: (d: string) => void;
    isLoading: boolean;
    error: unknown;
    // LeadTable passthrough for the selected-day panel.
    profiles: Record<string, LeadProfileSummary>;
    notes?: Record<string, LeadNotesSummary>;
    statuses?: LeadStatusCatalogItem[];
    showOps: boolean;
    showScore?: boolean;
    actions: LeadActionHandlers;
    onStatusUpdated?: () => void;
    hiddenColumns?: Set<string>;
    extraColumns?: LeadTableExtraColumn[];
}

export function FollowUpsCalendarView({
    vms,
    monthStr,
    onMonthChange,
    selectedDateStr,
    onSelectDate,
    isLoading,
    error,
    profiles,
    notes,
    statuses,
    showOps,
    showScore,
    actions,
    onStatusUpdated,
    hiddenColumns,
    extraColumns,
}: FollowUpsCalendarViewProps) {
    const month = useMemo(() => safeParseMonth(monthStr), [monthStr]);
    const selectedDate = useMemo(() => safeParseDate(selectedDateStr), [selectedDateStr]);

    // 6-week grid: start at the Sunday of the week containing the 1st.
    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
        const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
        return eachDayOfInterval({ start, end });
    }, [month]);

    const byDay = useMemo(() => groupByDay(vms), [vms]);
    const selectedKey = format(selectedDate, 'yyyy-MM-dd');
    // Stabilise the reference so the useMemo below doesn't re-run every render
    // when the key is missing (default `[]` would be a new array each time).
    const dayVms = useMemo(() => byDay.get(selectedKey) ?? [], [byDay, selectedKey]);
    const dayCounts = useMemo(() => dayBucketCounts(dayVms), [dayVms]);

    // Agenda fallback only needs days IN this month that have events.
    const visibleDaysWithEvents = useMemo(
        () =>
            days.filter(
                (d) =>
                    isSameMonth(d, month) && (byDay.get(format(d, 'yyyy-MM-dd'))?.length ?? 0) > 0
            ),
        [days, byDay, month]
    );

    const goPrev = () => onMonthChange(format(subMonths(month, 1), 'yyyy-MM'));
    const goNext = () => onMonthChange(format(addMonths(month, 1), 'yyyy-MM'));
    const goToday = () => {
        const today = new Date();
        onMonthChange(format(today, 'yyyy-MM'));
        onSelectDate(format(today, 'yyyy-MM-dd'));
    };
    const onDayClick = (d: Date) => onSelectDate(format(d, 'yyyy-MM-dd'));

    return (
        <div className="flex w-full flex-col gap-4">
            {/* Header: month nav + Today */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <MyButton
                        buttonType="text"
                        scale="medium"
                        layoutVariant="icon"
                        onClick={goPrev}
                        aria-label="Previous month"
                    >
                        <CaretLeft className="size-4" />
                    </MyButton>
                    <h2 className="text-h3 text-card-foreground">{format(month, 'MMMM yyyy')}</h2>
                    <MyButton
                        buttonType="text"
                        scale="medium"
                        layoutVariant="icon"
                        onClick={goNext}
                        aria-label="Next month"
                    >
                        <CaretRight className="size-4" />
                    </MyButton>
                </div>
                <MyButton buttonType="secondary" scale="small" onClick={goToday}>
                    <CalendarBlank className="size-4" />
                    Today
                </MyButton>
            </div>

            {error ? (
                <LeadEmptyState
                    title="Couldn't load follow-ups"
                    description="Something went wrong loading the calendar. Try again."
                />
            ) : (
                <>
                    {/* Grid view (md+) */}
                    <div className="hidden md:block">
                        <div className="grid grid-cols-7 overflow-hidden rounded-t-lg border border-b-0 border-border">
                            {DAY_LABELS.map((d) => (
                                <div
                                    key={d}
                                    className="bg-muted p-2 text-caption text-muted-foreground"
                                >
                                    {d}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 overflow-hidden rounded-b-lg border-x border-b border-border">
                            {days.map((day) => {
                                const key = format(day, 'yyyy-MM-dd');
                                const cellVms = byDay.get(key) ?? [];
                                const inMonth = isSameMonth(day, month);
                                const isSelected = isSameDay(day, selectedDate);
                                const todayCell = isToday(day);
                                const overflow = Math.max(0, cellVms.length - MAX_PILLS_PER_DAY);
                                return (
                                    <button
                                        key={day.toISOString()}
                                        type="button"
                                        onClick={() => onDayClick(day)}
                                        className={cn(
                                            'flex min-h-28 flex-col gap-1 border-b border-r border-border bg-card p-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                            !inMonth && 'bg-muted/40',
                                            isSelected && 'ring-2 ring-inset ring-primary-500'
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span
                                                className={cn(
                                                    'text-caption',
                                                    inMonth
                                                        ? 'text-card-foreground'
                                                        : 'text-muted-foreground',
                                                    todayCell &&
                                                        'inline-flex size-5 items-center justify-center rounded-full bg-primary-500 text-neutral-50'
                                                )}
                                            >
                                                {format(day, 'd')}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            {cellVms.slice(0, MAX_PILLS_PER_DAY).map((vm) => {
                                                const bucket = classify(vm);
                                                return (
                                                    <span
                                                        key={vm.key}
                                                        title={vm.name}
                                                        className={cn(
                                                            'truncate rounded-md border px-2 py-0.5 text-caption',
                                                            bucketPillClasses(bucket)
                                                        )}
                                                    >
                                                        {vm.name}
                                                    </span>
                                                );
                                            })}
                                            {overflow > 0 && (
                                                <span className="px-2 text-caption text-muted-foreground">
                                                    +{overflow} more
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Agenda fallback (below md) */}
                    <div className="md:hidden">
                        {visibleDaysWithEvents.length === 0 ? (
                            <LeadEmptyState
                                title="No follow-ups this month"
                                description="Switch month using the arrows above or pick a counsellor."
                            />
                        ) : (
                            <div className="flex flex-col gap-2">
                                {visibleDaysWithEvents.map((day) => {
                                    const key = format(day, 'yyyy-MM-dd');
                                    const dayList = byDay.get(key) ?? [];
                                    const dom = dominantBucket(dayList);
                                    const isSelected = isSameDay(day, selectedDate);
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => onDayClick(day)}
                                            className={cn(
                                                'flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-left hover:bg-muted',
                                                isSelected && 'ring-2 ring-primary-500'
                                            )}
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-caption text-muted-foreground">
                                                    {format(day, 'EEE')}
                                                </span>
                                                <span className="text-subtitle text-card-foreground">
                                                    {format(day, 'd MMM')}
                                                </span>
                                            </div>
                                            <span
                                                className={cn(
                                                    'rounded-md border px-2 py-0.5 text-caption',
                                                    bucketPillClasses(dom)
                                                )}
                                            >
                                                {dayList.length}{' '}
                                                {dayList.length === 1 ? 'task' : 'tasks'}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Selected day panel */}
                    <div className="mt-2 flex flex-col gap-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="text-subtitle font-semibold text-card-foreground">
                                {format(selectedDate, 'EEEE, MMM d')}
                            </h3>
                            <div className="flex items-center gap-2 text-caption">
                                {dayCounts.overdue > 0 && (
                                    <span className="rounded-md border border-danger-200 bg-danger-100 px-2 py-0.5 text-danger-600">
                                        {dayCounts.overdue} overdue
                                    </span>
                                )}
                                {dayCounts.today > 0 && (
                                    <span className="rounded-md border border-warning-200 bg-warning-100 px-2 py-0.5 text-warning-600">
                                        {dayCounts.today} today
                                    </span>
                                )}
                                {dayCounts.upcoming > 0 && (
                                    <span className="rounded-md border border-info-200 bg-info-100 px-2 py-0.5 text-info-600">
                                        {dayCounts.upcoming} upcoming
                                    </span>
                                )}
                                {dayCounts.all === 0 && (
                                    <span className="text-muted-foreground">No follow-ups</span>
                                )}
                            </div>
                        </div>
                        <LeadTable
                            vms={dayVms}
                            profiles={profiles}
                            notes={notes}
                            statuses={statuses}
                            showOps={showOps}
                            showScore={showScore}
                            isLoading={isLoading}
                            actions={actions}
                            onStatusUpdated={onStatusUpdated}
                            hiddenColumns={hiddenColumns}
                            extraColumns={extraColumns}
                            emptyState={
                                <LeadEmptyState
                                    title="Nothing on this day"
                                    description="Pick another day on the calendar above."
                                />
                            }
                        />
                    </div>
                </>
            )}
        </div>
    );
}

// Safe parsers — fall back to today / current month on invalid input.
function safeParseMonth(monthStr: string | undefined): Date {
    if (!monthStr) return startOfMonth(new Date());
    const d = parse(monthStr, 'yyyy-MM', new Date());
    return Number.isNaN(d.getTime()) ? startOfMonth(new Date()) : startOfMonth(d);
}
function safeParseDate(dateStr: string | undefined): Date {
    if (!dateStr) return new Date();
    const d = parse(dateStr, 'yyyy-MM-dd', new Date());
    return Number.isNaN(d.getTime()) ? new Date() : d;
}
