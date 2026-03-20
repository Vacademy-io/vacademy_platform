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
            const list: Announcement[] = Array.isArray(res) ? res : res?.content ?? [];
            if (modeFilter === 'ALL') return list;
            return list.filter((a) => a.modes?.some((m) => m.modeType === modeFilter));
        },
        refetchOnWindowFocus: false,
    });

    // Approvals
    const [rejectFor, setRejectFor] = useState<Announcement | null>(null);
    const [rejectReason, setRejectReason] = useState('');

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
    admin: boolean;
    loading: boolean;
}) {
    const { start, end, grouped, onCreate, onApprove, onReject, admin, loading } = props;
    return (
        <div className="grid gap-4">
            <div className="text-sm text-neutral-600">Showing {formatRange(start, end)}</div>
            {loading ? (
                <div className="text-sm">Loading…</div>
            ) : grouped.length === 0 ? (
                <div className="text-sm">No scheduled announcements</div>
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
    admin,
}: {
    a: Announcement;
    onApprove: (a: Announcement) => void;
    onReject: (a: Announcement) => void;
    admin: boolean;
}) {
    const color = colorForAnnouncement(a);
    return (
        <div className="flex items-start justify-between gap-3 rounded border p-2">
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <span className={`inline-block size-2 rounded-full ${color}`} />
                    <div className="font-medium">{a.title}</div>
                </div>
                <div className="mt-1 text-xs text-neutral-600">
                    {a.modes?.map((m, i) => (
                        <Badge key={i} variant="outline" className="mr-1">
                            {m.modeType}
                        </Badge>
                    ))}
                </div>
                <div className="mt-1 text-xs text-neutral-500">{renderSchedule(a.scheduling)}</div>
            </div>
            <div className="flex items-center gap-2">
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
    if (s.scheduleType === 'RECURRING')
        return `CRON ${s.cronExpression || ''} (${s.timezone || ''})`;
    if (s.scheduleType === 'ONE_TIME')
        return `${fmt(s.startDate)} → ${fmt(s.endDate)} (${s.timezone || ''})`;
    return 'Immediate';
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
