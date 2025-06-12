import { MyButton } from "@/components/design-system/button";
import { CaretUpDown, XCircle } from "@phosphor-icons/react";
import { BulkActionsMenuAttempted } from "./bulk-actions-menu-attempted";
import { SubmissionStudentData } from "@/types/assessments/assessment-overview";
import { BulkActionsMenuOngoing } from "./bulk-actions-menu-ongoing";
import { BulkActionsMenuPending } from "./bulk-actions-menu-pending";

interface BulkActionsProps {
    selectedCount: number;
    selectedStudentIds: string[];
    selectedStudents: SubmissionStudentData[]; // Add this prop
    onReset: () => void;
    selectedTab: string;
}

export const BulkActions = ({
    selectedCount,
    selectedStudentIds,
    selectedStudents, // Add this
    onReset,
    selectedTab,
}: BulkActionsProps) => {
    if (selectedCount === 0) {
        return null;
    }

    return (
        <div className="flex items-center gap-5 text-neutral-600">
            <div className="flex gap-1">
                [{selectedCount}] <div>Selected</div>
            </div>

            <div className="flex items-center gap-20">
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
                {selectedTab === "Attempted" && (
                    <BulkActionsMenuAttempted
                        selectedCount={selectedCount}
                        selectedStudentIds={selectedStudentIds}
                        selectedStudents={selectedStudents} // Pass the selected students
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
                )}
                {selectedTab === "Ongoing" && (
                    <BulkActionsMenuOngoing
                        selectedCount={selectedCount}
                        selectedStudentIds={selectedStudentIds}
                        selectedStudents={selectedStudents} // Pass the selected students
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
                )}
                {selectedTab === "Pending" && (
                    <BulkActionsMenuPending
                        selectedCount={selectedCount}
                        selectedStudentIds={selectedStudentIds}
                        selectedStudents={selectedStudents} // Pass the selected students
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
                )}
            </div>
        </div>
    );
};
