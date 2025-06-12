import { z } from "zod";
import { AddCourseData } from "../../study-library/add-course/add-course-form";

export interface DropdownItem {
    label: string;
    value: string;
    icon?: React.ReactNode;
    subItems?: DropdownItem[];
}

export interface DropdownItemType {
    id: string;
    name: string;
}

export type DropdownValueType = string | DropdownItem | DropdownItemType;

export interface myDropDownProps {
    currentValue?: DropdownValueType;
    handleChange?: (value: DropdownValueType) => void;
    dropdownList: DropdownValueType[];
    children?: React.ReactNode;
    onSelect?: (value: DropdownValueType) => void;
    placeholder?: string;
    error?: string;
    validation?: z.ZodSchema;
    onValidation?: (isValid: boolean) => void;
    disable?: boolean;
    required?: boolean;
    showAddCourseButton?: boolean;
    onAddCourse?: ({ requestData }: { requestData: AddCourseData }) => void;
}
