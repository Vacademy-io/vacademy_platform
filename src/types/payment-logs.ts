export interface PaymentLog {
    id: string;
    status: string;
    payment_status: 'PAID' | 'FAILED' | 'PAYMENT_PENDING' | null;
    user_id: string;
    vendor: string;
    vendor_id: string;
    date: string;
    currency: string;
    payment_amount: number;
    payment_specific_data: string | null;
    transaction_id?: string;
}

export interface EnrollInvite {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    invite_code: string;
    status: string;
    institute_id: string;
    vendor: string;
    vendor_id: string;
    currency: string;
    tag: string;
    learner_access_days: number | null;
    web_page_meta_data_json: string;
    is_bundled: boolean;
    institute_custom_fields: string | null;
    package_session_to_payment_options: string | null;
    setting_json: string;
}

export interface PaymentOption {
    id: string;
    name: string;
    status: string;
    source: string;
    source_id: string;
    tag: string | null;
    type: string;
    require_approval: boolean;
    unit: string | null;
    payment_plans: string | null;
    payment_option_metadata_json: string;
}

export interface PaymentPlanDto {
    id: string;
    name: string;
    status: string;
    validity_in_days: number;
    actual_price: number;
    elevated_price: number;
    currency: string;
    description: string;
    tag: string;
    feature_json: string;
    referral_option: string | null;
    referral_option_smapping_status: string | null;
}

export interface User {
    id: string;
    username: string;
    email: string;
    full_name: string;
    address_line: string;
    city: string;
    region: string | null;
    pin_code: string;
    mobile_number: string;
    date_of_birth: string | null;
    gender: string;
    password: string | null;
    profile_pic_file_id: string | null;
    roles: string[];
    last_login_time: string | null;
    root_user: boolean;
}

export interface UserPlan {
    id: string;
    user_id: string;
    payment_plan_id: string;
    plan_json: string | null;
    applied_coupon_discount_id: string | null;
    applied_coupon_discount_json: string | null;
    enroll_invite_id: string;
    payment_option_id: string;
    payment_option_json: string | null;
    status: string;
    created_at: string;
    updated_at: string;
    payment_logs: string | null;
    enroll_invite: EnrollInvite;
    payment_option: PaymentOption;
    payment_plan_dto: PaymentPlanDto;
    // New fields for source and subOrg details
    source?: 'USER' | 'SUB_ORG';
    sub_org_id?: string | null;
    sub_org_details?: {
        id: string;
        name: string;
        address: string;
    } | null;
}

export interface PaymentLogEntry {
    payment_log: PaymentLog;
    user_plan: UserPlan;
    current_payment_status: 'PAID' | 'FAILED' | 'NOT_INITIATED' | string;
    user: User;
}

export interface PaymentLogsResponse {
    content: PaymentLogEntry[];
    pageable: {
        pageNumber: number;
        pageSize: number;
        sort: {
            empty: boolean;
            sorted: boolean;
            unsorted: boolean;
        };
        offset: number;
        paged: boolean;
        unpaged: boolean;
    };
    totalPages: number;
    totalElements: number;
    last: boolean;
    size: number;
    number: number;
    sort: {
        empty: boolean;
        sorted: boolean;
        unsorted: boolean;
    };
    numberOfElements: number;
    first: boolean;
    empty: boolean;
}

export interface PaymentLogsRequest {
    institute_id: string;
    user_id?: string;
    start_date_in_utc?: string;
    end_date_in_utc?: string;
    payment_statuses?: string[];
    user_plan_statuses?: string[];
    enroll_invite_ids?: string[];
    package_session_ids?: string[];
    sources?: ('USER' | 'SUB_ORG')[]; // New field for filtering by source
    sort_columns?: Record<string, string>;
}

export interface PackageSession {
    id: string;
    package_session_name: string;
    start_date: string;
    end_date?: string;
}

export interface DateRangeFilter {
    label: string;
    startDate: Date;
    endDate: Date;
}

// Institute batch for session structure
export interface BatchForSession {
    id: string; // This is the package_session_id
    level: {
        id: string;
        level_name: string;
        duration_in_days: number;
        thumbnail_id: string | null;
    };
    session: {
        id: string;
        session_name: string;
        status: string;
        start_date: string;
    };
    start_time: string | null;
    status: string;
    is_org_associated?: boolean; // New field to check if batch is org associated
    is_parent?: boolean;
    parent_id?: string | null;
    package_dto: {
        id: string;
        package_name: string;
        thumbnail_file_id: string;
        is_course_published_to_catalaouge: boolean;
        course_preview_image_media_id: string;
        course_banner_media_id: string;
        course_media_id: string;
        why_learn_html: string;
        who_should_learn_html: string;
        about_the_course_html: string;
        tags: string[];
        course_depth: number;
        course_html_description_html: string;
    };
    group: {
        id: string;
        group_name: string;
        parent_group: string | null;
        is_root: boolean | null;
        group_value: string;
    } | null;
    read_time_in_minutes: number;
}

export interface PackageSessionFilter {
    packageId?: string;
    sessionId?: string;
    levelId?: string;
    packageSessionId?: string;
    packageSessionIds?: string[];
}
