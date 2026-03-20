import { Icon } from "@phosphor-icons/react";

// Chips Types
export interface ChipsWrapperProps {
    children?: React.ReactNode;
    className?: string;
}

export interface ChipsProps {
    label?: React.ReactNode;
    trailingIcon?: Icon;
    leadingIcon?: Icon;
    avatarAddress?: string;
    selected?: boolean;
    disabled?: boolean;
    className?: string;
}

export interface InputChipsProps extends ChipsProps {}

export interface FilterChipsProps {
    label: string;
    filterList: (string | number)[];
    selectedFilters: string[];
    setSelectedFilters?: React.Dispatch<React.SetStateAction<string[]>>;
    disabled?: boolean;
    clearFilters?: boolean;
}

// export interface StatusChipsProps {
//     label?: React.ReactNode;
//     status: ActivityStatus;
// }

// Status Types
export type ActivityStatus = "active" | "inactive" | "pending" | "error";
