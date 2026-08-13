import { MyButton } from '@/components/design-system/button';
import { MyDropdown } from '@/components/design-system/dropdown';
import { DotsThree } from '@phosphor-icons/react';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

interface MenuOptionsProps {
    onDelete: () => void;
    onEdit: () => void;
    onOfflineAvailability?: () => void;
}

export const MenuOptions = ({ onDelete, onEdit, onOfflineAvailability }: MenuOptionsProps) => {
    const editLabel = `Edit ${getTerminology(ContentTerms.Subject, SystemTerms.Subject)}`;
    const deleteLabel = `Delete ${getTerminology(ContentTerms.Subject, SystemTerms.Subject)}`;
    const offlineLabel = 'Offline Availability';
    const DropdownList = onOfflineAvailability
        ? [editLabel, offlineLabel, deleteLabel]
        : [editLabel, deleteLabel];

    const handleMenuOptionsChange = (value: string) => {
        if (value === deleteLabel) {
            onDelete();
        } else if (value === editLabel) {
            onEdit();
        } else if (value === offlineLabel) {
            onOfflineAvailability?.();
        }
    };

    return (
        <MyDropdown dropdownList={DropdownList} onSelect={handleMenuOptionsChange}>
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
