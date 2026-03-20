import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { createLazyFileRoute } from '@tanstack/react-router';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useMemo, useState } from 'react';
import { AnnouncementService, type ModeType, type MediumType } from '@/services/announcement';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { isUserAdmin } from '@/utils/userDetails';

type Announcement = {
    id: string;
    title: string;
    content?: { id?: string; type?: string; content?: string };
    instituteId: string;
    createdBy?: string;
    createdByName?: string;
    createdByRole?: string;
    status?: string;
    timezone?: string;
    createdAt?: string;
    updatedAt?: string;
    recipients?: Array<{
        id?: string;
        recipientType?: string;
        recipientId?: string;
        recipientName?: string;
    }>;
    modes?: Array<{
        id?: string;
        modeType: ModeType;
        settings?: Record<string, unknown>;
        isActive?: boolean;
    }>;
    mediums?: Array<{
        id?: string;
        mediumType: MediumType;
        config?: Record<string, unknown>;
        isActive?: boolean;
    }>;
    scheduling?: {
        id?: string;
        scheduleType?: 'IMMEDIATE' | 'ONE_TIME' | 'RECURRING';
        cronExpression?: string;
        timezone?: string;
        startDate?: string;
        endDate?: string;
        nextRunTime?: string;
        lastRunTime?: string;
        isActive?: boolean;
    };
};

type AnnouncementStats = {
    totalRecipients: number;
    deliveredCount: number;
    readCount: number;
    failedCount: number;
    deliveryRate: number;
    readRate: number;
    emailsSent: number;
    emailsSend: number;
    emailsDelivered: number;
    emailsOpened: number;
    emailsClicked: number;
    emailsBounced: number;
    emailsRejected: number;
    emailsComplained: number;
    emailsPending: number;
    emailDeliveryRate: number;
    emailOpenRate: number;
    emailClickRate: number;
    emailBounceRate: number;
    emailRejectRate: number;
    emailComplaintRate: number;
};

export const Route = createLazyFileRoute('/announcement/history/')({
    component: () => (
        <LayoutContainer>
            <AnnouncementHistoryPage />
        </LayoutContainer>
    ),
});

const allStatuses = [
    'DRAFT',
    'PENDING_APPROVAL',
    'REJECTED',
    'SCHEDULED',
    'ACTIVE',
    'INACTIVE',
    'DELIVERED',
    'CANCELLED',
];

function useAnnouncements(
    view: 'all' | 'planned' | 'past',
    params: {
        page: number;
        size: number;
        search: string;
        status?: string;
        from?: string;
        to?: string;
    }
) {
    const { page, size, search, status, from, to } = params;
    return useQuery({
        queryKey: ['announcements', view, page, size, search, status, from, to],
        queryFn: async (): Promise<Announcement[]> => {
            if (view === 'planned') {
                const data = await AnnouncementService.planned({ page, size, from, to });
                return Array.isArray(data) ? data : data?.content ?? [];
            }
            if (view === 'past') {
                const data = await AnnouncementService.past({ page, size, from, to });
                return Array.isArray(data) ? data : data?.content ?? [];
            }
            const data = await AnnouncementService.listByInstitute({ page, size, status });
            const list = Array.isArray(data) ? data : data?.content ?? [];
            if (!search) return list;
            return list.filter((a: Announcement) =>
                a.title?.toLowerCase().includes(search.toLowerCase())
            );
        },
        refetchOnWindowFocus: false,
    });
}

function AnnouncementHistoryPage() {
    const { setNavHeading } = useNavHeadingStore();
    const { toast } = useToast();
    const admin = isUserAdmin();

    useEffect(() => {
        setNavHeading('Announcement History');
    }, [setNavHeading]);

    const [view, setView] = useState<'all' | 'planned' | 'past'>('all');
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(10);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<string | undefined>(undefined);
    const [from, setFrom] = useState<string>('');
    const [to, setTo] = useState<string>('');

    const {
        data: announcements = [],
        isLoading,
        refetch,
    } = useAnnouncements(view, {
        page,
        size,
        search,
        status,
        from: from || undefined,
        to: to || undefined,
    });

    const [details, setDetails] = useState<Announcement | null>(null);
    const [statsFor, setStatsFor] = useState<Announcement | null>(null);
    const [stats, setStats] = useState<AnnouncementStats | null>(null);
    const [rejectFor, setRejectFor] = useState<Announcement | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    useEffect(() => {
        if (!statsFor) {
            setStats(null);
            return;
        }
        (async () => {
            try {
                const s = await AnnouncementService.stats(statsFor.id);
                setStats(s);
            } catch (e) {
                toast({ title: 'Failed to load stats', variant: 'destructive' });
            }
        })();
    }, [statsFor, toast]);

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
    const onDeliverNow = async (a: Announcement) => {
        try {
            await AnnouncementService.deliver(a.id);
            toast({ title: 'Delivery triggered' });
            refetch();
        } catch (e) {
            toast({ title: 'Trigger failed', variant: 'destructive' });
        }
    };
    const onDelete = async (a: Announcement) => {
        try {
            await AnnouncementService.remove(a.id);
            toast({ title: 'Deleted' });
            refetch();
        } catch (e) {
            toast({ title: 'Delete failed', variant: 'destructive' });
        }
    };

    const filtered = useMemo(() => announcements, [announcements]);

    return (
        <div className="p-4">
            <h2 className="mb-4 text-xl font-semibold">Announcement History</h2>
            <Tabs
                value={view}
                onValueChange={(v: string) => {
                    setView(v as 'all' | 'planned' | 'past');
                    setPage(0);
                }}
            >
                <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="planned">Planned</TabsTrigger>
                    <TabsTrigger value="past">Past</TabsTrigger>
                </TabsList>
                <TabsContent value="all">
                    <Toolbar
                        search={search}
                        setSearch={setSearch}
                        status={status}
                        setStatus={setStatus}
                        showDate={false}
                        from={from}
                        to={to}
                        setFrom={setFrom}
                        setTo={setTo}
                    />
                </TabsContent>
                <TabsContent value="planned">
                    <Toolbar
                        search={search}
                        setSearch={setSearch}
                        status={undefined}
                        setStatus={() => { }}
                        showDate={true}
                        from={from}
                        to={to}
                        setFrom={setFrom}
                        setTo={setTo}
                    />
                </TabsContent>
                <TabsContent value="past">
                    <Toolbar
                        search={search}
                        setSearch={setSearch}
                        status={undefined}
                        setStatus={() => { }}
                        showDate={true}
                        from={from}
                        to={to}
                        setFrom={setFrom}
                        setTo={setTo}
                    />
                </TabsContent>
            </Tabs>
            <Separator className="my-4" />

            <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm text-neutral-500">{filtered.length} results</div>
                <div className="flex items-center gap-2">
                    <Select
                        value={String(size)}
                        onValueChange={(v) => {
                            setSize(Number(v));
                            setPage(0);
                        }}
                    >
                        <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder="Size" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            disabled={page === 0}
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                        >
                            Prev
                        </Button>
                        <div className="text-sm">Page {page + 1}</div>
                        <Button variant="secondary" onClick={() => setPage((p) => p + 1)}>
                            Next
                        </Button>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Modes</TableHead>
                            <TableHead>Mediums</TableHead>
                            <TableHead>Schedule</TableHead>
                            <TableHead>Created By</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={8}>Loading…</TableCell>
                            </TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8}>No announcements</TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((a) => (
                                <TableRow key={a.id} className="align-top">
                                    <TableCell>
                                        <div className="font-medium">{a.title}</div>
                                        {a.recipients && a.recipients.length > 0 && (
                                            <div className="mt-1 text-xs text-neutral-500">
                                                Recipients:{' '}
                                                {a.recipients
                                                    .slice(0, 3)
                                                    .map((r) => r.recipientType)
                                                    .join(', ')}
                                                {a.recipients.length > 3
                                                    ? ` +${a.recipients.length - 3}`
                                                    : ''}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{a.status || '-'}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex max-w-[220px] flex-wrap gap-1">
                                            {a.modes?.map((m, i) => (
                                                <Badge key={i} variant="secondary">
                                                    {m.modeType}
                                                </Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex max-w-[220px] flex-wrap gap-1">
                                            {a.mediums?.map((m, i) => (
                                                <Badge key={i} variant="outline">
                                                    {m.mediumType}
                                                </Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <ScheduleCell scheduling={a.scheduling} />
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">
                                            {a.createdByName || a.createdBy || '-'}
                                        </div>
                                        {a.createdByRole && (
                                            <div className="text-xs text-neutral-500">
                                                {a.createdByRole}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>{formatDateTime(a.createdAt)}</TableCell>
                                    <TableCell className="space-x-2 text-right">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setDetails(a)}
                                        >
                                            View
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setStatsFor(a)}
                                        >
                                            Stats
                                        </Button>
                                        {a.status === 'PENDING_APPROVAL' && admin && (
                                            <Button size="sm" onClick={() => onApprove(a)}>
                                                Approve
                                            </Button>
                                        )}
                                        {a.status === 'PENDING_APPROVAL' && admin && (
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => setRejectFor(a)}
                                            >
                                                Reject
                                            </Button>
                                        )}
                                        {(a.status === 'SCHEDULED' ||
                                            a.scheduling?.scheduleType === 'ONE_TIME') && (
                                                <Button size="sm" onClick={() => onDeliverNow(a)}>
                                                    Deliver now
                                                </Button>
                                            )}
                                        {admin && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onDelete(a)}
                                            >
                                                Delete
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={!!details} onOpenChange={(open) => !open && setDetails(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Announcement Details</DialogTitle>
                    </DialogHeader>
                    {details && (
                        <div className="grid gap-3">
                            <div>
                                <div className="text-lg font-medium">{details.title}</div>
                                <div className="text-xs text-neutral-500">{details.status}</div>
                            </div>
                            <div className="rounded border p-3">
                                <div className="mb-1 text-sm font-medium">Content</div>
                                <div
                                    className="prose max-h-64 overflow-auto text-sm"
                                    dangerouslySetInnerHTML={{
                                        __html:
                                            details.content?.type === 'html'
                                                ? details.content?.content || ''
                                                : '',
                                    }}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded border p-3">
                                    <div className="mb-1 text-sm font-medium">Modes</div>
                                    <div className="flex flex-wrap gap-1">
                                        {details.modes?.map((m, i) => (
                                            <Badge key={i}>{m.modeType}</Badge>
                                        ))}
                                    </div>
                                </div>
                                <div className="rounded border p-3">
                                    <div className="mb-1 text-sm font-medium">Mediums</div>
                                    <div className="flex flex-wrap gap-1">
                                        {details.mediums?.map((m, i) => (
                                            <Badge key={i} variant="secondary">
                                                {m.mediumType}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {details.recipients && (
                                <div className="rounded border p-3">
                                    <div className="mb-1 text-sm font-medium">Recipients</div>
                                    <div className="text-sm">
                                        {details.recipients.map((r, i) => (
                                            <div key={i}>
                                                {r.recipientType} {r.recipientName || r.recipientId}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={!!statsFor} onOpenChange={(open) => !open && setStatsFor(null)}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader className="flex-shrink-0">
                        <DialogTitle>Delivery Stats</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-2">
                        {stats ? (
                            <div className="space-y-4 pb-4">
                                {/* Email Stats */}
                                <div className="rounded-xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50/30 p-4 sm:p-6 shadow-sm">
                                    <div className="mb-3 sm:mb-4 flex items-center gap-2">
                                        <div className="h-1 w-6 sm:w-8 rounded-full bg-gradient-to-r from-purple-500 to-purple-400"></div>
                                        <h4 className="text-base sm:text-lg font-semibold text-neutral-800">Email Statistics</h4>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        <div className="group rounded-lg border border-neutral-100 bg-white p-3 sm:p-4 transition-all duration-200 hover:shadow-md">
                                            <div>
                                                <p className="text-xs sm:text-sm font-medium text-neutral-600">Emails Sent</p>
                                                <p className="text-xl sm:text-2xl font-bold text-neutral-900">{stats.emailsSent}</p>
                                            </div>
                                        </div>

                                        <div className="group rounded-lg border border-neutral-100 bg-white p-3 sm:p-4 transition-all duration-200 hover:shadow-md">
                                            <div>
                                                <p className="text-xs sm:text-sm font-medium text-neutral-600">Emails Delivered</p>
                                                <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.emailsDelivered}</p>
                                                <p className="text-xs text-green-500 font-medium">{percent(stats.emailDeliveryRate)}</p>
                                            </div>
                                        </div>

                                        <div className="group rounded-lg border border-neutral-100 bg-white p-3 sm:p-4 transition-all duration-200 hover:shadow-md">
                                            <div>
                                                <p className="text-xs sm:text-sm font-medium text-neutral-600">Emails Opened</p>
                                                <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats.emailsOpened}</p>
                                                <p className="text-xs text-blue-500 font-medium">{percent(stats.emailOpenRate)}</p>
                                            </div>
                                        </div>

                                        <div className="group rounded-lg border border-neutral-100 bg-white p-3 sm:p-4 transition-all duration-200 hover:shadow-md">
                                            <div>
                                                <p className="text-xs sm:text-sm font-medium text-neutral-600">Emails Clicked</p>
                                                <p className="text-xl sm:text-2xl font-bold text-purple-600">{stats.emailsClicked}</p>
                                                <p className="text-xs text-purple-500 font-medium">{percent(stats.emailClickRate)}</p>
                                            </div>
                                        </div>

                                        <div className="group rounded-lg border border-neutral-100 bg-white p-3 sm:p-4 transition-all duration-200 hover:shadow-md">
                                            <div>
                                                <p className="text-xs sm:text-sm font-medium text-neutral-600">Emails Bounced</p>
                                                <p className="text-xl sm:text-2xl font-bold text-orange-600">{stats.emailsBounced}</p>
                                                <p className="text-xs text-orange-500 font-medium">{percent(stats.emailBounceRate)}</p>
                                            </div>
                                        </div>

                                        <div className="group rounded-lg border border-neutral-100 bg-white p-3 sm:p-4 transition-all duration-200 hover:shadow-md">
                                            <div>
                                                <p className="text-xs sm:text-sm font-medium text-neutral-600">Emails Rejected</p>
                                                <p className="text-xl sm:text-2xl font-bold text-red-600">{stats.emailsRejected}</p>
                                                <p className="text-xs text-red-500 font-medium">{percent(stats.emailRejectRate)}</p>
                                            </div>
                                        </div>

                                        <div className="group rounded-lg border border-neutral-100 bg-white p-3 sm:p-4 transition-all duration-200 hover:shadow-md">
                                            <div>
                                                <p className="text-xs sm:text-sm font-medium text-neutral-600">Emails Complained</p>
                                                <p className="text-xl sm:text-2xl font-bold text-red-600">{stats.emailsComplained}</p>
                                                <p className="text-xs text-red-500 font-medium">{percent(stats.emailComplaintRate)}</p>
                                            </div>
                                        </div>

                                        <div className="group rounded-lg border border-neutral-100 bg-white p-3 sm:p-4 transition-all duration-200 hover:shadow-md">
                                            <div>
                                                <p className="text-xs sm:text-sm font-medium text-neutral-600">Emails Pending</p>
                                                <p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.emailsPending}</p>
                                            </div>
                                        </div>

                                        <div className="group rounded-lg border border-neutral-100 bg-white p-3 sm:p-4 transition-all duration-200 hover:shadow-md">
                                            <div>
                                                <p className="text-xs sm:text-sm font-medium text-neutral-600">Emails Send</p>
                                                <p className="text-xl sm:text-2xl font-bold text-neutral-900">{stats.emailsSend}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center py-8">
                                <div className="flex items-center gap-2 text-sm text-neutral-500">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600"></div>
                                    Loading statistics...
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

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

function Toolbar(props: {
    search: string;
    setSearch: (v: string) => void;
    status: string | undefined;
    setStatus: (v: string | undefined) => void;
    showDate: boolean;
    from: string;
    to: string;
    setFrom: (v: string) => void;
    setTo: (v: string) => void;
}) {
    const { search, setSearch, status, setStatus, showDate, from, to, setFrom, setTo } = props;
    return (
        <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="w-64">
                <label className="mb-1 block text-xs text-neutral-600">Search title</label>
                <Input
                    placeholder="Search…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            {setStatus !== (undefined as never) && (
                <div className="w-56">
                    <label className="mb-1 block text-xs text-neutral-600">Status</label>
                    <Select
                        value={status ?? 'ALL'}
                        onValueChange={(v) => setStatus(v === 'ALL' ? undefined : v)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All</SelectItem>
                            {allStatuses.map((s) => (
                                <SelectItem key={s} value={s}>
                                    {s}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
            {showDate && (
                <>
                    <div>
                        <label className="mb-1 block text-xs text-neutral-600">From</label>
                        <Input
                            type="datetime-local"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-neutral-600">To</label>
                        <Input
                            type="datetime-local"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                        />
                    </div>
                </>
            )}
        </div>
    );
}

function ScheduleCell({ scheduling }: { scheduling: Announcement['scheduling'] }) {
    if (!scheduling || !scheduling.scheduleType) return <div>-</div>;
    if (scheduling.scheduleType === 'IMMEDIATE') return <div>Immediate</div>;
    if (scheduling.scheduleType === 'ONE_TIME')
        return (
            <div className="text-xs">
                <div>One-time</div>
                <div>
                    {formatDateTime(scheduling.startDate)} → {formatDateTime(scheduling.endDate)}
                </div>
            </div>
        );
    return (
        <div className="text-xs">
            <div>Recurring</div>
            <div>CRON: {scheduling.cronExpression || '-'}</div>
        </div>
    );
}

function formatDateTime(v?: string) {
    if (!v) return '-';
    try {
        return new Date(v).toLocaleString();
    } catch {
        return v;
    }
}

function percent(n?: number) {
    if (typeof n !== 'number') return '-';
    return `${n.toFixed(2)}%`;
}
