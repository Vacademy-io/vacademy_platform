// extend-session-dialog.tsx
import { MyDialog } from '../../dialog';
import React, { ReactNode } from 'react';
import { useDialogStore } from '../../../../routes/manage-students/students-list/-hooks/useDialogStore';
import { useState } from 'react';
import { MyButton } from '../../button';
import { MyInput } from '../../input';
import { useExtendSessionMutation } from '@/routes/manage-students/students-list/-services/useStudentOperations';
import { useBulkExtendSessionMutation } from '@/routes/manage-students/students-list/-services/useBulkOperations';

interface ExtendSessionDialogProps {
    trigger: ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const ExtendSessionDialogContent = () => {
    const { selectedStudent, bulkActionInfo, isBulkAction, closeAllDialogs } = useDialogStore();
    const displayText = isBulkAction ? bulkActionInfo?.displayText : selectedStudent?.full_name;

    const [date, setDate] = useState('');

    const { mutate: extendSingleSession, isPending: isSinglePending } = useExtendSessionMutation();
    const { mutate: extendBulkSession, isPending: isBulkPending } = useBulkExtendSessionMutation();

    const handleSubmit = () => {
        const formattedDate = formatDateForApi(date);

        // For bulk actions
        if (isBulkAction && bulkActionInfo?.selectedStudents) {
            const validStudents = bulkActionInfo.selectedStudents.filter(
                (student) => student && student.user_id && student.package_session_id
            );

            if (validStudents.length === 0) {
                console.error('No valid students found for bulk action');
                return;
            }

            extendBulkSession(
                {
                    students: validStudents.map((student) => ({
                        userId: student.user_id,
                        currentPackageSessionId: student.package_session_id || '',
                    })),
                    newExpiryDate: formattedDate,
                },
                {
                    onSuccess: closeAllDialogs,
                }
            );
        }
        // For single student
        else if (selectedStudent?.user_id && selectedStudent?.package_session_id) {
            extendSingleSession(
                {
                    students: [
                        {
                            userId: selectedStudent.user_id,
                            currentPackageSessionId: selectedStudent.package_session_id,
                        },
                    ],
                    newExpiryDate: formattedDate,
                },
                {
                    onSuccess: closeAllDialogs,
                }
            );
        }
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setDate(event.target.value);
    };

    const formatDateForApi = (dateString: string) => {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    };

    const isLoading = isSinglePending || isBulkPending;

    return (
        <div className="flex flex-col gap-6 p-6 text-neutral-600">
            <div>
                Session duration for <span className="text-primary-500">{displayText}</span> will be
                extended
            </div>
            <MyInput
                inputType="date"
                inputPlaceholder="DD/MM/YY"
                input={date}
                onChangeFunction={handleInputChange}
                required={true}
                label="Extend till"
                className="w-fit text-neutral-600"
            />
            <MyButton
                buttonType="primary"
                scale="large"
                layoutVariant="default"
                disable={!date || isLoading}
                onClick={handleSubmit}
            >
                {isLoading ? 'Extending...' : 'Extend Session'}
            </MyButton>
        </div>
    );
};

export const ExtendSessionDialog = ({ trigger, open, onOpenChange }: ExtendSessionDialogProps) => {
    return (
        <MyDialog
            trigger={trigger}
            heading="Extend Session"
            dialogWidth="w-[400px] max-w-[400px]"
            content={<ExtendSessionDialogContent />}
            open={open}
            onOpenChange={onOpenChange}
        />
    );
};
