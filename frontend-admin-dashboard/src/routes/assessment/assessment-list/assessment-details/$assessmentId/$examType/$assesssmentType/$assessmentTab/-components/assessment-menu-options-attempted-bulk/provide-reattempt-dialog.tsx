import { ReactNode } from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { useSubmissionsBulkActionsDialogStoreAttempted } from '../bulk-actions-zustand-store/useSubmissionsBulkActionsDialogStoreAttempted';
import { useMutation } from '@tanstack/react-query';
import { provideReattemptToParticipants } from '../../-services/assessment-details-services';
import { toast } from 'sonner';
import { Route } from '../..';
import { getInstituteId } from '@/constants/helper';

interface ProvideDialogDialogProps {
    trigger: ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const ProvideReattemptDialogContent = () => {
    const { selectedStudent, bulkActionInfo, isBulkAction, closeAllDialogs } =
        useSubmissionsBulkActionsDialogStoreAttempted();
    const { assessmentId } = Route.useParams();
    const instituteId = getInstituteId();
    const displayText = isBulkAction ? bulkActionInfo?.displayText : selectedStudent?.student_name;

    const provideReattemptMutation = useMutation({
        mutationFn: ({ registrationIds }: { registrationIds: string[] }) =>
            provideReattemptToParticipants(assessmentId, instituteId, registrationIds),
        onSuccess: () => {
            toast.success('Reattempt has been provided to the selected participant(s).', {
                className: 'success-toast',
                duration: 4000,
            });
            closeAllDialogs();
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    const handleSubmit = () => {
        if (isBulkAction && bulkActionInfo?.selectedStudents) {
            provideReattemptMutation.mutate({
                registrationIds: bulkActionInfo.selectedStudents.map(
                    (student) => student.registration_id
                ),
            });
        } else if (selectedStudent) {
            provideReattemptMutation.mutate({
                registrationIds: [selectedStudent.registration_id],
            });
        } else {
            closeAllDialogs();
        }
    };

    return (
        <div className="flex flex-col gap-6 px-4 pb-2 text-neutral-600">
            <h1>
                Are you sure you want to provide reattempt to selected&nbsp;
                <span className="text-primary-500">{displayText}</span>?
            </h1>
            <MyButton
                buttonType="primary"
                scale="large"
                layoutVariant="default"
                onClick={handleSubmit}
                disable={provideReattemptMutation.isPending}
            >
                Done
            </MyButton>
        </div>
    );
};

export const ProvideReattemptDialog = ({
    trigger,
    open,
    onOpenChange,
}: ProvideDialogDialogProps) => {
    return (
        <MyDialog
            trigger={trigger}
            heading="Provide Reattempt"
            dialogWidth="w-[400px] max-w-[400px]"
            content={<ProvideReattemptDialogContent />}
            open={open}
            onOpenChange={onOpenChange}
        />
    );
};
