// components/BulkActionsMenu.tsx
import { MyDropdown } from '@/components/design-system/dropdown';
import { DropdownItem } from '@/components/design-system/utils/types/dropdown-types';
import { BulkActionInfo } from '@/routes/manage-students/students-list/-types/bulk-actions-types';
import { StudentTable } from '@/types/student-table-types';
import { ReactNode } from 'react';
import { useEnrollRequestsDialogStore } from './bulk-actions-store';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

interface BulkActionsMenuProps {
    selectedCount: number;
    selectedStudentIds: string[];
    selectedStudents: StudentTable[];
    trigger: ReactNode;
}

// Internal action-type constants used for dispatch logic. These must never be
// swapped for translated display text — see handleMenuOptionsChange below.
const MENU_ACTION = {
    SHARE_CREDENTIALS: 'SHARE_CREDENTIALS',
    SEND_WHATSAPP_MESSAGE: 'SEND_WHATSAPP_MESSAGE',
    SEND_EMAIL: 'SEND_EMAIL',
    ACCEPT_REQUEST: 'ACCEPT_REQUEST',
    DECLINE_REQUEST: 'DECLINE_REQUEST',
} as const;

const buildEnrollRequestsBulkActionDropdownList = (t: TFunction): DropdownItem[] => [
    { label: t('menu.shareCredentials'), value: MENU_ACTION.SHARE_CREDENTIALS },
    { label: t('menu.sendWhatsappMessage'), value: MENU_ACTION.SEND_WHATSAPP_MESSAGE },
    { label: t('menu.sendEmail'), value: MENU_ACTION.SEND_EMAIL },
    { label: t('menu.acceptRequest'), value: MENU_ACTION.ACCEPT_REQUEST },
    { label: t('menu.declineRequest'), value: MENU_ACTION.DECLINE_REQUEST },
];

export const EnrollRequestsBulkActionsMenu = ({
    selectedStudents,
    trigger,
}: BulkActionsMenuProps) => {
    const { t } = useTranslation('manageStudentsEnrollRequestsBulkActionsMenu');
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
            displayText: t('actionInfo.selectedStudents', { count: validStudents.length }),
        };

        switch (value) {
            case MENU_ACTION.SHARE_CREDENTIALS:
                openBulkShareCredentialsDialog(bulkActionInfo);
                break;
            case MENU_ACTION.SEND_WHATSAPP_MESSAGE:
                openBulkSendMessageDialog(bulkActionInfo);
                break;
            case MENU_ACTION.SEND_EMAIL:
                openBulkSendEmailDialog(bulkActionInfo);
                break;
            case MENU_ACTION.ACCEPT_REQUEST:
                openBulkAcceptRequestDialog(bulkActionInfo);
                break;
            case MENU_ACTION.DECLINE_REQUEST:
                openBulkDeclineRequestDialog(bulkActionInfo);
                break;
        }
    };

    return (
        <MyDropdown
            dropdownList={buildEnrollRequestsBulkActionDropdownList(t)}
            onSelect={handleMenuOptionsChange}
        >
            {trigger}
        </MyDropdown>
    );
};
