import {
    DropdownItemType,
    DropdownValueType,
} from '@/components/common/students/enroll-manually/dropdownTypesForPackageItems';
import { StudentFilterRequest } from '@/types/student-table-types';
export interface StudentListSectionProps {
    filter?: string;
}

export interface FilterProps {
    filterDetails: {
        label: string;
        filters: { id: string; label: string }[];
    };
    onFilterChange?: (values: { id: string; label: string }[]) => void;
    clearFilters?: boolean;
    filterId: FilterId;
    columnFilters?: { id: string; value: { id: string; label: string }[] }[];
    setColumnFilters?: (values: { id: string; value: { id: string; label: string }[] }[]) => void;
}

export type FilterId = 'session' | 'batch' | 'statuses' | 'gender' | 'session_expiry_days';

export interface FilterConfig {
    id: FilterId; // Change this line
    title: string;
    filterList: { id: string; label: string }[];
}

export interface StudentFiltersProps {
    currentSession: DropdownItemType;
    sessionList: DropdownItemType[];
    sessions?: { id: string; name: string }[];
    filters: FilterConfig[];
    searchInput: string;
    searchFilter: string;
    columnFilters: { id: string; value: { id: string; label: string }[] }[];
    clearFilters: boolean;
    getActiveFiltersState: () => boolean;
    onSessionChange: (value: DropdownValueType) => void;
    onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onSearchEnter: () => void;
    onClearSearch: () => void;
    onFilterChange: (filterId: string, values: { id: string; label: string }[]) => void;
    onFilterClick: () => void;
    onClearFilters: () => void;
    appliedFilters: StudentFilterRequest;
    page: number;
    pageSize: number;
    isAssessment?: boolean;
    totalElements?: number;
}

// types/students/student-types.ts
export interface Student {
    id: string;
    username: string;
    user_id: string;
    email: string;
    full_name: string;
    address_line: string;
    region: string;
    city: string;
    pin_code: string;
    mobile_number: string;
    date_of_birth: string;
    gender: string;
    father_name: string;
    mother_name: string;
    parents_mobile_number: string;
    parents_email: string;
    linked_institute_name: string;
    created_at: string;
    updated_at: string;
}

export interface StudentListResponse {
    content: Student[];
    page_no: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
    last: boolean;
}

export interface CsvRow {
    [key: string]: string;
}

export interface ValidationError {
    path: [number, string];
    message: string;
    resolution: string;
    currentVal: string;
    format: string;
}

export interface ValidationResult {
    data: CsvRow[];
    errors: ValidationError[];
}

export interface StudentSearchBoxProps {
    searchInput: string;
    searchFilter: string;
    onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onSearchEnter: () => void;
    onClearSearch: () => void;
}

export interface StudentSearchBoxProps {
    searchInput: string;
    searchFilter: string;
    onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onSearchEnter: () => void;
    onClearSearch: () => void;
}
