// components/BulkActionsMenu.tsx
import { MyDropdown } from '@/components/design-system/dropdown';
import { BulkActionInfo } from '@/routes/manage-students/students-list/-types/bulk-actions-types';
import { StudentTable } from '@/types/student-table-types';
import { ReactNode } from 'react';
import { EnrollRequestsBulkActionDropdownList } from '@/routes/manage-students/students-list/-constants/bulk-actions-menu-options';
import { useEnrollRequestsDialogStore } from './bulk-actions-store';

interface BulkActionsMenuProps {
    selectedCount: number;
    selectedStudentIds: string[];
    selectedStudents: StudentTable[];
    trigger: ReactNode;
}

export const EnrollRequestsBulkActionsMenu = ({
    selectedStudents,
    trigger,
}: BulkActionsMenuProps) => {
    const {
        openBulkShareCredentialsDialog,
        openBulkSendMessageDialog,
        openBulkSendEmailDialog,
        openBulkAcceptRequestDialog,
        openBulkDeclineRequestDialog,
    } = useEnrollRequestsDialogStore();

    const handleMenuOptionsChange = (value: string) => {
        const validStudents = selectedStudents.filter(
            (student) => student && student.user_id && student.package_session_id
        );

        if (validStudents.length === 0) {
            console.error('No valid students selected');
            return;
        }

        const bulkActionInfo: BulkActionInfo = {
            selectedStudentIds: validStudents.map((student) => student.id),
            selectedStudents: validStudents,
            displayText: `${validStudents.length} students`,
        };

        switch (value) {
            case 'Share Credentials':
                openBulkShareCredentialsDialog(bulkActionInfo);
                break;
            case 'Send WhatsApp Message':
                openBulkSendMessageDialog(bulkActionInfo);
                break;
            case 'Send Email':
                openBulkSendEmailDialog(bulkActionInfo);
                break;
            case 'Accept Request':
                openBulkAcceptRequestDialog(bulkActionInfo);
                break;
            case 'Decline Request':
                openBulkDeclineRequestDialog(bulkActionInfo);
                break;
        }
    };

    return (
        <MyDropdown
            dropdownList={EnrollRequestsBulkActionDropdownList}
            onSelect={handleMenuOptionsChange}
        >
            {trigger}
        </MyDropdown>
    );
};
