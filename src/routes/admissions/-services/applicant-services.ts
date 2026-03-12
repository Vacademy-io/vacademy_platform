import { BASE_URL } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

// API Base URL
const APPLICANT_URL = `${BASE_URL}/admin-core-service/v1/applicant`;

// Payload Types
export interface ApplicantFormData {
    parent_name: string;
    parent_phone: string;
    parent_email?: string;
    child_name: string;
    child_dob: string;
    child_gender: 'MALE' | 'FEMALE' | 'OTHER';
    address_line?: string;
    city?: string;
    pin_code?: string;
    father_name?: string;
    mother_name?: string;
    id_number?: string;
    id_type?: string;
    previous_school_name?: string;
    previous_school_board?: string;
    last_class_attended?: string;
    last_exam_result?: string;
    subjects_studied?: string;
    applying_for_class?: string;
    academic_year?: string;
    board_preference?: string;
    tc_number?: string;
    tc_issue_date?: string;
    tc_pending?: boolean;
    has_special_education_needs?: boolean;
    is_physically_challenged?: boolean;
    medical_conditions?: string;
    dietary_restrictions?: string;
    blood_group?: string;
    mother_tongue?: string;
    languages_known?: string;
    category?: string;
    nationality?: string;
}

export interface ApplyPayload {
    enquiry_id: string | null;
    institute_id: string;
    session_id: string;
    destination_package_session_id: string;
    source: 'INSTITUTE';
    source_id: string;
    form_data: ApplicantFormData;
    custom_field_values?: Record<string, string>;
}

export interface ApplyResponse {
    applicant_id: string;
    tracking_id: string;
    current_stage: string;
    status: string;
    message: string;
}

/**
 * Submit applicant registration
 */
export const applyForAdmission = async (payload: ApplyPayload): Promise<ApplyResponse> => {
    const response = await authenticatedAxiosInstance.post(`${APPLICANT_URL}/apply`, payload);
    return response.data;
};

// List Applicants Types
export interface ApplicantListFilters {
    institute_id?: string;
    source?: string;
    source_id?: string;
    application_stage_id?: string;
    package_session_ids?: string[];
    overall_statuses?: string[];
    search?: string;
    name?: string;
    student_name?: string;
}

export interface PackageSession {
    package_session_id: string;
    session_name: string;
    level_name: string;
    package_name: string;
    group_name: string;
    start_time: string;
    status: string;
}

export interface StudentData {
    user_id: string;
    full_name: string;
    gender: string;
    date_of_birth: string;
    father_name?: string;
    mother_name?: string;
    address_line?: string;
    city?: string;
    pin_code?: string;
    previous_school_name?: string;
    applying_for_class?: string;
    academic_year?: string;
}

export interface ParentData {
    user_id: string;
    full_name: string;
    email: string;
    mobile_number: string;
    address_line?: string;
    city?: string;
    pin_code?: string;
}

export interface ApplicationStage {
    stage_id: string;
    stage_name: string;
    source: string;
    source_id: string;
    type: string;
}

export interface Applicant {
    applicant_id: string;
    tracking_id: string;
    overall_status: string;
    application_stage_status: string;
    created_at: string;
    updated_at: string;
    application_stage: ApplicationStage;
    student_data: StudentData;
    parent_data: ParentData;
    package_session: PackageSession;
}

export interface ApplicantListResponse {
    content: Applicant[];
    pageable: any;
    totalElements: number;
    totalPages: number;
}

/**
 * Fetch applicant list with filters and pagination
 */
export const fetchApplicantList = async (
    filters: ApplicantListFilters,
    pageNo: number = 0,
    pageSize: number = 10
): Promise<ApplicantListResponse> => {
    const response = await authenticatedAxiosInstance.post(
        `${APPLICANT_URL}/list?pageNo=${pageNo}&pageSize=${pageSize}`,
        filters
    );
    return response.data;
};

// Application Stages Types
export interface PaymentConfig {
    order_id: string | null;
    display_text: string;
    gateway_rules: {
        fallback: string;
        preferred: string;
    };
    payment_status: string | null;
    payment_option_id: string;
}

export interface ApplicationStage {
    id: string;
    sequence: string;
    source: string;
    type: 'FORM' | 'PAYMENT' | string;
    stage_name: string;
    source_id: string;
    institute_id: string;
    config_json: string;
}

/**
 * Fetch application stages for institute
 */
export const fetchApplicationStages = async (
    instituteId: string,
    source: string,
    sourceId: string
): Promise<ApplicationStage[]> => {
    const response = await authenticatedAxiosInstance.get(
        `${BASE_URL}/admin-core-service/v1/application/stages`,
        {
            params: {
                instituteId,
                source,
                sourceId,
            },
        }
    );
    return response.data;
};

/**
 * Generate payment link for applicant
 */
export const generatePaymentLink = (
    instituteId: string,
    applicantId: string,
    paymentOptionId: string
): string => {
    return `https://learner.vacademy.io/admission/payment/${instituteId}/${applicantId}/${paymentOptionId}`;
};

/**
 * Fetch enquiry details by tracking ID
 */
export const fetchEnquiryDetails = async (enquiryTrackingId: string): Promise<any> => {
    const response = await authenticatedAxiosInstance.get(
        `${BASE_URL}/admin-core-service/applicant/v1/enquiry/details`,
        {
            params: {
                enquiryTrackingId,
            },
        }
    );
    return response.data;
};

// Query keys for React Query
export const applicantQueryKeys = {
    all: ['applicants'] as const,
    apply: () => [...applicantQueryKeys.all, 'apply'] as const,
    list: (filters: ApplicantListFilters, pageNo: number, pageSize: number) =>
        [...applicantQueryKeys.all, 'list', filters, pageNo, pageSize] as const,
    stages: (instituteId: string, source: string, sourceId: string) =>
        [...applicantQueryKeys.all, 'stages', instituteId, source, sourceId] as const,
};
