import { MyButton } from "@/components/design-system/button";
import { MyDropdown } from "@/components/design-system/dropdown";
import { DotsThree } from "phosphor-react";

interface MenuOptionsProps {
    onDelete: () => void;
    onEdit: () => void;
}

export const MenuOptions = ({ onDelete, onEdit }: MenuOptionsProps) => {
    const DropdownList = ["Edit Subject", "Delete Subject"];

    const handleMenuOptionsChange = (value: string) => {
        if (value === "Delete Subject") {
            onDelete();
        } else if (value === "Edit Subject") {
            onEdit();
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
