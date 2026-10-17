import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
    CheckCircle,
    DotsThreeVertical,
    MagnifyingGlass,
    Megaphone,
    PaperPlaneRight,
    Plus,
    Trash,
    XCircle,
} from '@phosphor-icons/react';
import { AnnouncementService } from '@/services/announcement';
import { MyButton } from '@/components/design-system/button';
import { MyTable } from '@/components/design-system/table';
import { MyPagination } from '@/components/design-system/pagination';
import { MyDialog } from '@/components/design-system/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { isUserAdmin } from '@/utils/userDetails';
import { useTranslation } from 'react-i18next';
import {
    fromCalendarItem,
    toHistoryPage,
    type Announcement,
    type HistoryPage,
    type HistoryView,
} from './-types';
import { humanize, utcParts } from './-utils/format';
import { useDescribeRecipient, useUserNames } from './-hooks/useRecipientNames';
import {
    AnnouncementStatusChip,
    DateTimeStack,
    EnumChips,
    ScheduleSummary,
} from './-components/primitives';
import { AnnouncementDetailsDialog } from './-components/AnnouncementDetailsDialog';
import { DeliveryStatsDialog } from './-components/DeliveryStatsDialog';

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

// How many recipient names the title cell previews before "+N more".
const PREVIEW_RECIPIENTS = 3;

function useAnnouncements(
    view: HistoryView,
    params: { page: number; size: number; status?: string; from?: string; to?: string }
) {
    const { page, size, status, from, to } = params;
    return useQuery({
        queryKey: ['announcements', view, page, size, status, from, to],
        queryFn: async (): Promise<HistoryPage> => {
            if (view === 'planned') {
                return toHistoryPage(
                    await AnnouncementService.planned({ page, size, from, to }),
                    fromCalendarItem
                );
            }
            if (view === 'past') {
                return toHistoryPage(
                    await AnnouncementService.past({ page, size, from, to }),
                    fromCalendarItem
                );
            }
            return toHistoryPage(
                await AnnouncementService.listByInstitute({ page, size, status }),
                (a: Announcement) => a
            );
        },
        refetchOnWindowFocus: false,
        placeholderData: (prev) => prev,
    });
}

function AnnouncementHistoryPage() {
    const { t } = useTranslation('announcementHistoryIndex');
    const { setNavHeading } = useNavHeadingStore();
    const { toast } = useToast();
    const navigate = useNavigate();
    const admin = isUserAdmin();

    useEffect(() => {
        setNavHeading(t('heading'));
    }, [setNavHeading, t]);

    const [view, setView] = useState<HistoryView>('all');
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(10);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<string | undefined>(undefined);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    const { data, isLoading, isError, error, refetch } = useAnnouncements(view, {
        page,
        size,
        status: view === 'all' ? status : undefined,
        from: view !== 'all' ? from || undefined : undefined,
        to: view !== 'all' ? to || undefined : undefined,
    });

    const [details, setDetails] = useState<Announcement | null>(null);
    const [statsFor, setStatsFor] = useState<Announcement | null>(null);
    const [rejectFor, setRejectFor] = useState<Announcement | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [deleteFor, setDeleteFor] = useState<Announcement | null>(null);

    // The list API has no title search, so it filters the loaded page.
    const rows = useMemo(() => {
        const list = data?.content ?? [];
        const q = search.trim().toLowerCase();
        return q ? list.filter((a) => a.title?.toLowerCase().includes(q)) : list;
    }, [data, search]);

    const previewUserIds = useMemo(
        () =>
            rows.flatMap((a) =>
                (a.recipients ?? [])
                    .slice(0, PREVIEW_RECIPIENTS)
                    .filter((r) => r.recipientType === 'USER')
                    .map((r) => r.recipientId)
            ),
        [rows]
    );
    const { names } = useUserNames(previewUserIds);
    const describe = useDescribeRecipient(names);

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
    const onDelete = async () => {
        if (!deleteFor) return;
        try {
            await AnnouncementService.remove(deleteFor.id);
            toast({ title: t('toasts.deleted') });
            setDeleteFor(null);
            refetch();
        } catch (e) {
            toast({ title: t('toasts.deleteFailed'), variant: 'destructive' });
        }
    };

    const columns = useMemo<ColumnDef<Announcement>[]>(
        () => [
            {
                id: 'title',
                header: t('table.title'),
                size: 280,
                cell: ({ row }) => {
                    const a = row.original;
                    const recipients = a.recipients ?? [];
                    const preview = recipients
                        .slice(0, PREVIEW_RECIPIENTS)
                        .map((r) => describe(r).name);
                    const more = recipients.length - preview.length;
                    return (
                        <div className="min-w-0">
                            <button
                                type="button"
                                onClick={() => setDetails(a)}
                                className="truncate text-left text-body font-semibold text-neutral-900 hover:text-primary-600"
                            >
                                {a.title}
                            </button>
                            {preview.length > 0 && (
                                <div className="mt-1 truncate text-caption text-neutral-500">
                                    {t('table.recipientsPrefix')} {preview.join(', ')}
                                    {more > 0 && ` ${t('table.recipientsMore', { count: more })}`}
                                </div>
                            )}
                        </div>
                    );
                },
            },
            {
                id: 'status',
                header: t('table.status'),
                size: 130,
                cell: ({ row }) => <AnnouncementStatusChip status={row.original.status} />,
            },
            {
                id: 'channels',
                header: t('table.channels'),
                size: 190,
                cell: ({ row }) => {
                    const modes = (row.original.modes ?? []).map((m) => m.modeType);
                    const mediums = (row.original.mediums ?? []).map((m) => m.mediumType);
                    return (
                        <div className="flex flex-col gap-1">
                            <EnumChips group="modes" values={modes} />
                            {mediums.length > 0 && (
                                <EnumChips group="mediums" variant="outline" values={mediums} />
                            )}
                        </div>
                    );
                },
            },
            {
                id: 'schedule',
                header: t('table.schedule'),
                size: 160,
                cell: ({ row }) => (
                    <div className="text-body text-neutral-700">
                        <ScheduleSummary scheduling={row.original.scheduling} />
                    </div>
                ),
            },
            {
                id: 'createdBy',
                header: t('table.createdBy'),
                size: 160,
                cell: ({ row }) => {
                    const a = row.original;
                    return (
                        <div className="min-w-0">
                            <div className="truncate text-body text-neutral-800">
                                {a.createdByName || t('detailsDialog.system')}
                            </div>
                            {a.createdByRole && (
                                <div className="text-caption text-neutral-500">
                                    {t(`roles.${a.createdByRole}`, {
                                        defaultValue: humanize(a.createdByRole),
                                    })}
                                </div>
                            )}
                        </div>
                    );
                },
            },
            {
                id: 'createdAt',
                header: t('table.createdAt'),
                size: 130,
                cell: ({ row }) => <DateTimeStack parts={utcParts(row.original.createdAt)} />,
            },
            {
                id: 'actions',
                header: t('table.actions'),
                size: 190,
                cell: ({ row }) => {
                    const a = row.original;
                    const canReview = a.status === 'PENDING_APPROVAL' && admin;
                    const canDeliver =
                        a.status === 'SCHEDULED' || a.scheduling?.scheduleType === 'ONE_TIME';
                    const hasMenu = canReview || canDeliver || admin;
                    return (
                        <div className="flex items-center gap-2">
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={() => setDetails(a)}
                            >
                                {t('actions.view')}
                            </MyButton>
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={() => setStatsFor(a)}
                            >
                                {t('actions.stats')}
                            </MyButton>
                            {hasMenu && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <MyButton
                                            buttonType="text"
                                            scale="small"
                                            layoutVariant="icon"
                                            aria-label={t('actions.more')}
                                        >
                                            <DotsThreeVertical
                                                className="size-4 text-neutral-600"
                                                weight="bold"
                                            />
                                        </MyButton>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {canReview && (
                                            <DropdownMenuItem onClick={() => onApprove(a)}>
                                                <CheckCircle className="mr-2 size-4 text-success-600" />
                                                {t('actions.approve')}
                                            </DropdownMenuItem>
                                        )}
                                        {canReview && (
                                            <DropdownMenuItem onClick={() => setRejectFor(a)}>
                                                <XCircle className="mr-2 size-4 text-danger-600" />
                                                {t('actions.reject')}
                                            </DropdownMenuItem>
                                        )}
                                        {canDeliver && (
                                            <DropdownMenuItem onClick={() => onDeliverNow(a)}>
                                                <PaperPlaneRight className="mr-2 size-4" />
                                                {t('actions.deliverNow')}
                                            </DropdownMenuItem>
                                        )}
                                        {admin && (canReview || canDeliver) && (
                                            <DropdownMenuSeparator />
                                        )}
                                        {admin && (
                                            <DropdownMenuItem
                                                onClick={() => setDeleteFor(a)}
                                                className="text-danger-600 focus:text-danger-600"
                                            >
                                                <Trash className="mr-2 size-4" />
                                                {t('actions.delete')}
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    );
                },
            },
        ],
        // onApprove/onDeliverNow only close over stable setters + refetch
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [t, admin, describe]
    );

    const totalPages = data?.totalPages ?? 0;
    const totalElements = data?.totalElements ?? 0;
    const tableData = {
        content: rows,
        total_pages: totalPages,
        page_no: page,
        page_size: size,
        total_elements: totalElements,
        last: page + 1 >= totalPages,
    };

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-h2-semibold text-neutral-900">{t('heading')}</h1>
                    <p className="mt-1 text-body text-neutral-500">{t('subheading')}</p>
                </div>
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={() => navigate({ to: '/announcement/create' })}
                >
                    <Plus className="size-4" weight="bold" />
                    {t('createAnnouncement')}
                </MyButton>
            </div>

            <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4">
                <Tabs
                    value={view}
                    onValueChange={(v: string) => {
                        setView(v as HistoryView);
                        setPage(0);
                    }}
                >
                    <TabsList>
                        <TabsTrigger value="all">{t('tabs.all')}</TabsTrigger>
                        <TabsTrigger value="planned">{t('tabs.planned')}</TabsTrigger>
                        <TabsTrigger value="past">{t('tabs.past')}</TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex flex-wrap items-end gap-3">
                    <div className="w-full sm:w-72">
                        <Label className="mb-1 block text-caption text-neutral-600">
                            {t('toolbar.searchLabel')}
                        </Label>
                        <div className="relative">
                            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                            <Input
                                className="pl-9"
                                placeholder={t('toolbar.searchPlaceholder')}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    {view === 'all' ? (
                        <div className="w-full sm:w-56">
                            <Label className="mb-1 block text-caption text-neutral-600">
                                {t('toolbar.statusLabel')}
                            </Label>
                            <Select
                                value={status ?? 'ALL'}
                                onValueChange={(v) => {
                                    setStatus(v === 'ALL' ? undefined : v);
                                    setPage(0);
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={t('toolbar.statusAll')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">{t('toolbar.statusAll')}</SelectItem>
                                    {allStatuses.map((s) => (
                                        <SelectItem key={s} value={s}>
                                            {t(`status.${s}`, { defaultValue: humanize(s) })}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <>
                            <div className="w-full sm:w-56">
                                <Label className="mb-1 block text-caption text-neutral-600">
                                    {t('toolbar.fromLabel')}
                                </Label>
                                <Input
                                    type="datetime-local"
                                    value={from}
                                    onChange={(e) => {
                                        setFrom(e.target.value);
                                        setPage(0);
                                    }}
                                />
                            </div>
                            <div className="w-full sm:w-56">
                                <Label className="mb-1 block text-caption text-neutral-600">
                                    {t('toolbar.toLabel')}
                                </Label>
                                <Input
                                    type="datetime-local"
                                    value={to}
                                    onChange={(e) => {
                                        setTo(e.target.value);
                                        setPage(0);
                                    }}
                                />
                            </div>
                        </>
                    )}
                </div>

                {isError ? (
                    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-danger-200 p-10 text-center">
                        <p className="text-body text-danger-600">{t('table.loadFailed')}</p>
                        <MyButton buttonType="secondary" scale="small" onClick={() => refetch()}>
                            {t('retry')}
                        </MyButton>
                    </div>
                ) : !isLoading && rows.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-200 p-10 text-center">
                        <Megaphone className="size-10 text-neutral-300" />
                        <p className="text-body text-neutral-500">
                            {search.trim() ? t('table.noMatch') : t('table.empty')}
                        </p>
                    </div>
                ) : (
                    <MyTable<Announcement>
                        data={tableData}
                        columns={columns}
                        isLoading={isLoading}
                        error={error}
                        currentPage={page}
                        enableColumnResizing={false}
                        scrollable
                    />
                )}

                {totalPages > 0 && (
                    <MyPagination
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={setPage}
                        totalElements={totalElements}
                        pageSize={size}
                        onPageSizeChange={(s) => {
                            setSize(s);
                            setPage(0);
                        }}
                        pageSizeOptions={[10, 20, 50]}
                    />
                )}
            </div>

            <AnnouncementDetailsDialog
                announcement={details}
                onClose={() => setDetails(null)}
                onOpenStats={setStatsFor}
            />
            <DeliveryStatsDialog announcement={statsFor} onClose={() => setStatsFor(null)} />

            <MyDialog
                heading={t('rejectDialog.title')}
                open={!!rejectFor}
                onOpenChange={(open) => !open && setRejectFor(null)}
                dialogWidth="max-w-md"
                footer={
                    <>
                        <MyButton buttonType="secondary" onClick={() => setRejectFor(null)}>
                            {t('rejectDialog.cancel')}
                        </MyButton>
                        <MyButton buttonType="primary" onAsyncClick={onReject}>
                            {t('rejectDialog.reject')}
                        </MyButton>
                    </>
                }
            >
                <Textarea
                    placeholder={t('rejectDialog.reasonPlaceholder')}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                />
            </MyDialog>

            <AlertDialog open={!!deleteFor} onOpenChange={(open) => !open && setDeleteFor(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('deleteDialog.description', { title: deleteFor?.title ?? '' })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('rejectDialog.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={onDelete}
                            className="bg-danger-600 hover:bg-danger-500"
                        >
                            {t('actions.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
