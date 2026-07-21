import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, LinkSimple } from '@phosphor-icons/react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { StatusChip } from '@/components/design-system/status-chips';
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
import { BookingPageForm } from '@/routes/meetings/-components/BookingPageForm';
import {
    useBookingPages,
    useDeleteBookingPage,
    useUpdateBookingPage,
} from '@/routes/meetings/-hooks/use-meetings';
import { publicBookingLink } from '@/routes/meetings/-utils/meetings-utils';

interface BookingSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    audienceId: string;
    audienceName: string;
    instituteId: string;
}

/**
 * Booking Settings for an audience list — enable a public booking page for the
 * list, or edit / deactivate / delete the one that already exists.
 */
export const BookingSettingsDialog = ({
    open,
    onOpenChange,
    audienceId,
    audienceName,
    instituteId,
}: BookingSettingsDialogProps) => {
    const [confirmDelete, setConfirmDelete] = useState(false);

    const {
        data: pages,
        isLoading,
        error,
    } = useBookingPages({ instituteId, audienceId, enabled: open });

    const page = pages?.[0];
    const updatePage = useUpdateBookingPage();
    const deletePage = useDeleteBookingPage();

    const link = publicBookingLink(page?.slug);
    const isInactive = (page?.status ?? '').toUpperCase() === 'INACTIVE';

    const handleCopyLink = async () => {
        if (!link) return;
        try {
            await navigator.clipboard.writeText(link);
            toast.success('Booking link copied');
        } catch {
            toast.error('Could not copy the link');
        }
    };

    const handleToggleStatus = () => {
        if (!page?.id) return;
        const nextStatus = isInactive ? 'ACTIVE' : 'INACTIVE';
        updatePage.mutate(
            {
                id: page.id,
                instituteId,
                data: { institute_id: instituteId, title: page.title, status: nextStatus },
            },
            {
                onSuccess: () =>
                    toast.success(
                        nextStatus === 'INACTIVE' ? 'Booking page deactivated' : 'Booking page activated'
                    ),
                onError: () => toast.error('Failed to update the booking page status'),
            }
        );
    };

    const handleDelete = () => {
        if (!page?.id) return;
        deletePage.mutate({ id: page.id, instituteId }, {
            onSuccess: () => {
                toast.success('Booking page deleted');
                setConfirmDelete(false);
            },
            onError: () => toast.error('Failed to delete the booking page'),
        });
    };

    let body: React.ReactNode;
    if (isLoading) {
        body = (
            <div className="flex min-h-32 items-center justify-center">
                <DashboardLoader />
            </div>
        );
    } else if (error) {
        body = (
            <p className="py-8 text-center text-body text-neutral-500">
                Couldn&apos;t load booking settings. Try again.
            </p>
        );
    } else if (!page) {
        body = (
            <div className="flex flex-col gap-3">
                <p className="text-body text-neutral-500">
                    Enable bookings for &quot;{audienceName}&quot; — leads on this list get a public
                    page where they can pick a slot on the host&apos;s calendar.
                </p>
                <BookingPageForm
                    instituteId={instituteId}
                    fixedAudienceId={audienceId}
                    defaultTitle={`${audienceName} Meeting`}
                    onSaved={() => toast.success('Bookings are now enabled for this list')}
                />
            </div>
        );
    } else {
        body = (
            <div className="flex flex-col gap-4">
                {/* Public link + status + lifecycle actions */}
                <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <LinkSimple className="size-4 text-neutral-500" />
                            <p className="text-body font-semibold text-neutral-600">Public booking link</p>
                        </div>
                        <StatusChip
                            text={isInactive ? 'Inactive' : 'Active'}
                            status={isInactive ? 'WARNING' : 'SUCCESS'}
                            textSize="text-caption"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <code className="min-w-0 flex-1 truncate rounded-md bg-neutral-100 px-2 py-1.5 text-caption text-neutral-600">
                            {link ?? 'Link available once the page has a slug'}
                        </code>
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="small"
                            className="sm:min-w-0"
                            disable={!link}
                            onClick={handleCopyLink}
                        >
                            <Copy className="mr-1 size-3.5" />
                            Copy
                        </MyButton>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="small"
                            className="sm:min-w-0"
                            disable={updatePage.isPending}
                            onClick={handleToggleStatus}
                        >
                            {isInactive ? 'Activate' : 'Deactivate'}
                        </MyButton>
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="small"
                            className="text-danger-600 sm:min-w-0"
                            onClick={() => setConfirmDelete(true)}
                        >
                            Delete
                        </MyButton>
                    </div>
                </div>

                <BookingPageForm
                    key={page.id}
                    instituteId={instituteId}
                    initialPage={page}
                    fixedAudienceId={audienceId}
                />
            </div>
        );
    }

    return (
        <>
            <MyDialog
                heading="Booking Settings"
                open={open}
                onOpenChange={onOpenChange}
                dialogWidth="max-w-3xl"
            >
                {body}
            </MyDialog>

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete booking page</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete the booking page for &quot;{audienceName}
                            &quot;? Its public link will stop working. This action cannot be undone.
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
