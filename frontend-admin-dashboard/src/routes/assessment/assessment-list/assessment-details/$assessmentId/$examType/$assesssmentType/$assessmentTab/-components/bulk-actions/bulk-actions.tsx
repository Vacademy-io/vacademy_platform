import { MyButton } from '@/components/design-system/button';
import { CaretUpDown, XCircle } from '@phosphor-icons/react';
import { BulkActionsMenuAttempted } from './bulk-actions-menu-attempted';
import { SubmissionStudentData } from '@/types/assessments/assessment-overview';
import { BulkActionsMenuOngoing } from './bulk-actions-menu-ongoing';
import { BulkActionsMenuPending } from './bulk-actions-menu-pending';
import { useTranslation } from 'react-i18next';

interface BulkActionsProps {
    selectedCount: number;
    selectedStudentIds: string[];
    selectedStudents: SubmissionStudentData[]; // Add this prop
    onReset: () => void;
    selectedTab: string;
    // Opens the report ZIP export dialog scoped to the checked rows
    // (Attempted tab only — other tabs have no reports to export).
    onExportReports?: () => void;
}

export const BulkActions = ({
    selectedCount,
    selectedStudentIds,
    selectedStudents, // Add this
    onReset,
    selectedTab,
    onExportReports,
}: BulkActionsProps) => {
    const { t } = useTranslation('assessmentBulkActions');

    if (selectedCount === 0) {
        return null;
    }

    return (
        <div className="flex items-center gap-5 text-neutral-600">
            <div className="flex gap-1">
                <div>{t('selectedCount', { count: selectedCount })}</div>
            </div>

            <div className="flex items-center gap-20">
                <MyButton
                    buttonType="secondary"
                    scale="medium"
                    layoutVariant="default"
                    className="flex items-center"
                    onClick={onReset}
                >
                    {t('reset')}
                    <XCircle />
                </MyButton>
                {selectedTab === 'Attempted' && (
                    <BulkActionsMenuAttempted
                        selectedCount={selectedCount}
                        selectedStudentIds={selectedStudentIds}
                        selectedStudents={selectedStudents} // Pass the selected students
                        onExportReports={onExportReports}
                        trigger={
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                layoutVariant="default"
                                className="flex w-full cursor-pointer items-center justify-between"
                            >
                                <div>{t('bulkActions')}</div>
                                <CaretUpDown />
                            </MyButton>
                        }
                    />
                )}
                {selectedTab === 'Ongoing' && (
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
                                <div>{t('bulkActions')}</div>
                                <CaretUpDown />
                            </MyButton>
                        }
                    />
                )}
                {selectedTab === 'Pending' && (
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
                                <div>{t('bulkActions')}</div>
                                <CaretUpDown />
                            </MyButton>
                        }
                    />
                )}
            </div>
        </div>
    );
};
