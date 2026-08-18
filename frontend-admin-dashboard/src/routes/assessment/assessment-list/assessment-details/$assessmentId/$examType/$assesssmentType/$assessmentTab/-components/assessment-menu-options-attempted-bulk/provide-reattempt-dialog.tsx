import { ReactNode, useState } from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { useSubmissionsBulkActionsDialogStoreAttempted } from '../bulk-actions-zustand-store/useSubmissionsBulkActionsDialogStoreAttempted';
import { useMutation } from '@tanstack/react-query';
import { provideReattemptToParticipants } from '../../-services/assessment-details-services';
import { toast } from 'sonner';
import { Route } from '../..';
import { getInstituteId } from '@/constants/helper';
import { MyInput } from '@/components/design-system/input';

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

    // How many extra attempts to grant. The endpoint has always accepted a count;
    // the dialog hard-coded 1, so an admin re-opening it four times was the only
    // way to give a learner four tries.
    const [reattemptCount, setReattemptCount] = useState('1');
    const parsedCount = Number.parseInt(reattemptCount, 10);
    const isCountValid = Number.isFinite(parsedCount) && parsedCount >= 1 && parsedCount <= 20;

    const provideReattemptMutation = useMutation({
        mutationFn: ({ registrationIds }: { registrationIds: string[] }) =>
            provideReattemptToParticipants(assessmentId, instituteId, registrationIds, parsedCount),
        onSuccess: () => {
            toast.success(
                `${parsedCount} attempt${parsedCount === 1 ? '' : 's'} granted to the selected participant(s).`,
                {
                    className: 'success-toast',
                    duration: 4000,
                }
            );
            closeAllDialogs();
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    const handleSubmit = () => {
        if (!isCountValid) return;
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
            <MyInput
                inputType="number"
                inputPlaceholder="1"
                input={reattemptCount}
                onChangeFunction={(e) => setReattemptCount(e.target.value)}
                label="Number of attempts to grant"
                required={true}
                error={isCountValid ? undefined : 'Enter a whole number between 1 and 20'}
                size="large"
                className="w-full"
            />
            <MyButton
                buttonType="primary"
                scale="large"
                layoutVariant="default"
                onClick={handleSubmit}
                disable={provideReattemptMutation.isPending || !isCountValid}
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
