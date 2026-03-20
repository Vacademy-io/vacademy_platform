export type PipelineStage = 'ENQUIRY' | 'APPLICATION' | 'ADMITTED';

export interface PipelineUser {
    pipeline_id: string;
    parent_user_id: string;
    parent_name: string | null;
    parent_email: string | null;
    parent_phone: string | null;
    child_user_id: string;
    student_name: string | null;
    current_stage: PipelineStage;
    source_type: string;
    enquiry_date: string | null;
    application_date: string | null;
    admission_date: string | null;
    enquiry_id: string | null;
    applicant_id: string | null;
}

export interface PipelineUsersResponse {
    content: PipelineUser[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
    first: boolean;
    last: boolean;
    empty: boolean;
}

export interface PipelineMetrics {
    institute_id: string;
    package_session_id: string | null;
    total_enquiries: number;
    total_applications: number;
    total_admissions: number;
    enquiry_to_application_conversion_rate: number;
    application_to_admission_conversion_rate: number;
    overall_conversion_rate: number;
    admissions_from_enquiry: number;
    admissions_from_application_only: number;
    direct_admissions: number;
}
