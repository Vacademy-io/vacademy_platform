import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Clock, Copy, LinkSimple, PencilSimple, Plus, Trash, UsersThree } from '@phosphor-icons/react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { DashboardLoader } from '@/components/core/dashboard-loader';
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
import { getInstituteId } from '@/constants/helper';
import { getUserId } from '@/utils/userDetails';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { OtherTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { handleFetchCampaignsList } from '@/routes/audience-manager/list/-services/get-campaigns-list';
import { useBookingPages, useDeleteBookingPage } from '../-hooks/use-meetings';
import { BookingPageDTO } from '../-types/meetings-types';
import { publicBookingLink } from '../-utils/meetings-utils';
import { BookingPageForm } from './BookingPageForm';

interface BookingPagesManagerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type ViewState = { mode: 'list' } | { mode: 'create' } | { mode: 'edit'; page: BookingPageDTO };

const copyLink = async (link: string) => {
    try {
        await navigator.clipboard.writeText(link);
        toast.success('Booking link copied');
    } catch {
        toast.error('Could not copy the link');
    }
};

export const BookingPagesManagerDialog = ({ open, onOpenChange }: BookingPagesManagerDialogProps) => {
    const instituteId = getInstituteId();
    const currentUserId = getUserId();
    const [view, setView] = useState<ViewState>({ mode: 'list' });
    const [deleteTarget, setDeleteTarget] = useState<BookingPageDTO | null>(null);

    const audienceTerm = getTerminology(OtherTerms.AudienceList, SystemTerms.AudienceList);

    const {
        data: pages,
        isLoading,
        error,
    } = useBookingPages({
        instituteId,
        hostUserId: currentUserId || undefined,
        enabled: open,
    });

    // Audience choices for the optional "attach to an audience list" select.
    const { data: campaignsData } = useQuery({
        ...handleFetchCampaignsList({ institute_id: instituteId ?? '', page: 0, size: 100 }),
        enabled: open && !!instituteId,
    });
    const audienceOptions = useMemo(
        () =>
            (campaignsData?.content ?? [])
                .map((campaign) => ({
                    id: campaign.campaign_id || campaign.id || campaign.audience_id || '',
                    label: campaign.campaign_name,
                }))
                .filter((option) => !!option.id),
        [campaignsData]
    );
    const audienceLabelById = useMemo(
        () => new Map(audienceOptions.map((option) => [option.id, option.label])),
        [audienceOptions]
    );

    const deletePage = useDeleteBookingPage();

    const handleDelete = () => {
        if (!deleteTarget?.id || !instituteId) return;
        deletePage.mutate({ id: deleteTarget.id, instituteId }, {
            onSuccess: () => {
                toast.success('Booking page deleted');
                setDeleteTarget(null);
            },
            onError: () => toast.error('Failed to delete the booking page'),
        });
    };

    const heading =
        view.mode === 'create'
            ? 'New Booking Page'
            : view.mode === 'edit'
              ? 'Edit Booking Page'
              : 'Share Booking Link';

    let body: React.ReactNode;
    if (!instituteId) {
        body = <p className="text-body text-neutral-500">Missing institute context.</p>;
    } else if (view.mode === 'create') {
        body = (
            <BookingPageForm
                instituteId={instituteId}
                audienceOptions={audienceOptions}
                onSaved={(page) => {
                    // This list only shows pages hosted by the current user, so
                    // a page created for someone else would otherwise look like
                    // a failed create.
                    if (page.host_user_id && page.host_user_id !== currentUserId) {
                        toast.info(
                            `Created — hosted by ${page.host_name || 'another user'}; it appears in their list.`
                        );
                    }
                    setView({ mode: 'list' });
                }}
                onCancel={() => setView({ mode: 'list' })}
            />
        );
    } else if (view.mode === 'edit') {
        body = (
            <BookingPageForm
                instituteId={instituteId}
                initialPage={view.page}
                audienceOptions={audienceOptions}
                onSaved={() => setView({ mode: 'list' })}
                onCancel={() => setView({ mode: 'list' })}
            />
        );
    } else if (isLoading) {
        body = (
            <div className="flex min-h-32 items-center justify-center">
                <DashboardLoader />
            </div>
        );
    } else if (error) {
        body = (
            <p className="py-8 text-center text-body text-neutral-500">
                Couldn&apos;t load your booking pages. Try again.
            </p>
        );
    } else {
        const list = pages ?? [];
        body = (
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <p className="text-body text-neutral-500">
                        Share a booking link so people can pick a slot on your calendar.
                    </p>
                    <MyButton
                        type="button"
                        buttonType="primary"
                        scale="small"
                        className="sm:min-w-0"
                        onClick={() => setView({ mode: 'create' })}
                    >
                        <Plus className="mr-1 size-3.5" />
                        New Booking Page
                    </MyButton>
                </div>

                {list.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-neutral-300 py-10 text-center">
                        <LinkSimple className="size-8 text-neutral-300" />
                        <p className="text-body font-semibold text-neutral-700">
                            No booking pages yet
                        </p>
                        <p className="text-caption text-neutral-500">
                            Create one to get a shareable booking link.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {list.map((page) => {
                            const link = publicBookingLink(page.slug);
                            const audienceLabel = page.audience_id
                                ? audienceLabelById.get(page.audience_id)
                                : undefined;
                            return (
                                <div
                                    key={page.id}
                                    className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-body font-semibold text-neutral-700">
                                            {page.title}
                                        </p>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-neutral-500">
                                            {page.duration_minutes != null && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="size-3.5" />
                                                    {page.duration_minutes} min
                                                </span>
                                            )}
                                            {audienceLabel && (
                                                <span className="flex items-center gap-1">
                                                    <UsersThree className="size-3.5" />
                                                    {audienceTerm}: {audienceLabel}
                                                </span>
                                            )}
                                            {link && (
                                                <span className="max-w-64 truncate">{link}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                        {link && (
                                            <MyButton
                                                type="button"
                                                buttonType="secondary"
                                                scale="small"
                                                layoutVariant="icon"
                                                title="Copy booking link"
                                                onClick={() => copyLink(link)}
                                            >
                                                <Copy className="size-3.5" />
                                            </MyButton>
                                        )}
                                        <MyButton
                                            type="button"
                                            buttonType="secondary"
                                            scale="small"
                                            layoutVariant="icon"
                                            title="Edit booking page"
                                            onClick={() => setView({ mode: 'edit', page })}
                                        >
                                            <PencilSimple className="size-3.5" />
                                        </MyButton>
                                        <MyButton
                                            type="button"
                                            buttonType="secondary"
                                            scale="small"
                                            layoutVariant="icon"
                                            title="Delete booking page"
                                            onClick={() => setDeleteTarget(page)}
                                        >
                                            <Trash className="size-3.5 text-danger-600" />
                                        </MyButton>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    return (
        <>
            <MyDialog
                heading={heading}
                open={open}
                onOpenChange={(next) => {
                    if (!next) setView({ mode: 'list' });
                    onOpenChange(next);
                }}
                dialogWidth="max-w-3xl"
            >
                {body}
            </MyDialog>

            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete booking page</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete &quot;{deleteTarget?.title}&quot;? Its
                            booking link will stop working. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletePage.isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDelete();
                            }}
                            disabled={deletePage.isPending}
                            className="bg-danger-600 hover:bg-danger-700"
                        >
                            {deletePage.isPending ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
