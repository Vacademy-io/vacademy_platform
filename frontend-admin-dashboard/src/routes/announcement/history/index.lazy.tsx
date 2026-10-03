import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { createLazyFileRoute } from '@tanstack/react-router';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useMemo, useState } from 'react';
import {
    AnnouncementService,
    type ModeType,
    type MediumType,
    type AnnouncementRecipientRow,
} from '@/services/announcement';
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
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

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
    // Recipient-level rollup (all mediums)
    totalRecipients: number;
    deliveredCount: number;
    readCount: number;
    failedCount: number;
    deliveryRate: number;
    readRate: number;
    // APP_OVERLAY dismiss tracking (also covers other dismissible modes)
    dismissedCount?: number;
    dismissRate?: number;
    // Email-specific (driven by SES events)
    emailsSent: number;
    emailsSend: number; // count of SES `send` events — backend keeps it for parity, UI hides it
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

function statusLabel(t: TFunction, status?: string) {
    if (!status) return '-';
    return t(`status.${status}`, { defaultValue: status });
}

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
    const { t } = useTranslation('announcementHistoryIndex');
    const { setNavHeading } = useNavHeadingStore();
    const { toast } = useToast();
    const admin = isUserAdmin();

    useEffect(() => {
        setNavHeading(t('heading'));
    }, [setNavHeading, t]);

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
                toast({ title: t('toasts.statsLoadFailed'), variant: 'destructive' });
            }
        })();
    }, [statsFor, toast, t]);

    const onApprove = async (a: Announcement) => {
        try {
            await AnnouncementService.approve(a.id, 'ADMIN');
            toast({ title: t('toasts.approved') });
            refetch();
        } catch (e) {
            toast({ title: t('toasts.approveFailed'), variant: 'destructive' });
        }
    };
    const onReject = async () => {
        if (!rejectFor) return;
        try {
            await AnnouncementService.reject(rejectFor.id, 'ADMIN', rejectReason || '');
            toast({ title: t('toasts.rejected') });
            setRejectReason('');
            setRejectFor(null);
            refetch();
        } catch (e) {
            toast({ title: t('toasts.rejectFailed'), variant: 'destructive' });
        }
    };
    const onDeliverNow = async (a: Announcement) => {
        try {
            await AnnouncementService.deliver(a.id);
            toast({ title: t('toasts.deliveryTriggered') });
            refetch();
        } catch (e) {
            toast({ title: t('toasts.triggerFailed'), variant: 'destructive' });
        }
    };
    const onDelete = async (a: Announcement) => {
        try {
            await AnnouncementService.remove(a.id);
            toast({ title: t('toasts.deleted') });
            refetch();
        } catch (e) {
            toast({ title: t('toasts.deleteFailed'), variant: 'destructive' });
        }
    };

    const filtered = useMemo(() => announcements, [announcements]);

    return (
        <div className="p-4">
            <h2 className="mb-4 text-xl font-semibold">{t('heading')}</h2>
            <Tabs
                value={view}
                onValueChange={(v: string) => {
                    setView(v as 'all' | 'planned' | 'past');
                    setPage(0);
                }}
            >
                <TabsList>
                    <TabsTrigger value="all">{t('tabs.all')}</TabsTrigger>
                    <TabsTrigger value="planned">{t('tabs.planned')}</TabsTrigger>
                    <TabsTrigger value="past">{t('tabs.past')}</TabsTrigger>
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
                <div className="text-sm text-neutral-500">
                    {t('results', { count: filtered.length })}
                </div>
                <div className="flex items-center gap-2">
                    <Select
                        value={String(size)}
                        onValueChange={(v) => {
                            setSize(Number(v));
                            setPage(0);
                        }}
                    >
                        <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder={t('sizeLabel')} />
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
                            {t('prev')}
                        </Button>
                        <div className="text-sm">{t('page', { page: page + 1 })}</div>
                        <Button variant="secondary" onClick={() => setPage((p) => p + 1)}>
                            {t('next')}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('table.title')}</TableHead>
                            <TableHead>{t('table.status')}</TableHead>
                            <TableHead>{t('table.modes')}</TableHead>
                            <TableHead>{t('table.mediums')}</TableHead>
                            <TableHead>{t('table.schedule')}</TableHead>
                            <TableHead>{t('table.createdBy')}</TableHead>
                            <TableHead>{t('table.createdAt')}</TableHead>
                            <TableHead className="text-end">{t('table.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={8}>{t('table.loading')}</TableCell>
                            </TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8}>{t('table.empty')}</TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((a) => (
                                <TableRow key={a.id} className="align-top">
                                    <TableCell>
                                        <div className="font-medium">{a.title}</div>
                                        {a.recipients && a.recipients.length > 0 && (
                                            <div className="mt-1 text-xs text-neutral-500">
                                                {t('table.recipientsPrefix')}{' '}
                                                {a.recipients
                                                    .slice(0, 3)
                                                    .map((r) => r.recipientType)
                                                    .join(', ')}
                                                {a.recipients.length > 3
                                                    ? ` ${t('table.recipientsMore', { count: a.recipients.length - 3 })}`
                                                    : ''}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{statusLabel(t, a.status)}</Badge>
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
                                            {t('actions.view')}
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setStatsFor(a)}
                                        >
                                            {t('actions.stats')}
                                        </Button>
                                        {a.status === 'PENDING_APPROVAL' && admin && (
                                            <Button size="sm" onClick={() => onApprove(a)}>
                                                {t('actions.approve')}
                                            </Button>
                                        )}
                                        {a.status === 'PENDING_APPROVAL' && admin && (
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => setRejectFor(a)}
                                            >
                                                {t('actions.reject')}
                                            </Button>
                                        )}
                                        {(a.status === 'SCHEDULED' ||
                                            a.scheduling?.scheduleType === 'ONE_TIME') && (
                                                <Button size="sm" onClick={() => onDeliverNow(a)}>
                                                    {t('actions.deliverNow')}
                                                </Button>
                                            )}
                                        {admin && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onDelete(a)}
                                            >
                                                {t('actions.delete')}
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
                        <DialogTitle>{t('detailsDialog.title')}</DialogTitle>
                    </DialogHeader>
                    {details && (
                        <div className="grid gap-3">
                            <div>
                                <div className="text-lg font-medium">{details.title}</div>
                                <div className="text-xs text-neutral-500">
                                    {statusLabel(t, details.status)}
                                </div>
                            </div>
                            <div className="rounded border p-3">
                                <div className="mb-1 text-sm font-medium">
                                    {t('detailsDialog.content')}
                                </div>
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
                                    <div className="mb-1 text-sm font-medium">
                                        {t('detailsDialog.modes')}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {details.modes?.map((m, i) => (
                                            <Badge key={i}>{m.modeType}</Badge>
                                        ))}
                                    </div>
                                </div>
                                <div className="rounded border p-3">
                                    <div className="mb-1 text-sm font-medium">
                                        {t('detailsDialog.mediums')}
                                    </div>
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
                                    <div className="mb-1 text-sm font-medium">
                                        {t('detailsDialog.recipients')}
                                    </div>
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
                        <DialogTitle>{t('statsDialog.title')}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-2">
                        {stats ? (
                            <div className="space-y-4 pb-4">
                                {/* Delivery overview — the recipient-level rollup that applies to
                                    every medium (email + in-app + WhatsApp + push). */}
                                <div className="rounded-xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50/30 p-4 sm:p-6 shadow-sm">
                                    <div className="mb-3 sm:mb-4 flex items-center gap-2">
                                        <div className="h-1 w-6 sm:w-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-400"></div>
                                        <h4 className="text-base sm:text-lg font-semibold text-neutral-800">
                                            {t('statsDialog.overviewTitle')}
                                        </h4>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
                                        <StatTile
                                            label={t('statsDialog.tiles.recipients')}
                                            value={stats.totalRecipients}
                                        />
                                        <StatTile
                                            label={t('statsDialog.tiles.delivered')}
                                            value={stats.deliveredCount}
                                            sub={percent(stats.deliveryRate)}
                                            tone="success"
                                        />
                                        <StatTile
                                            label={t('statsDialog.tiles.read')}
                                            value={stats.readCount}
                                            sub={percent(stats.readRate)}
                                            tone="info"
                                        />
                                        <StatTile
                                            label={t('statsDialog.tiles.failed')}
                                            value={stats.failedCount}
                                            tone="danger"
                                        />
                                        <StatTile
                                            label={t('statsDialog.tiles.dismissed')}
                                            value={stats.dismissedCount}
                                            tone="muted"
                                        />
                                        <StatTile
                                            label={t('statsDialog.tiles.dismissRate')}
                                            value={percent(stats.dismissRate)}
                                            tone="muted"
                                        />
                                    </div>
                                </div>

                                {/* Email-specific SES event stats. Hidden when no email was
                                    actually sent for this announcement (non-email campaigns). */}
                                {stats.emailsSent > 0 ? (
                                    <div className="rounded-xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50/30 p-4 sm:p-6 shadow-sm">
                                        <div className="mb-3 sm:mb-4 flex items-center gap-2">
                                            <div className="h-1 w-6 sm:w-8 rounded-full bg-gradient-to-r from-purple-500 to-purple-400"></div>
                                            <h4 className="text-base sm:text-lg font-semibold text-neutral-800">
                                                {t('statsDialog.emailEventsTitle')}
                                            </h4>
                                            <span className="text-xs text-neutral-500">
                                                {t('statsDialog.viaSes')}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                            <StatTile
                                                label={t('statsDialog.emailTiles.emailsSent')}
                                                value={stats.emailsSent}
                                            />
                                            <StatTile
                                                label={t('statsDialog.emailTiles.delivered')}
                                                value={stats.emailsDelivered}
                                                sub={percent(stats.emailDeliveryRate)}
                                                tone="success"
                                            />
                                            <StatTile
                                                label={t('statsDialog.emailTiles.opened')}
                                                value={stats.emailsOpened}
                                                sub={percent(stats.emailOpenRate)}
                                                tone="info"
                                            />
                                            <StatTile
                                                label={t('statsDialog.emailTiles.clicked')}
                                                value={stats.emailsClicked}
                                                sub={percent(stats.emailClickRate)}
                                                tone="info"
                                            />
                                            <StatTile
                                                label={t('statsDialog.emailTiles.bounced')}
                                                value={stats.emailsBounced}
                                                sub={percent(stats.emailBounceRate)}
                                                tone="warning"
                                            />
                                            <StatTile
                                                label={t('statsDialog.emailTiles.rejected')}
                                                value={stats.emailsRejected}
                                                sub={percent(stats.emailRejectRate)}
                                                tone="danger"
                                            />
                                            <StatTile
                                                label={t('statsDialog.emailTiles.complained')}
                                                value={stats.emailsComplained}
                                                sub={percent(stats.emailComplaintRate)}
                                                tone="danger"
                                            />
                                            <StatTile
                                                label={t('statsDialog.emailTiles.awaitingEvents')}
                                                value={stats.emailsPending}
                                                tone="muted"
                                            />
                                        </div>
                                        {stats.emailsDelivered === 0 &&
                                            stats.emailsBounced === 0 &&
                                            stats.emailsRejected === 0 &&
                                            stats.emailsPending > 0 && (
                                                <p className="mt-3 text-xs text-neutral-500">
                                                    {t('statsDialog.pendingNote')}
                                                </p>
                                            )}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
                                        {t('statsDialog.noEmails')}
                                    </div>
                                )}

                                {/* Per-recipient delivery/read/dismiss breakdown */}
                                {statsFor && (
                                    <RecipientsSection
                                        key={statsFor.id}
                                        announcementId={statsFor.id}
                                    />
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center py-8">
                                <div className="flex items-center gap-2 text-sm text-neutral-500">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600"></div>
                                    {t('statsDialog.loading')}
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!rejectFor} onOpenChange={(open) => !open && setRejectFor(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('rejectDialog.title')}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-2">
                        <Textarea
                            placeholder={t('rejectDialog.reasonPlaceholder')}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setRejectFor(null)}>
                                {t('rejectDialog.cancel')}
                            </Button>
                            <Button variant="destructive" onClick={onReject}>
                                {t('rejectDialog.reject')}
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
    const { t } = useTranslation('announcementHistoryIndex');
    return (
        <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="w-64">
                <label className="mb-1 block text-xs text-neutral-600">
                    {t('toolbar.searchLabel')}
                </label>
                <Input
                    placeholder={t('toolbar.searchPlaceholder')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            {setStatus !== (undefined as never) && (
                <div className="w-56">
                    <label className="mb-1 block text-xs text-neutral-600">
                        {t('toolbar.statusLabel')}
                    </label>
                    <Select
                        value={status ?? 'ALL'}
                        onValueChange={(v) => setStatus(v === 'ALL' ? undefined : v)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={t('toolbar.statusAll')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">{t('toolbar.statusAll')}</SelectItem>
                            {allStatuses.map((s) => (
                                <SelectItem key={s} value={s}>
                                    {statusLabel(t, s)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
            {showDate && (
                <>
                    <div>
                        <label className="mb-1 block text-xs text-neutral-600">
                            {t('toolbar.fromLabel')}
                        </label>
                        <Input
                            type="datetime-local"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-neutral-600">
                            {t('toolbar.toLabel')}
                        </label>
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
    const { t } = useTranslation('announcementHistoryIndex');
    if (!scheduling || !scheduling.scheduleType) return <div>{t('schedule.none')}</div>;
    if (scheduling.scheduleType === 'IMMEDIATE') return <div>{t('schedule.immediate')}</div>;
    if (scheduling.scheduleType === 'ONE_TIME')
        return (
            <div className="text-xs">
                <div>{t('schedule.oneTime')}</div>
                <div>
                    {formatDateTime(scheduling.startDate)} → {formatDateTime(scheduling.endDate)}
                </div>
            </div>
        );
    return (
        <div className="text-xs">
            <div>{t('schedule.recurring')}</div>
            <div>{t('schedule.cron', { expr: scheduling.cronExpression || '-' })}</div>
        </div>
    );
}

// Paginated per-recipient list inside the stats dialog. Reads the
// GET /announcements/{id}/recipients Spring Page endpoint 10 rows at a time.
function RecipientsSection({ announcementId }: { announcementId: string }) {
    const { t } = useTranslation('announcementHistoryIndex');
    const [rows, setRows] = useState<AnnouncementRecipientRow[]>([]);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const pageSize = 10;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await AnnouncementService.recipients(announcementId, {
                    page,
                    size: pageSize,
                });
                if (cancelled) return;
                setRows(data?.content ?? []);
                setTotalPages(data?.totalPages ?? 0);
            } catch (e) {
                if (cancelled) return;
                setError(t('statsDialog.recipientsSection.loadFailed'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [announcementId, page, t]);

    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-3 flex items-center gap-2 sm:mb-4">
                <div className="h-1 w-6 rounded-full bg-gradient-to-r from-green-500 to-green-400 sm:w-8"></div>
                <h4 className="text-base font-semibold text-neutral-800 sm:text-lg">
                    {t('statsDialog.recipientsSection.title')}
                </h4>
            </div>
            {error ? (
                <div className="rounded border border-dashed border-neutral-200 p-6 text-center text-sm text-danger-600">
                    {error}
                </div>
            ) : loading ? (
                <div className="flex items-center justify-center py-6">
                    <div className="flex items-center gap-2 text-sm text-neutral-500">
                        <div className="size-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600"></div>
                        {t('statsDialog.recipientsSection.loading')}
                    </div>
                </div>
            ) : rows.length === 0 ? (
                <div className="rounded border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
                    {t('statsDialog.recipientsSection.empty')}
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('statsDialog.recipientsSection.table.name')}</TableHead>
                                <TableHead>{t('statsDialog.recipientsSection.table.mode')}</TableHead>
                                <TableHead>{t('statsDialog.recipientsSection.table.status')}</TableHead>
                                <TableHead>{t('statsDialog.recipientsSection.table.seenAt')}</TableHead>
                                <TableHead>
                                    {t('statsDialog.recipientsSection.table.dismissedAt')}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((r) => (
                                <TableRow key={r.recipientMessageId}>
                                    <TableCell>{r.userName || r.userId || '-'}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{r.modeType}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{statusLabel(t, r.status)}</Badge>
                                    </TableCell>
                                    <TableCell>{formatDateTime(r.readAt ?? undefined)}</TableCell>
                                    <TableCell>
                                        {formatDateTime(r.dismissedAt ?? undefined)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
            {!error && totalPages > 1 && (
                <div className="mt-3 flex items-center justify-end gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={loading || page === 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                        {t('prev')}
                    </Button>
                    <div className="text-sm text-neutral-600">
                        {t('statsDialog.recipientsSection.pagePagination', {
                            page: page + 1,
                            totalPages,
                        })}
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={loading || page + 1 >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        {t('next')}
                    </Button>
                </div>
            )}
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

type StatTone = 'success' | 'info' | 'warning' | 'danger' | 'muted' | 'neutral';

function StatTile({
    label,
    value,
    sub,
    tone = 'neutral',
}: {
    label: string;
    value: number | string | undefined;
    sub?: string;
    tone?: StatTone;
}) {
    const valueTone: Record<StatTone, string> = {
        success: 'text-green-600',
        info: 'text-blue-600',
        warning: 'text-orange-600',
        danger: 'text-red-600',
        muted: 'text-neutral-500',
        neutral: 'text-neutral-900',
    };
    const subTone: Record<StatTone, string> = {
        success: 'text-green-500',
        info: 'text-blue-500',
        warning: 'text-orange-500',
        danger: 'text-red-500',
        muted: 'text-neutral-400',
        neutral: 'text-neutral-500',
    };
    const display = value === undefined || value === null ? '-' : value;
    return (
        <div className="group rounded-lg border border-neutral-100 bg-white p-3 sm:p-4 transition-all duration-200 hover:shadow-md">
            <p className="text-xs sm:text-sm font-medium text-neutral-600">{label}</p>
            <p className={`text-xl sm:text-2xl font-bold ${valueTone[tone]}`}>{display}</p>
            {sub && <p className={`text-xs font-medium ${subTone[tone]}`}>{sub}</p>}
        </div>
    );
}
