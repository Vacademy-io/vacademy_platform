import { ShareCredentialsDialog } from '@/components/templates/ShareCredentialsDialog';
import { useEnrollRequestsDialogStore } from '../bulk-actions-store';

/** Enroll-requests "Share Credentials" for the current bulk selection. */
export const CollectiveShareCredentialsDialog = () => {
    const { isShareCredentialsOpen, bulkActionInfo, closeAllDialogs } =
        useEnrollRequestsDialogStore();

    return (
        <ShareCredentialsDialog
            open={isShareCredentialsOpen}
            onOpenChange={closeAllDialogs}
            userIds={bulkActionInfo?.selectedStudents.map((student) => student.user_id) ?? []}
            recipientLabel={bulkActionInfo?.displayText}
        />
    );
};
