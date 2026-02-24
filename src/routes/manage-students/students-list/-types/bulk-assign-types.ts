// ==================== REQUEST TYPES ====================

export interface AssignmentItem {
    package_session_id: string;
    enroll_invite_id?: string | null;
    payment_option_id?: string | null;
    plan_id?: string | null;
    access_days?: number | null;
}

export interface AssignOptions {
    duplicate_handling?: 'SKIP' | 'ERROR' | 'RE_ENROLL';
    notify_learners?: boolean;
    transaction_id?: string;
    dry_run?: boolean;
}

export interface CustomFieldValue {
    custom_field_id: string;
    value: string;
}

export interface NewUserRow {
    email: string;
    full_name: string;
    mobile_number?: string;
    username?: string;
    password?: string;
    gender?: string;
    roles?: string[];

    // Additional user profile fields
    date_of_birth?: string;
    address_line?: string;
    city?: string;
    region?: string;
    pin_code?: string;

    // Learner extra details (parent/guardian info)
    fathers_name?: string;
    mothers_name?: string;
    parents_mobile_number?: string;
    parents_email?: string;
    parents_to_mother_mobile_number?: string;
    parents_to_mother_email?: string;
    linked_institute_name?: string;

    // Institute custom fields
    custom_field_values?: CustomFieldValue[];
}

export interface UserFilterDTO {
    source_package_session_id?: string;
    statuses?: string[];
    institute_id?: string;
}

export interface BulkAssignRequest {
    institute_id: string;
    user_ids?: string[];
    new_users?: NewUserRow[];
    user_filter?: UserFilterDTO | null;
    assignments: AssignmentItem[];
    options?: AssignOptions;
}

export interface DeassignOptions {
    mode?: 'SOFT' | 'HARD';
    notify_learners?: boolean;
    dry_run?: boolean;
}

export interface BulkDeassignRequest {
    institute_id: string;
    user_ids?: string[];
    package_session_ids: string[];
    options?: DeassignOptions;
}

// ==================== RESPONSE TYPES ====================

export interface AssignResultItem {
    user_id: string | null;
    user_email: string | null;
    package_session_id: string;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    action_taken: 'CREATED' | 'RE_ENROLLED' | 'NONE';
    mapping_id?: string;
    user_plan_id?: string;
    enroll_invite_id_used?: string;
    message?: string;
}

export interface BulkAssignResponse {
    dry_run: boolean;
    summary: {
        total_requested: number;
        successful: number;
        failed: number;
        skipped: number;
        re_enrolled: number;
    };
    results: AssignResultItem[];
}

export interface DeassignResultItem {
    user_id: string;
    user_email: string | null;
    package_session_id: string;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    action_taken: 'SOFT_CANCELED' | 'HARD_TERMINATED' | 'NONE';
    user_plan_id?: string;
    message?: string;
    warning?: string;
}

export interface BulkDeassignResponse {
    dry_run: boolean;
    summary: {
        total_requested: number;
        successful: number;
        failed: number;
        skipped: number;
    };
    results: DeassignResultItem[];
}

// ==================== INVITE TYPES ====================

export interface PaymentPlan {
    id: string;
    name: string;
    actual_price: number;
    elevated_price: number;
    validity_in_days: number | null;
    status: string;
    tag: string | null;
}

export interface PaymentOption {
    id: string;
    name: string;
    status: string;
    type: string;
    tag: string | null;
    require_approval: boolean;
    payment_plans: PaymentPlan[];
}

export interface PackageSessionToPaymentOption {
    id: string;
    package_session_id: string;
    enroll_invite_id: string;
    status: string;
    payment_option: PaymentOption;
    cpo_id: string | null;
}

export interface EnrollInviteDTO {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    invite_code: string;
    status: string;
    institute_id: string;
    tag: string | null;
    learner_access_days: number | null;
    is_bundled: boolean;
    package_session_to_payment_options: PackageSessionToPaymentOption[];
}

export interface EnrollInviteProjection {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    invite_code: string;
    status: string;
    institute_id: string;
    tag: string | null;
    created_at: string;
    updated_at: string;
    short_url: string | null;
    package_session_ids: string[];
}

// ==================== UI WIZARD TYPES ====================

/** User returned from autosuggest endpoint */
export interface AutosuggestUser {
    id: string;
    username: string;
    email: string;
    full_name?: string;
    mobile_number?: string;
}

/**
 * A learner selected for bulk enroll.
 * - 'existing': already has an account in the system (by userId)
 * - 'new': to be created by the backend via new_users[]
 */
export type SelectedLearner =
    | { type: 'existing'; userId: string; email: string; name: string }
    | { type: 'new'; newUser: NewUserRow };

/** A package session selected in Step 2 with its Step 3 invite config */
export interface SelectedPackageSession {
    packageSessionId: string;
    courseName: string;
    sessionName: string;
    levelName: string;
    /** null = auto-resolve DEFAULT invite on backend */
    enrollInviteId?: string | null;
    enrollInviteName?: string;
    accessDays?: number | null;
}

/** Global bulk enroll options (Step 3) */
export interface BulkEnrollOptions {
    duplicateHandling: 'SKIP' | 'ERROR' | 'RE_ENROLL';
    notifyLearners: boolean;
}

/** Full 4-step wizard state */
export interface BulkAssignWizardState {
    selectedLearners: SelectedLearner[];
    selectedPackageSessions: SelectedPackageSession[];
    options: BulkEnrollOptions;
    previewResponse: BulkAssignResponse | null;
}

/** Which learner selection tab is active in Step 1 */
export type LearnerSourceMode = 'search' | 'csv' | 'manual' | 'from_course';
