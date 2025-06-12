import { StudyLibrarySessionType } from "@/stores/study-library/use-study-library-store";
import { z } from "zod";

export interface DropdownItem {
    label: string;
    value: string;
    icon?: React.ReactNode;
    subItems?: DropdownItem[];
}

export type dropdownValue = string | StudyLibrarySessionType;

export interface myDropDownProps {
    currentValue?: dropdownValue;
    handleChange?: (value: string | StudyLibrarySessionType) => void;
    dropdownList: string[] | DropdownItem[] | StudyLibrarySessionType[];
    children?: React.ReactNode;
    onSelect?: (value: string) => void;
    placeholder?: string;
    error?: string;
    validation?: z.ZodSchema;
    onValidation?: (isValid: boolean) => void;
    disable?: boolean;
}
