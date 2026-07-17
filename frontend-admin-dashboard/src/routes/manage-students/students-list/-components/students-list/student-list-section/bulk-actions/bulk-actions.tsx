// components/bulk-actions.tsx
import { MyButton } from '@/components/design-system/button';
import { CaretUpDown, XCircle } from '@phosphor-icons/react';
import { BulkActionsMenu } from './bulk-actions-menu';
// import { useToast } from "@/hooks/use-toast";
import { StudentTable } from '@/types/student-table-types';

interface BulkActionsProps {
    selectedCount: number;
    selectedStudentIds: string[];
    selectedStudents: StudentTable[]; // Add this prop
    onReset: () => void;
    // Surfaces the bulk "Accept Request" action while the Approval Status filter is active.
    showApprovalActions?: boolean;
}

export const BulkActions = ({
    selectedCount,
    selectedStudentIds,
    selectedStudents, // Add this
    onReset,
    showApprovalActions = false,
}: BulkActionsProps) => {
    //   const { toast } = useToast();

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

                <BulkActionsMenu
                    selectedCount={selectedCount}
                    selectedStudentIds={selectedStudentIds}
                    selectedStudents={selectedStudents} // Pass the selected students
                    showApprovalActions={showApprovalActions}
                    trigger={
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            layoutVariant="default"
                            className="flex w-full cursor-pointer items-center justify-between"
                        >
                            <div>Bulk Actions</div>
                            <CaretUpDown />
                        </MyButton>
                    }
                />
            </div>
        </div>
    );
};
