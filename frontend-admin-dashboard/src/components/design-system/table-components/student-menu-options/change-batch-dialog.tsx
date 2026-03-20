// components/change-batch-dialog.tsx
import { MyDialog } from '../../dialog';
import { ReactNode } from 'react';
import { useDialogStore } from '../../../../routes/manage-students/students-list/-hooks/useDialogStore';
import { useUpdateBatchMutation } from '@/routes/manage-students/students-list/-services/useStudentOperations';
import { useBulkUpdateBatchMutation } from '@/routes/manage-students/students-list/-services/useBulkOperations';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { StudyMaterialDetailsForm } from '@/routes/study-library/courses/-components/upload-study-material/study-material-details-form';
import { DashboardLoader } from '@/components/core/dashboard-loader';

interface ChangeBatchDialogProps {
    trigger: ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const ChangeBatchDialogContent = () => {
    const { selectedStudent, bulkActionInfo, isBulkAction, closeAllDialogs } = useDialogStore();
    const { getPackageSessionId } = useInstituteDetailsStore();

    const { mutate: updateSingleBatch, isPending: isSinglePending } = useUpdateBatchMutation();
    const { mutate: updateBulkBatch, isPending: isBulkPending } = useBulkUpdateBatchMutation();

    const displayText = isBulkAction ? bulkActionInfo?.displayText : selectedStudent?.full_name;

    const submitChangeBatch = (data: {
        [x: string]:
            | {
                  id: string;
                  name: string;
              }
            | undefined;
    }) => {
        const packageSessionId = getPackageSessionId({
            courseId: data['course']?.id || '',
            sessionId: data['session']?.id || '',
            levelId: data['level']?.id || '',
        });

        if (isBulkAction && bulkActionInfo?.selectedStudents) {
            updateBulkBatch(
                {
                    students: bulkActionInfo.selectedStudents.map((student) => ({
                        userId: student.user_id,
                        currentPackageSessionId: student.package_session_id || '',
                    })),
                    newPackageSessionId: packageSessionId || '',
                },
                {
                    onSuccess: closeAllDialogs,
                }
            );
        } else if (selectedStudent) {
            updateSingleBatch(
                {
                    students: [
                        {
                            userId: selectedStudent.user_id,
                            currentPackageSessionId: selectedStudent.package_session_id || '',
                        },
                    ],
                    newPackageSessionId: packageSessionId || '',
                },
                {
                    onSuccess: closeAllDialogs,
                }
            );
        }
    };

    if (isBulkPending || isSinglePending) return <DashboardLoader />;

    return (
        <div className="flex flex-col gap-6">
            <p>
                Batch for <span className="text-primary-500">{displayText}</span> will be changed to
                the following
            </p>
            <StudyMaterialDetailsForm
                fields={['course', 'session', 'level']}
                onFormSubmit={submitChangeBatch}
                submitButtonName="Change Batch"
            />
        </div>
    );
};

export const ChangeBatchDialog = ({ trigger, open, onOpenChange }: ChangeBatchDialogProps) => {
    return (
        <MyDialog
            trigger={trigger}
            heading="Change Batch"
            dialogWidth="w-[400px] max-w-[400px]"
            content={<ChangeBatchDialogContent />}
            open={open}
            onOpenChange={onOpenChange}
        />
    );
};
