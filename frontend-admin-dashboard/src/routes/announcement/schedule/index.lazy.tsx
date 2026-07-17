import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnnouncementService, type ModeType } from '@/services/announcement';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { isUserAdmin } from '@/utils/userDetails';

type Announcement = {
    id: string;
    title: string;
    status?: string;
    createdByName?: string;
    createdBy?: string;
    createdByRole?: string;
    modes?: Array<{ modeType: ModeType; settings?: Record<string, unknown> }>;
    mediumTypes?: string[];
    scheduling?: {
        scheduleType?: 'IMMEDIATE' | 'ONE_TIME' | 'RECURRING';
        timezone?: string;
        startDate?: string;
        endDate?: string;
        cronExpression?: string;
    };
};

export const Route = createLazyFileRoute('/announcement/schedule/')({
    component: () => (
        <LayoutContainer>
            <AnnouncementSchedulePage />
        </LayoutContainer>
    ),
});

type ViewType = 'week' | '3day' | 'day' | 'month';

function AnnouncementSchedulePage() {
    const { setNavHeading } = useNavHeadingStore();
    const { toast } = useToast();
    const navigate = useNavigate();
    const admin = isUserAdmin();

    useEffect(() => {
        setNavHeading('Schedule Announcement');
    }, [setNavHeading]);

    const [view, setView] = useState<ViewType>('week');
    const [modeFilter, setModeFilter] = useState<ModeType | 'ALL'>('ALL');
    const [startDate, setStartDate] = useState<Date>(startOfDay(new Date()));

    const range = useMemo(() => getRangeForView(view, startDate), [view, startDate]);

    const {
        data: planned = [],
        isLoading,
        refetch,
    } = useQuery({
        queryKey: [
            'announcement-planned',
            view,
            range.from.toISOString(),
            range.to.toISOString(),
            modeFilter,
        ],
        queryFn: async (): Promise<Announcement[]> => {
            const res = await AnnouncementService.planned({
                page: 0,
                size: 100,
                from: range.from.toISOString(),
                to: range.to.toISOString(),
            });
            // Backend returns AnnouncementCalendarItem (flat shape) — map to the local nested
            // Announcement shape that the rest of this page expects.
            type RawCalendarItem = {
                announcementId: string;
                title: string;
                status?: string;
                createdByRole?: string;
                modeTypes?: string[];
                mediumTypes?: string[];
                scheduleType?: 'IMMEDIATE' | 'ONE_TIME' | 'RECURRING';
                timezone?: string;
                startDate?: string;
                endDate?: string;
                nextRunTime?: string;
            };
            const raw: RawCalendarItem[] = Array.isArray(res) ? res : res?.content ?? [];
            const list: Announcement[] = raw.map((r) => ({
                id: r.announcementId,
                title: r.title,
                status: r.status,
                createdByRole: r.createdByRole,
                modes: (r.modeTypes || []).map((m) => ({ modeType: m as ModeType })),
                mediumTypes: r.mediumTypes || [],
                scheduling: r.scheduleType
                    ? {
                          scheduleType: r.scheduleType,
                          timezone: r.timezone,
                          startDate: r.startDate,
                          endDate: r.endDate,
                      }
                    : undefined,
            }));
            if (modeFilter === 'ALL') return list;
            return list.filter((a) => a.modes?.some((m) => m.modeType === modeFilter));
        },
        refetchOnWindowFocus: false,
    });

    // Approvals
    const [rejectFor, setRejectFor] = useState<Announcement | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    // Destructive: confirm before delete so an accidental click doesn't cancel a scheduled send.
    const [deleteFor, setDeleteFor] = useState<Announcement | null>(null);
    const [deleting, setDeleting] = useState(false);

    const onDelete = async () => {
        if (!deleteFor) return;
        setDeleting(true);
        try {
            await AnnouncementService.remove(deleteFor.id);
            toast({ title: 'Scheduled announcement deleted' });
            setDeleteFor(null);
            refetch();
        } catch (e) {
            toast({
                title: 'Delete failed',
                description: e instanceof Error ? e.message : 'Try again',
                variant: 'destructive',
            });
        } finally {
            setDeleting(false);
        }
    };

    const onApprove = async (a: Announcement) => {
        try {
            await AnnouncementService.approve(a.id, 'ADMIN');
            toast({ title: 'Approved' });
            refetch();
        } catch (e) {
            toast({ title: 'Approve failed', variant: 'destructive' });
        }
    };
    const onReject = async () => {
        if (!rejectFor) return;
        try {
            await AnnouncementService.reject(rejectFor.id, 'ADMIN', rejectReason || '');
            toast({ title: 'Rejected' });
            setRejectReason('');
            setRejectFor(null);
            refetch();
        } catch (e) {
            toast({ title: 'Reject failed', variant: 'destructive' });
        }
    };

    // Navigate to create prefilled
    const goToCreateAt = (date: Date) => {
        const iso = new Date(date).toISOString();
        navigate({
            to: '/announcement/create',
            search: {
                scheduleType: 'ONE_TIME',
                startDate: iso,
            },
        });
    };

    // Navigate to edit an existing scheduled campaign in the email-campaigning form
    const goToEdit = (a: Announcement) => {
        navigate({
            to: '/announcement/email-campaigning',
            search: { id: a.id },
        });
    };

    // An announcement is editable as long as it has not already been delivered or cancelled
    const isEditable = (a: Announcement) => {
        const s = a.status;
        if (!s) return true;
        if (s === 'ACTIVE' || s === 'INACTIVE' || s === 'EXPIRED' || s === 'REJECTED') {
            return false;
        }
        // If a schedule exists and its start has passed, treat as no longer editable
        const start = a.scheduling?.startDate;
        if (start) {
            const startMs = Date.parse(start);
            if (!Number.isNaN(startMs) && startMs <= Date.now()) return false;
        }
        return true;
    };

    // View switch and navigation
    const goPrev = () =>
        setStartDate(
            addDays(
                startDate,
                view === 'month' ? -30 : view === 'week' ? -7 : view === '3day' ? -3 : -1
            )
        );
    const goNext = () =>
        setStartDate(
            addDays(
                startDate,
                view === 'month' ? 30 : view === 'week' ? 7 : view === '3day' ? 3 : 1
            )
        );
    const goToday = () => setStartDate(startOfDay(new Date()));

    const grouped = useMemo(() => groupByDay(planned, range.from, range.to), [planned, range]);

    return (
        <div className="p-4">
            <h2 className="mb-4 text-xl font-semibold">Schedule Announcements</h2>

            <div className="mb-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={goPrev}>
                        Prev
                    </Button>
                    <Button variant="secondary" onClick={goToday}>
                        Today
                    </Button>
                    <Button variant="secondary" onClick={goNext}>
                        Next
                    </Button>
                </div>
                <Tabs value={view} onValueChange={(v) => setView(v as ViewType)}>
                    <TabsList>
                        <TabsTrigger value="day">Day</TabsTrigger>
                        <TabsTrigger value="3day">3-day</TabsTrigger>
                        <TabsTrigger value="week">Week</TabsTrigger>
                        <TabsTrigger value="month">Month</TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="text-lg font-medium">{formatMonthYear(startDate)}</div>
                <div className="ml-auto flex items-center gap-2">
                    <Select
                        value={modeFilter}
                        onValueChange={(v) => setModeFilter(v as ModeType | 'ALL')}
                    >
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="Mode filter" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All modes</SelectItem>
                            <SelectItem value="SYSTEM_ALERT">SYSTEM_ALERT</SelectItem>
                            <SelectItem value="DASHBOARD_PIN">DASHBOARD_PIN</SelectItem>
                            <SelectItem value="APP_OVERLAY">APP_OVERLAY</SelectItem>
                            <SelectItem value="DM">DM</SelectItem>
                            <SelectItem value="STREAM">STREAM</SelectItem>
                            <SelectItem value="RESOURCES">RESOURCES</SelectItem>
                            <SelectItem value="COMMUNITY">COMMUNITY</SelectItem>
                            <SelectItem value="TASKS">TASKS</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button onClick={() => goToCreateAt(new Date())}>Schedule new</Button>
                </div>
            </div>

            <Separator className="mb-3" />

            {view === 'month' ? (
                <MonthGrid
                    start={startOfMonth(startDate)}
                    events={planned}
                    onCreate={(d) => goToCreateAt(d)}
                    onApprove={onApprove}
                    onReject={(a) => setRejectFor(a)}
                    admin={admin}
                />
            ) : (
                <Agenda
                    start={range.from}
                    end={range.to}
                    grouped={grouped}
                    onCreate={(d) => goToCreateAt(d)}
                    onApprove={onApprove}
                    onReject={(a) => setRejectFor(a)}
                    onEdit={goToEdit}
                    onDelete={(a) => setDeleteFor(a)}
                    canEdit={isEditable}
                    admin={admin}
                    loading={isLoading}
                />
            )}

            <Dialog open={!!rejectFor} onOpenChange={(open) => !open && setRejectFor(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Announcement</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-2">
                        <Textarea
                            placeholder="Reason"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setRejectFor(null)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={onReject}>
                                Reject
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deleteFor} onOpenChange={(open) => !open && setDeleteFor(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete scheduled announcement?</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3">
                        <p className="text-sm text-neutral-700">
                            This will permanently cancel and delete{' '}
                            <span className="font-medium">{deleteFor?.title || 'this announcement'}</span>.
                            It will not be delivered and cannot be restored.
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="secondary"
                                onClick={() => setDeleteFor(null)}
                                disabled={deleting}
                            >
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={onDelete} disabled={deleting}>
                                {deleting ? 'Deleting…' : 'Delete'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function Agenda(props: {
    start: Date;
    end: Date;
    grouped: { date: Date; items: Announcement[] }[];
    onCreate: (d: Date) => void;
    onApprove: (a: Announcement) => void;
    onReject: (a: Announcement) => void;
    onEdit: (a: Announcement) => void;
    onDelete: (a: Announcement) => void;
    canEdit: (a: Announcement) => boolean;
    admin: boolean;
    loading: boolean;
}) {
    const {
        start,
        end,
        grouped,
        onCreate,
        onApprove,
        onReject,
        onEdit,
        onDelete,
        canEdit,
        admin,
        loading,
    } = props;
    return (
        <div className="grid gap-4">
            <div className="text-sm text-neutral-600">Showing {formatRange(start, end)}</div>
            {loading ? (
                <div className="text-sm">Loading…</div>
            ) : grouped.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded border border-dashed py-12 text-center">
                    <div className="text-sm font-medium text-neutral-700">
                        No scheduled announcements in this range
                    </div>
                    <div className="text-xs text-neutral-500">
                        Pick a different range, or schedule a new campaign.
                    </div>
                    <Button
                        size="sm"
                        variant="secondary"
                        className="mt-2"
                        onClick={() => onCreate(atMidday(start))}
                    >
                        Schedule new
                    </Button>
                </div>
            ) : (
                grouped.map(({ date, items }, idx) => (
                    <div key={idx} className="rounded border">
                        <div className="flex items-center justify-between border-b bg-muted p-2 text-sm">
                            <div>{date.toDateString()}</div>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => onCreate(atMidday(date))}
                            >
                                Schedule here
                            </Button>
                        </div>
                        <div className="grid gap-2 p-2">
                            {items.map((a) => (
                                <EventCard
                                    key={a.id}
                                    a={a}
                                    onApprove={onApprove}
                                    onReject={onReject}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    canEdit={canEdit(a)}
                                    admin={admin}
                                />
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}

function MonthGrid(props: {
    start: Date;
    events: Announcement[];
    onCreate: (d: Date) => void;
    onApprove: (a: Announcement) => void;
    onReject: (a: Announcement) => void;
    admin: boolean;
}) {
    const { start, events, onCreate } = props;
    const { firstOfMonth, lastOfMonth } = useMemo(() => getMonthMeta(start), [start]);
    const byDay = useMemo(
        () => groupByDay(events, firstOfMonth, lastOfMonth),
        [events, firstOfMonth, lastOfMonth]
    );
    const cells = useMemo(() => buildMonthCells(firstOfMonth), [firstOfMonth]);
    return (
        <div className="grid gap-2">
            <div className="grid grid-cols-7 gap-2 text-xs text-neutral-500">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="px-2">
                        {d}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
                {cells.map((cell: Date | null, idx: number) => {
                    if (!cell) {
                        return (
                            <div
                                key={idx}
                                className="min-h-[120px] rounded border p-2 opacity-30"
                            />
                        );
                    }
                    const bucket = byDay.find((g) => isSameDay(g.date, cell));
                    return (
                        <Card key={idx} className="min-h-[120px] p-2">
                            <div className="mb-1 flex items-center justify-between text-xs">
                                <div>{cell.getDate()}</div>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => onCreate(atMidday(cell))}
                                >
                                    +
                                </Button>
                            </div>
                            <div className="flex flex-col gap-1">
                                {(bucket?.items ?? []).slice(0, 3).map((a) => (
                                    <EventPill key={a.id} a={a} />
                                ))}
                                {bucket && (bucket.items?.length ?? 0) > 3 && (
                                    <div className="text-xs text-neutral-500">
                                        +{bucket.items.length - 3} more
                                    </div>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

function EventCard({
    a,
    onApprove,
    onReject,
    onEdit,
    onDelete,
    canEdit,
    admin,
}: {
    a: Announcement;
    onApprove: (a: Announcement) => void;
    onReject: (a: Announcement) => void;
    onEdit: (a: Announcement) => void;
    onDelete: (a: Announcement) => void;
    canEdit: boolean;
    admin: boolean;
}) {
    const color = colorForAnnouncement(a);
    // Prefer external-channel badges (EMAIL / WHATSAPP / PUSH_NOTIFICATION) since those are
    // what the recipient actually experiences. Fall back to the in-app mode for announcements
    // with no external channel (pure SYSTEM_ALERT / DASHBOARD_PIN / DM / etc).
    const badgeLabels: string[] =
        a.mediumTypes && a.mediumTypes.length > 0
            ? a.mediumTypes
            : (a.modes || []).map((m) => m.modeType);
    const timeLabel = formatScheduleTime(a.scheduling);
    return (
        <div className="flex items-start justify-between gap-3 rounded border p-3">
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <span className={`inline-block size-2 rounded-full ${color}`} />
                    <div className="font-medium">{a.title}</div>
                    {a.status && a.status !== 'DRAFT' && (
                        <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusPillClasses(a.status)}`}
                        >
                            {a.status.replace('_', ' ')}
                        </span>
                    )}
                </div>
                {timeLabel && (
                    <div className="mt-1 text-sm font-medium text-neutral-800">{timeLabel}</div>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-neutral-600">
                    {badgeLabels.map((label, i) => (
                        <Badge key={i} variant="outline">
                            {label}
                        </Badge>
                    ))}
                </div>
                <div className="mt-1 text-xs text-neutral-500">{renderSchedule(a.scheduling)}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
                {canEdit && (
                    <Button size="sm" variant="secondary" onClick={() => onEdit(a)}>
                        Edit
                    </Button>
                )}
                {canEdit && (
                    <Button size="sm" variant="destructive" onClick={() => onDelete(a)}>
                        Delete
                    </Button>
                )}
                {a.status === 'PENDING_APPROVAL' && admin && (
                    <>
                        <Button size="sm" onClick={() => onApprove(a)}>
                            Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => onReject(a)}>
                            Reject
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}

function statusPillClasses(status: string): string {
    switch (status) {
        case 'SCHEDULED':
            return 'bg-blue-100 text-blue-800';
        case 'ACTIVE':
            return 'bg-green-100 text-green-800';
        case 'PENDING_APPROVAL':
            return 'bg-amber-100 text-amber-800';
        case 'DRAFT':
            return 'bg-neutral-200 text-neutral-700';
        case 'INACTIVE':
        case 'EXPIRED':
            return 'bg-neutral-200 text-neutral-500';
        case 'REJECTED':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-neutral-200 text-neutral-700';
    }
}

function formatScheduleTime(s?: Announcement['scheduling']): string {
    if (!s) return '';
    if (s.scheduleType === 'IMMEDIATE') return 'Immediate';
    if (s.scheduleType === 'RECURRING') {
        return s.cronExpression ? `Recurring · ${s.cronExpression}` : 'Recurring';
    }
    // ONE_TIME — prefer just the local-formatted time, no awkward "→ -" tail
    if (!s.startDate) return '';
    try {
        return new Date(s.startDate).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    } catch {
        return s.startDate;
    }
}

function EventPill({ a }: { a: Announcement }) {
    const color = colorForAnnouncement(a);
    return (
        <div className={`truncate rounded px-2 py-1 text-xs ${bgForColor(color)} text-white`}>
            {a.title}
        </div>
    );
}

// Helpers
function getRangeForView(view: ViewType, start: Date) {
    if (view === 'day') return { from: startOfDay(start), to: endOfDay(start) };
    if (view === '3day') return { from: startOfDay(start), to: endOfDay(addDays(start, 2)) };
    if (view === 'week') return { from: startOfDay(start), to: endOfDay(addDays(start, 6)) };
    // month
    const from = startOfMonth(start);
    const to = endOfMonth(start);
    return { from, to };
}

function groupByDay(items: Announcement[], from: Date, to: Date) {
    const days: { date: Date; items: Announcement[] }[] = [];
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
        days.push({ date: new Date(d), items: [] });
    }
    items.forEach((a) => {
        const startStr = a.scheduling?.startDate;
        if (!startStr) return;
        const dt = new Date(startStr);
        const idx = days.findIndex((g) => isSameDay(g.date, dt));
        if (idx >= 0) {
            const bucket = days[idx];
            if (bucket) bucket.items.push(a);
        }
    });
    return days.filter((g) => g.items.length > 0);
}

function formatRange(from: Date, to: Date) {
    const f = from.toDateString();
    const t = to.toDateString();
    if (f === t) return f;
    return `${f} → ${t}`;
}

function renderSchedule(s?: Announcement['scheduling']) {
    if (!s) return '-';
    const tzSuffix = s.timezone ? ` · ${s.timezone}` : '';
    if (s.scheduleType === 'RECURRING') {
        const cron = s.cronExpression ? `CRON ${s.cronExpression}` : 'Recurring';
        return `${cron}${tzSuffix}`;
    }
    if (s.scheduleType === 'ONE_TIME') {
        // Render as a range only when an endDate exists. Most one-time campaigns have no
        // endDate, so we surface just the start time + zone — cleaner than "<time> → - (UTC)".
        return s.endDate
            ? `${fmt(s.startDate)} → ${fmt(s.endDate)}${tzSuffix}`
            : `${fmt(s.startDate)}${tzSuffix}`;
    }
    return `Immediate${tzSuffix}`;
}

function fmt(v?: string) {
    return v ? new Date(v).toLocaleString() : '-';
}
function startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function endOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}
function addDays(d: Date, n: number) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}
function startOfMonth(d: Date) {
    const x = new Date(d);
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
    return x;
}
function endOfMonth(d: Date) {
    const x = new Date(d);
    x.setMonth(x.getMonth() + 1, 0);
    x.setHours(23, 59, 59, 999);
    return x;
}
function getMonthMeta(d: Date) {
    const start = startOfMonth(d);
    const end = endOfMonth(d);
    return { firstOfMonth: start, lastOfMonth: end };
}
function buildMonthCells(firstOfMonth: Date) {
    const lastOfMonth = endOfMonth(firstOfMonth);
    const leading = firstOfMonth.getDay();
    const cells: Array<Date | null> = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let x = new Date(firstOfMonth); x <= lastOfMonth; x = addDays(x, 1)) {
        cells.push(new Date(x));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
}
function isSameDay(a: Date, b: Date) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function formatMonthYear(d: Date) {
    try {
        return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    } catch {
        return `${d.getMonth() + 1}/${d.getFullYear()}`;
    }
}

function colorForAnnouncement(a: Announcement) {
    const mode = a.modes?.[0]?.modeType;
    switch (mode) {
        case 'SYSTEM_ALERT':
            return 'bg-red-500';
        case 'DASHBOARD_PIN':
            return 'bg-amber-500';
        case 'APP_OVERLAY':
            return 'bg-primary-500';
        case 'DM':
            return 'bg-blue-500';
        case 'STREAM':
            return 'bg-green-600';
        case 'RESOURCES':
            return 'bg-purple-600';
        case 'COMMUNITY':
            return 'bg-pink-600';
        case 'TASKS':
            return 'bg-teal-600';
        default:
            return 'bg-neutral-500';
    }
}
function bgForColor(c: string) {
    return c;
}
function atMidday(d: Date) {
    const x = new Date(d);
    x.setHours(12, 0, 0, 0);
    return x;
}
