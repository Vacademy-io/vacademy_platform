import { MyDialog } from '../../dialog';
import { ReactNode } from 'react';
import { useDialogStore } from '../../../../routes/manage-students/students-list/-hooks/useDialogStore';
import { MyButton } from '../../button';
import { useDeleteStudentMutation } from '@/routes/manage-students/students-list/-services/useStudentOperations';
import { useBulkDeleteStudentsMutation } from '@/routes/manage-students/students-list/-services/useBulkOperations';

interface DeleteStudentDialogProps {
    trigger: ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const DeleteStudentDialogContent = () => {
    const { selectedStudent, bulkActionInfo, isBulkAction, closeAllDialogs } = useDialogStore();
    const displayText = isBulkAction ? bulkActionInfo?.displayText : selectedStudent?.full_name;

    const { mutate: deleteSingle, isPending: isSinglePending } = useDeleteStudentMutation();
    const { mutate: deleteBulk, isPending: isBulkPending } = useBulkDeleteStudentsMutation();

    const handleSubmit = () => {
        if (isBulkAction && bulkActionInfo?.selectedStudents) {
            const validStudents = bulkActionInfo.selectedStudents.filter(
                (student) => student && student.user_id && student.package_session_id
            );

            if (validStudents.length === 0) {
                console.error('No valid students found for bulk action');
                return;
            }

            deleteBulk(
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
            deleteSingle(
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
                Are you sure you want to delete{' '}
                <span className="text-primary-500">{displayText}</span>?
            </div>
            <MyButton
                buttonType="primary"
                scale="large"
                layoutVariant="default"
                disable={isLoading}
                onClick={handleSubmit}
            >
                {isLoading ? 'Deleting...' : 'Delete'}
            </MyButton>
        </div>
    );
};

export const DeleteStudentDialog = ({ trigger, open, onOpenChange }: DeleteStudentDialogProps) => {
    return (
        <MyDialog
            trigger={trigger}
            heading="Delete"
            dialogWidth="w-[400px] max-w-[400px]"
            content={<DeleteStudentDialogContent />}
            open={open}
            onOpenChange={onOpenChange}
        />
    );
};
