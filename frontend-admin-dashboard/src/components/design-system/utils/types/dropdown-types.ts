import { z } from 'zod';

export interface DropdownItem {
    label: string;
    value: string;
    icon?: React.ReactNode;
    subItems?: DropdownItem[];
}

export interface myDropDownProps {
    currentValue?: string;
    handleChange?: (value: string) => void;
    dropdownList: string[] | DropdownItem[];
    children?: React.ReactNode;
    onSelect?: (value: string) => void;
    placeholder?: string;
    error?: string;
    validation?: z.ZodSchema;
    onValidation?: (isValid: boolean) => void;
    disable?: boolean;
    className?: string;
    /** Extra classes for the dropdown menu panel (e.g. max-h-72 overflow-y-auto for long lists). */
    contentClassName?: string;
}
