// components/BulkActionsMenu.tsx
import { MyDropdown } from '@/components/design-system/dropdown';
import { useDialogStore } from '@/routes/manage-students/students-list/-hooks/useDialogStore';
import { BulkActionInfo } from '@/routes/manage-students/students-list/-types/bulk-actions-types';
import { StudentTable } from '@/types/student-table-types';
import { ReactNode } from 'react';
import { BulkActionDropdownList } from '@/routes/manage-students/students-list/-constants/bulk-actions-menu-options';
import { useRouter } from '@tanstack/react-router';
import { useEnrollRequestsDialogStore } from '@/routes/manage-students/enroll-requests/-components/bulk-actions/bulk-actions-store';

interface BulkActionsMenuProps {
    selectedCount: number;
    selectedStudentIds: string[];
    selectedStudents: StudentTable[];
    trigger: ReactNode;
    // When the Approval Status filter (Pending for Approval / Invited) is active,
    // expose the bulk "Accept Request" action so pending learners can be approved
    // in bulk instead of one-by-one from each row's menu.
    showApprovalActions?: boolean;
}

export const BulkActionsMenu = ({
    selectedStudents,
    trigger,
    showApprovalActions = false,
}: BulkActionsMenuProps) => {
    const router = useRouter();
    const {
        openBulkChangeBatchDialog,
        openBulkReRegisterDialog,
        openBulkTerminateRegistrationDialog,
        openBulkDeleteDialog,
        openBulkShareCredentialsDialog,
        openBulkSendMessageDialog,
        openBulkSendEmailDialog,
    } = useDialogStore();
    // The Accept flow is owned by the enroll-requests dialog store (the same store the
    // row-level "Accept Request" menu uses); its AcceptRequestDialog is already mounted
    // on this page and handles bulk approval.
    const { openBulkAcceptRequestDialog } = useEnrollRequestsDialogStore();

    const dropdownList = showApprovalActions
        ? ['Accept Request', ...BulkActionDropdownList]
        : BulkActionDropdownList;

    const handleMenuOptionsChange = (value: string) => {
        const validStudents = selectedStudents.filter(
            (student) => student && student.user_id && student.package_session_id
        );

        if (validStudents.length === 0) {
            // No valid students selected - error handled by toast
            return;
        }

        const bulkActionInfo: BulkActionInfo = {
            selectedStudentIds: validStudents.map((student) => student.id),
            selectedStudents: validStudents,
            displayText: `${validStudents.length} students`,
        };

        switch (value) {
            case 'Accept Request':
                openBulkAcceptRequestDialog(bulkActionInfo);
                break;
            case 'Change Batch':
                openBulkChangeBatchDialog(bulkActionInfo);
                break;
            case 'Re-register for Next Session':
                openBulkReRegisterDialog(bulkActionInfo);
                break;
            case 'Terminate Registration':
                openBulkTerminateRegistrationDialog(bulkActionInfo);
                break;
            case 'Delete':
                openBulkDeleteDialog(bulkActionInfo);
                break;
            case 'Share Credentials':
                openBulkShareCredentialsDialog(bulkActionInfo);
                break;
            case 'Send WhatsApp Message':
                openBulkSendMessageDialog(bulkActionInfo);
                break;
            case 'Send Email':
                openBulkSendEmailDialog(bulkActionInfo);
                break;
            case 'Create Certificate':
                // Navigate to certificate generation with selected students
                router.navigate({
                    to: '/certificate-generation/student-data',
                    search: {
                        students: encodeURIComponent(
                            JSON.stringify(validStudents.map((s) => s.user_id))
                        ),
                    },
                });
                break;
        }
    };

    return (
        <MyDropdown dropdownList={dropdownList} onSelect={handleMenuOptionsChange}>
            {trigger}
        </MyDropdown>
    );
};
