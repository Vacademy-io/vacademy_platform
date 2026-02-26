export interface LevelDTO {
    id: string;
    level_name: string;
}

export interface SessionDTO {
    id: string;
    session_name: string;
}

export interface PackageDTO {
    id: string;
    package_name: string;
    thumbnail_file_id: string | null;
    is_course_published_to_catalaouge: boolean;
    course_preview_image_media_id: string | null;
    course_banner_media_id: string | null;
    course_media_id: string | null;
    why_learn_html: string | null;
    who_should_learn_html: string | null;
    about_the_course_html: string | null;
    tags: string[];
    course_depth: number;
    course_html_description_html: string | null;
    drip_condition_json: string | null;
}

export interface GroupDTO {
    id: string;
    group_name: string;
}

export interface PackageSessionDTO {
    id: string;
    level: LevelDTO;
    session: SessionDTO;
    start_time: string;
    status: string;
    package_dto: PackageDTO;
    group: GroupDTO | null;
    read_time_in_minutes: number;
    is_org_associated: boolean;
    is_parent?: boolean;
    parent_id?: string | null;
}

export interface PaginatedBatchesResponse {
    content: PackageSessionDTO[];
    page_number: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
    first: boolean;
    last: boolean;
    has_next: boolean;
    has_previous: boolean;
}

export interface BatchesSummaryResponse {
    total_batches: number;
    has_org_associated: boolean;
    packages: { id: string; name: string }[];
    levels: { id: string; name: string }[];
    sessions: { id: string; name: string }[];
}

export interface PackageFilterRequest {
    page: number;
    size: number;
    sessionId?: string;
    levelId?: string;
    packageId?: string;
    search?: string;
    statuses?: string[];
    sortBy?: string;
    sortDirection?: string;
}

// Enroll Invite Types
export interface EnrollInvite {
    id: string;
    name: string;
    invite_code: string;
    status: string;
    start_date: string;
    end_date: string | null;
    institute_id: string;
    vendor: string;
    vendor_id: string;
    currency: string;
    tag: string;
    package_session_ids: string[];
    web_page_meta_data_json: string;
    created_at?: string;
    updated_at?: string;
}

export interface EnrollInviteListResponse {
    content: EnrollInvite[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
    first: boolean;
    last: boolean;
    empty: boolean;
}

export interface PaymentPlan {
    id: string;
    name: string;
    status: string;
    validity_in_days: number;
    actual_price: number;
    elevated_price: number;
    currency: string;
    description: string;
    tag: string | null;
    feature_json: string;
    member_count: number;
}

export interface PaymentOption {
    id: string;
    name: string;
    status: string;
    source: string;
    source_id: string;
    tag: string;
    type: string;
    require_approval: boolean;
    unit: string | null;
    payment_plans: PaymentPlan[];
    payment_option_metadata_json: string | null;
}

export interface PackageSessionPaymentOption {
    id: string;
    package_session_id: string;
    enroll_invite_id: string;
    status: string;
    payment_option: PaymentOption;
}

export interface EnrollInviteDetail extends EnrollInvite {
    learner_access_days: number | null;
    is_bundled: boolean | null;
    institute_custom_fields: any[];
    package_session_to_payment_options: PackageSessionPaymentOption[];
    setting_json: string | null;
}
// Instructor Types
export interface InstructorDTO {
    id: string;
    full_name: string;
    email: string | null;
    username: string | null;
    mobile_number: string | null;
}

export interface FacultyAssignmentResponse {
    batch_ids?: string[];
    // assignments might be another structure if using the array format
    id?: string;
    batch_id?: string;
}

// Edit/Update Request Types

export interface UpdateCourseRequest {
    package_name: string;
    thumbnail_file_id: string | null;
    is_course_published_to_catalaouge: boolean;
    course_preview_image_media_id: string | null;
    course_banner_media_id: string | null;
    course_media_id: string | null;
    why_learn_html: string | null;
    who_should_learn_html: string | null;
    about_the_course_html: string | null;
    tags: string[];
    course_depth: number;
    course_html_description_html: string | null;
    drip_condition_json?: string | null;
}

export interface FacultyAssignmentRequest {
    user_id: string;
    batch_ids: string[];
    subject_ids: string[];
}

export interface UpdateInventoryRequest {
    max_seats: number;
}

export interface UpdateEnrollInviteRequest {
    id: string;
    name: string;
    start_date: string;
    end_date: string | null;
    status: string;
    institute_id: string;
    invite_code?: string;
}

export interface UpdateInvitePaymentOptionItem {
    old_package_session_payment_option_id?: string;
    new_package_session_payment_option: {
        payment_option: { id: string };
        package_session_id: string;
        status: string;
    };
}

export interface UpdateInvitePaymentOptionRequest {
    enroll_invite_id: string;
    update_payment_options: UpdateInvitePaymentOptionItem[];
}

export interface UpdatePaymentPlan {
    id?: string;
    actual_price: number;
    elevated_price: number;
    currency: string;
    validity_in_days: number;
}

export interface UpdatePaymentOptionRequest {
    id: string;
    name: string;
    status: string;
    type: string;
    require_approval: boolean;
    payment_plans: UpdatePaymentPlan[];
}
