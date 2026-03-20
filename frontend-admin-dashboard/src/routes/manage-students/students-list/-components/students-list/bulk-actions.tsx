// components/bulk-actions.tsx
import { MyButton } from '@/components/design-system/button';
import { CaretUpDown, XCircle } from '@phosphor-icons/react';
import { BulkActionsMenu } from './student-list-section/bulk-actions/bulk-actions-menu';
import { StudentTable } from '@/types/student-table-types';

interface BulkActionsProps {
    selectedCount: number;
    selectedStudentIds: string[];
    selectedStudents: StudentTable[];
    onReset: () => void;
    isAssessment?: boolean;
}

export const BulkActions = ({
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
                    <BulkActionsMenu
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
