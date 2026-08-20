import { ShareCredentialsDialog } from '@/components/templates/ShareCredentialsDialog';
import { useEnrollRequestsDialogStore } from '../bulk-actions-store';

/** Enroll-requests "Share Credentials" for the one learner whose row was actioned. */
export const IndividualShareCredentialsDialog = () => {
    const { isIndividualShareCredentialsOpen, selectedStudent, closeAllDialogs } =
        useEnrollRequestsDialogStore();

    return (
        <ShareCredentialsDialog
            open={isIndividualShareCredentialsOpen}
            onOpenChange={closeAllDialogs}
            userIds={selectedStudent ? [selectedStudent.user_id] : []}
            recipientLabel={selectedStudent?.full_name}
        />
    );
};
