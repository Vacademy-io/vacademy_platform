import { ShareCredentialsDialog } from '@/components/templates/ShareCredentialsDialog';
import { useDialogStore } from '@/routes/manage-students/students-list/-hooks/useDialogStore';

/** Learner-list "Share Credentials" for the one learner whose row was actioned. */
export const IndividualShareCredentialsDialog = () => {
    const { isIndividualShareCredentialsOpen, selectedStudent, closeAllDialogs } = useDialogStore();

    return (
        <ShareCredentialsDialog
            open={isIndividualShareCredentialsOpen}
            onOpenChange={closeAllDialogs}
            userIds={selectedStudent ? [selectedStudent.user_id] : []}
            recipientLabel={selectedStudent?.full_name}
        />
    );
};
