export interface ErrorType {
    path: [number, string];
    message: string;
    resolution: string;
    currentVal: string;
    format: string;
}

export interface BulkUploadTableProps {
    data: SchemaFields[];
    isLoading: boolean;
    errors: ErrorType[];
    onEdit?: (rowIndex: number, columnId: string, value: string) => void;
}

// types/students/bulk-upload-types.ts
export interface SchemaFields {
    [key: string]: string | number | boolean;
}

export interface ValidationError {
    path: [number, string];
    message: string;
    resolution: string;
    currentVal: string;
    format: string;
}

export interface BulkUploadStoreState {
    csvData: SchemaFields[] | undefined;
    csvErrors: ValidationError[];
    isEditing: boolean;
    setCsvData: (data: SchemaFields[] | undefined) => void;
    setCsvErrors: (errors: ValidationError[]) => void;
    setIsEditing: (value: boolean) => void;
}

// types/students/bulk-upload-types.ts

export interface BulkUploadResponse {
    STATUS: string;
    ERROR: string;
    STATUS_MESSAGE: string;
    [key: string]: string;
}

export interface SubmitApiResponse {
    success: boolean;
    message: string;
    data: BulkUploadResponse[];
}

export interface AutoGenerateConfig {
    auto_generate_username: boolean;
    auto_generate_password: boolean;
    auto_generate_enrollment_id: boolean;
}

export interface OptionalFieldsConfig {
    include_address_line: boolean;
    include_region: boolean;
    include_city: boolean;
    include_pin_code: boolean;
    include_father_name: boolean;
    include_mother_name: boolean;
    include_parents_mobile_number: boolean;
    include_parents_email: boolean;
    include_linked_institute_name: boolean;
}

export interface ExpiryAndStatusConfig {
    include_expiry_days: boolean;
    include_enrollment_status: boolean;
    expiry_days: number;
    enrollment_status: string;
}

export interface CSVFormatConfig {
    auto_generate_config: AutoGenerateConfig;
    optional_fields_config: OptionalFieldsConfig;
    expiry_and_status_config: ExpiryAndStatusConfig;
}
