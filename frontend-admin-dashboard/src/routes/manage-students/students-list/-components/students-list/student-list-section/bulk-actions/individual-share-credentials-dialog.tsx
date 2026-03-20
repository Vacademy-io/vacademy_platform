import { MyDialog } from '@/components/design-system/dialog';
import { useDialogStore } from '@/routes/manage-students/students-list/-hooks/useDialogStore';
import { useShareCredentials } from '@/routes/manage-students/students-list/-services/share-credentials';
import { toast } from 'sonner';

export const IndividualShareCredentialsDialog = () => {
    const { isIndividualShareCredentialsOpen, selectedStudent, closeAllDialogs } = useDialogStore();
    const shareCredentialsMutation = useShareCredentials();

    const handleShareCredentials = async () => {
        if (!selectedStudent) return;

        try {
            await shareCredentialsMutation.mutateAsync({
                userIds: [selectedStudent.user_id],
            });
            toast.success('Credentials shared successfully');
            closeAllDialogs();
        } catch {
            toast.error('Failed to share credentials');
        }
    };

    return (
        <MyDialog
            heading="Share Credentials"
            open={isIndividualShareCredentialsOpen}
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
                        onClick={handleShareCredentials}
                    >
                        Share Credentials
                    </button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <p className="text-neutral-600">
                    Are you sure you want to share credentials for {selectedStudent?.full_name}?
                </p>
                <p className="text-sm text-neutral-500">
                    This will send the credentials to the student via email.
                </p>
            </div>
        </MyDialog>
    );
};
