import { MyButton } from '@/components/design-system/button';
import { MyDropdown } from '@/components/design-system/dropdown';
import { DotsThree } from '@phosphor-icons/react';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

interface MenuOptionsProps {
    onDelete: () => void;
    onEdit: () => void;
}

export const MenuOptions = ({ onDelete, onEdit }: MenuOptionsProps) => {
    const editLabel = `Edit ${getTerminology(ContentTerms.Module, SystemTerms.Module)}`;
    const deleteLabel = `Delete ${getTerminology(ContentTerms.Module, SystemTerms.Module)}`;
    const DropdownList = [editLabel, deleteLabel];

    const handleMenuOptionsChange = (value: string) => {
        if (value === deleteLabel) {
            onDelete();
        } else if (value === editLabel) {
            onEdit();
        }
    };

    return (
        <div className="menu-options-container">
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
        </div>
    );
};
