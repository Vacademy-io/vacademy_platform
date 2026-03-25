// StudentMenuOptions.tsx
import { DotsThree } from '@phosphor-icons/react';
import { StudentTable } from '@/types/student-table-types';
import { useEnrollRequestsDialogStore } from './bulk-actions-store';
import { MyDropdown } from '@/components/design-system/dropdown';
import { MyButton } from '@/components/design-system/button';

const getMenuOptions = () => {
    return [
        'Share Credentials',
        'Send WhatsApp Message',
        'Send Email',
        'Accept Request',
        'Decline Request',
    ];
};

export const EnrollRequestsStudentMenuOptions = ({ student }: { student: StudentTable }) => {
    const {
        openIndividualShareCredentialsDialog,
        openIndividualSendMessageDialog,
        openIndividualSendEmailDialog,
        openIndividualAcceptRequestDialog,
        openIndividualDeclineRequestDialog,
    } = useEnrollRequestsDialogStore();

    const handleMenuOptionsChange = (value: string) => {
        switch (value) {
            case 'Share Credentials':
                openIndividualShareCredentialsDialog(student);
                break;
            case 'Send WhatsApp Message':
                openIndividualSendMessageDialog(student);
                break;
            case 'Send Email':
                openIndividualSendEmailDialog(student);
                break;
            case 'Accept Request':
                openIndividualAcceptRequestDialog(student);
                break;
            case 'Decline Request':
                openIndividualDeclineRequestDialog(student);
                break;
        }
    };

    return (
        <MyDropdown dropdownList={getMenuOptions()} onSelect={handleMenuOptionsChange}>
            <MyButton
                buttonType="secondary"
                scale="small"
                layoutVariant="icon"
                className="flex items-center justify-center"
            >
                <DotsThree />
            </MyButton>
        </MyDropdown>
    );
};
