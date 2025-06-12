import { z } from "zod";

export interface myDropDownProps {
    currentValue?: string;
    handleChange?: (value: string) => void;
    dropdownList: string[];
    children?: React.ReactNode;
    onSelect?: (value: string) => void;
    placeholder?: string;
    error?: string;
    validation?: z.ZodSchema;
    onValidation?: (isValid: boolean) => void;
}
