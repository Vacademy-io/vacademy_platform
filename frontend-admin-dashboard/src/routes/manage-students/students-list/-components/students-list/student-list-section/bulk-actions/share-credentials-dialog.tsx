import { ShareCredentialsDialog as SharedShareCredentialsDialog } from '@/components/templates/ShareCredentialsDialog';
import { useDialogStore } from '@/routes/manage-students/students-list/-hooks/useDialogStore';

/** Learner-list "Share Credentials" for the current bulk selection. */
export const ShareCredentialsDialog = () => {
    const { isShareCredentialsOpen, bulkActionInfo, closeAllDialogs } = useDialogStore();

    return (
        <SharedShareCredentialsDialog
            open={isShareCredentialsOpen}
            onOpenChange={closeAllDialogs}
            userIds={bulkActionInfo?.selectedStudents.map((student) => student.user_id) ?? []}
            recipientLabel={bulkActionInfo?.displayText}
        />
    );
};
