export type MembershipStatus = 'ENDED' | 'ABOUT_TO_END' | 'LIFETIME' | 'ACTIVE';

// Policy Action Types
export type PolicyActionType = 'NOTIFICATION' | 'PAYMENT_ATTEMPT' | 'FINAL_EXPIRY';

export interface PolicyActionDetails {
    templateName?: string;
    [key: string]: unknown;
}

export interface PolicyAction {
    action_type: PolicyActionType;
    scheduled_date: string;
    description?: string;
    days_past_or_before_expiry: number;
    details?: PolicyActionDetails;
}

export interface ReenrollmentPolicy {
    allow_reenrollment_after_expiry: boolean;
    reenrollment_gap_in_days: number;
    next_eligible_enrollment_date: string | null;
}

export interface OnExpiryPolicy {
    waiting_period_in_days: number;
    enable_auto_renewal: boolean;
    next_payment_attempt_date: string | null;
    final_expiry_date: string | null;
}

export interface PolicyDetails {
    package_session_id: string;
    package_session_name: string;
    policy_actions: PolicyAction[];
    reenrollment_policy: ReenrollmentPolicy | null;
    on_expiry_policy: OnExpiryPolicy | null;
}

export interface MembershipFilterDTO {
    start_date_in_utc?: string;
    end_date_in_utc?: string;
    membership_statuses?: MembershipStatus[];
    package_session_ids?: string[];
    institute_id: string;
    sort_order?: Record<string, 'asc' | 'desc'>;
}

export interface UserDTO {
    id: string;
    username: string;
    email: string;
    full_name: string;
    address_line: string;
    city: string;
    region: string;
    pin_code: string;
    mobile_number: string;
    date_of_birth: string;
    gender: string;
    is_root_user: boolean;
    profile_pic_file_id: string;
    roles: string[];
    last_login_time: string;
}

export interface UserPlanDTO {
    id: string;
    user_id: string;
    payment_plan_id: string;
    plan_json: string | null;
    status: string;
    start_date: string;
    end_date: string;
    payment_option_json?: string;
    policy_details?: PolicyDetails[];
    payment_plan_dto?: {
        name: string;
        duration_months: number;
    };
}

export interface MembershipDetail {
    user_plan: UserPlanDTO | null;
    user_details: UserDTO | null;
    membership_status: MembershipStatus;
    calculated_end_date: string;
    policy_details?: PolicyDetails[];
    package_sessions?: Array<{
        session_name: string;
        package_name: string;
        level_name: string;
        /**
         * Optional display name coming from package_session.name.
         * When present, frontend prefers `package_name + " " + name`.
         */
        name?: string | null;
    }>;
}

export interface MembershipDetailsResponse {
    content: MembershipDetail[];
    pageable: any;
    totalPages: number;
    totalElements: number;
    last: boolean;
    first: boolean;
    size: number;
    number: number;
    sort: any;
    numberOfElements: number;
    empty: boolean;
}
