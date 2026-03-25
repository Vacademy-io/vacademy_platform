import { MyDialog } from '@/components/design-system/dialog';
import { toast } from 'sonner';
import { useEnrollRequestsDialogStore } from '../bulk-actions-store';

export const DeclineRequestDialog = () => {
    const { isDeclineRequestOpen, bulkActionInfo, selectedStudent, closeAllDialogs } =
        useEnrollRequestsDialogStore();

    const handleDeclineRequestBulk = async () => {
        if (!bulkActionInfo) return;

        try {
            toast.success('Request declined successfully');
            closeAllDialogs();
        } catch {
            toast.error('Failed to decline request');
        }
    };

    const handleDeclineRequest = async () => {
        if (!selectedStudent) return;

        try {
            toast.success('Request accepted successfully');
            closeAllDialogs();
        } catch {
            toast.error('Failed to accept request');
        }
    };

    return (
        <MyDialog
            heading="Accept Request"
            open={isDeclineRequestOpen}
            onOpenChange={closeAllDialogs}
            footer={
                <div className="flex w-full justify-between gap-2">
                    <button
                        className="rounded-lg border border-neutral-300 px-4 py-2 text-neutral-600 hover:bg-neutral-100"
                        onClick={closeAllDialogs}
                    >
                        Cancel
                    </button>
                    <button
                        className="hover:bg-primary-600 rounded-lg bg-primary-500 px-4 py-2 text-white"
                        onClick={selectedStudent ? handleDeclineRequest : handleDeclineRequestBulk}
                    >
                        Decline Request
                    </button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <p className="text-neutral-600">
                    Are you sure you want to decline request for{' '}
                    {selectedStudent ? selectedStudent?.full_name : bulkActionInfo?.displayText}?
                </p>
                <p className="text-sm text-neutral-500">
                    This will decline the request to the selected students via email.
                </p>
            </div>
        </MyDialog>
    );
};
