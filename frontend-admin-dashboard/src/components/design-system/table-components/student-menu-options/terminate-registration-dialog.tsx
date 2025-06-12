import { MyDialog } from '../../dialog';
import { ReactNode } from 'react';
import { useDialogStore } from '../../../../routes/manage-students/students-list/-hooks/useDialogStore';
import { MyButton } from '../../button';
import { useTerminateStudentMutation } from '@/routes/manage-students/students-list/-services/useStudentOperations';
import { useBulkTerminateStudentsMutation } from '@/routes/manage-students/students-list/-services/useBulkOperations';

interface TerminateRegistrationDialogProps {
    trigger: ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const TerminateRegistrationDialogContent = () => {
    const { selectedStudent, bulkActionInfo, isBulkAction, closeAllDialogs } = useDialogStore();
    const displayText = isBulkAction ? bulkActionInfo?.displayText : selectedStudent?.full_name;

    const { mutate: terminateSingle, isPending: isSinglePending } = useTerminateStudentMutation();
    const { mutate: terminateBulk, isPending: isBulkPending } = useBulkTerminateStudentsMutation();

    const handleSubmit = () => {
        if (isBulkAction && bulkActionInfo?.selectedStudents) {
            const validStudents = bulkActionInfo.selectedStudents.filter(
                (student) => student && student.user_id && student.package_session_id
            );

            if (validStudents.length === 0) {
                console.error('No valid students found for bulk action');
                return;
            }

            terminateBulk(
                {
                    students: validStudents.map((student) => ({
                        userId: student.user_id,
                        currentPackageSessionId: student.package_session_id || '',
                    })),
                },
                {
                    onSuccess: closeAllDialogs,
                }
            );
        } else if (selectedStudent?.user_id && selectedStudent?.package_session_id) {
            terminateSingle(
                {
                    students: [
                        {
                            userId: selectedStudent.user_id,
                            currentPackageSessionId: selectedStudent.package_session_id,
                        },
                    ],
                },
                {
                    onSuccess: closeAllDialogs,
                }
            );
        }
    };

    const isLoading = isSinglePending || isBulkPending;

    return (
        <div className="flex flex-col gap-6 p-6 text-neutral-600">
            <div>
                Registration for <span className="text-primary-500">{displayText}</span> will be
                terminated
            </div>
            <MyButton
                buttonType="primary"
                scale="large"
                layoutVariant="default"
                disable={isLoading}
                onClick={handleSubmit}
            >
                {isLoading ? 'Terminating...' : 'Terminate'}
            </MyButton>
        </div>
    );
};

export const TerminateRegistrationDialog = ({
    trigger,
    open,
    onOpenChange,
}: TerminateRegistrationDialogProps) => {
    return (
        <MyDialog
            trigger={trigger}
            heading="Terminate Registration"
            dialogWidth="w-[400px] max-w-[400px]"
            content={<TerminateRegistrationDialogContent />}
            open={open}
            onOpenChange={onOpenChange}
        />
    );
};
