// components/bulk-actions.tsx
import { MyButton } from '@/components/design-system/button';
import { CaretUpDown, XCircle } from '@phosphor-icons/react';
import { StudentTable } from '@/types/student-table-types';
import { EnrollRequestsBulkActionsMenu } from './enroll-requests-bulk-actions-menu';

interface BulkActionsProps {
    selectedCount: number;
    selectedStudentIds: string[];
    selectedStudents: StudentTable[];
    onReset: () => void;
    isAssessment?: boolean;
}

export const EnrollRequestsBulkActions = ({
    selectedCount,
    selectedStudentIds,
    selectedStudents,
    onReset,
    isAssessment,
}: BulkActionsProps) => {
    if (selectedCount === 0) {
        return null;
    }

    return (
        <div className="flex items-center gap-5 text-neutral-600">
            <div className="flex gap-1">
                [{selectedCount}] <div>Selected</div>
            </div>

            <div className="flex items-center gap-3">
                <MyButton
                    buttonType="secondary"
                    scale="medium"
                    layoutVariant="default"
                    className="flex items-center"
                    onClick={onReset}
                >
                    Reset
                    <XCircle />
                </MyButton>

                {!isAssessment && (
                    <EnrollRequestsBulkActionsMenu
                        selectedCount={selectedCount}
                        selectedStudentIds={selectedStudentIds}
                        selectedStudents={selectedStudents}
                        trigger={
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                layoutVariant="default"
                                className="flex w-full cursor-pointer items-center justify-between"
                            >
                                <p>Bulk Actions</p>
                                <CaretUpDown />
                            </MyButton>
                        }
                    />
                )}
            </div>
        </div>
    );
};
