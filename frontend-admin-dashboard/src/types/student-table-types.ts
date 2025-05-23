export interface StudentFilterRequest {
    name?: string;
    statuses?: string[];
    institute_ids?: string[];
    package_session_ids?: string[];
    group_ids?: string[];
    gender?: string[];
    session_expiry_days?: number[];
    sort_columns?: Record<string, string>;
}

export interface StudentAssessmentTable {
    id: string;
    full_name: string;
    package_session_id: string;
    institute_enrollment_id: string;
    linked_institute_name: string | null;
    gender: string;
    mobile_number: string;
    email: string;
    city: string;
    state: string | null;
}

// Response types
export interface StudentTable {
    id: string;
    username: string | null;
    user_id: string;
    email: string;
    full_name: string;
    address_line: string;
    region: string | null;
    city: string;
    pin_code: string;
    mobile_number: string;
    date_of_birth: string;
    gender: string;
    father_name: string;
    mother_name: string;
    parents_mobile_number: string;
    parents_email: string;
    linked_institute_name: string | null;
    created_at: string;
    updated_at: string;
    package_session_id: string;
    institute_enrollment_id: string;
    status: "ACTIVE" | "TERMINATED" | "INACTIVE";
    session_expiry_days: number;
    institute_id: string;
    expiry_date: number;
    face_file_id: string;
    attempt_id?: string;
    parents_to_mother_mobile_number: string;
    parents_to_mother_email: string;
    package_id?: string;
}

export interface StudentListResponse {
    content: StudentTable[];
    page_no: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
    last: boolean;
}
