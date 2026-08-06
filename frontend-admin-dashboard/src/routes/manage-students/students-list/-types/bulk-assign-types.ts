// ==================== REQUEST TYPES ====================

import type { DiscountSpec } from './cpo-side-view-types';

/**
 * Per-installment override carried inside `cpo_config.installment_overrides`.
 * Identifies the template row via `aft_installment_id` (the `i_id` column on
 * the freshly-generated SFP). Any field can be null = "leave default."
 *
 * If both `amount` and `discount` are set, `amount` wins and the discount's
 * reason is recorded as the manual-override audit reason.
 */
export interface InstallmentOverride {
    aft_installment_id: string;
    start_date?: string | null;
    due_date?: string | null;
    amount?: number | null;
    discount?: DiscountSpec | null;
}

/**
 * Structured CPO config for one assignment. When set, supersedes the legacy
 * `cpo_payment_amount` / `cpo_payment_mode` fields on the same AssignmentItem.
 */
export interface CpoEnrollmentConfig {
    installment_overrides?: InstallmentOverride[];
    cpo_discount?: DiscountSpec | null;
    payment_mode?: 'OFFLINE' | 'SKIP' | null;
    payment_amount?: number | null;
    payment_reference?: string | null;
}

export interface AssignmentItem {
    package_session_id: string;
    enroll_invite_id?: string | null;
    payment_option_id?: string | null;
    plan_id?: string | null;
    access_days?: number | null;

    /**
     * CPO only. Amount admin records as paid now ([1, totalCpoFee]).
     * Null or 0 → no payment recorded; learner can pay each installment later.
     */
    cpo_payment_amount?: number | null;

    /** CPO only. "OFFLINE" if recording a payment, "SKIP" (default) otherwise. */
    cpo_payment_mode?: 'OFFLINE' | 'SKIP' | null;

    /**
     * Structured CPO config (per-installment overrides + CPO discount + offline
     * payment). When non-null, supersedes the two flat cpo_payment_* fields.
     */
    cpo_config?: CpoEnrollmentConfig | null;

    /**
     * Org-associated package sessions only. The sub-organization the learner joins.
     * Without it the backend falls back to minting a brand-new sub-org from custom-field
     * answers, which would duplicate the organization on every admin enrollment.
     */
    sub_org_id?: string | null;

    /** CSV written to `ssigm.comma_separated_org_roles` — "ADMIN,LEARNER" or "ADMIN". */
    sub_org_roles?: string | null;

    /** Set instead of `sub_org_id` to create the organization as part of the enrollment. */
    new_sub_org?: {
        name: string;
        email?: string | null;
        mobile_number?: string | null;
    } | null;
}

export interface AssignOptions {
    duplicate_handling?: 'SKIP' | 'ERROR' | 'RE_ENROLL';
    notify_learners?: boolean;
    send_credentials?: boolean;
    transaction_id?: string;
    payment_date?: string;
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

    // Payment fields
    payment_date?: string;

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
    /**
     * SOFT-mode only. The "last access date" the learner keeps access until
     * (ISO `yyyy-MM-dd`). When omitted, SOFT preserves the plan's own expiry.
     * Ignored for HARD.
     */
    access_till_date?: string | null;
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
    payment_option_type?: string | null;
    cpo_total_amount?: number | null;
    cpo_installment_count?: number | null;
    cpo_initial_payment_amount?: number | null;
    cpo_initial_payment_mode?: 'OFFLINE' | 'SKIP' | null;
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
    /** Set when type='CPO'. Points at the underlying ComplexPaymentOption row. */
    complex_payment_option_id?: string | null;
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
 * Identifies a person by either creating a brand-new user or linking to an
 * already-existing one. Used inside a chip's guardian-link sub-form to
 * describe the *counterpart* (the student, when the chip is a guardian; or
 * the guardian, when the chip is a student).
 */
export type ParentLinkPersonInput =
    | { kind: 'create_new'; fullName: string; email: string; mobileNumber: string }
    | { kind: 'link_existing'; userId: string; name: string; email: string };

/**
 * Per-chip guardian-link choice made in Step 1 of the bulk-assign dialog.
 * Mirrors the backend `/admin-core-service/parent-link/v1/link` request:
 * - 'is_guardian': this chip IS the guardian; we create/link the STUDENT
 *   under them (backend `direction: PARENT_ADDS_STUDENT`). The chip's own
 *   target user id must be swapped for the resolved `student_user_id` before
 *   enrollment — the guardian itself is never enrolled.
 * - 'add_guardian': this chip is the student being enrolled; we optionally
 *   create/link a GUARDIAN for them (backend `direction: STUDENT_ADDS_PARENT`).
 *   Purely additive — the chip itself remains the enrollment target.
 */
export type ParentLinkChoice =
    | { mode: 'none' }
    | { mode: 'is_guardian'; student: ParentLinkPersonInput }
    | { mode: 'add_guardian'; guardian: ParentLinkPersonInput };

/**
 * A learner selected for bulk enroll.
 * - 'existing': already has an account in the system (by userId)
 * - 'new': to be created by the backend via new_users[]
 */
export type SelectedLearner =
    | { type: 'existing'; userId: string; email: string; name: string; parentLink?: ParentLinkChoice }
    | { type: 'new'; newUser: NewUserRow; parentLink?: ParentLinkChoice };

/** True once a guardian-link sub-form has enough data to resolve (create-new needs name+email, link-existing needs a picked user). */
export const isParentLinkPersonValid = (p: ParentLinkPersonInput | undefined): boolean => {
    if (!p) return false;
    if (p.kind === 'create_new') return !!p.fullName.trim() && /\S+@\S+\.\S+/.test(p.email);
    return !!p.userId;
};

/** A chip is ready to advance out of Step 1 once its (optional) guardian-link choice is either 'none' or fully filled in. */
export const isChipGuardianReady = (l: SelectedLearner): boolean => {
    const pl = l.parentLink;
    if (!pl || pl.mode === 'none') return true;
    if (pl.mode === 'is_guardian') return isParentLinkPersonValid(pl.student);
    return isParentLinkPersonValid(pl.guardian);
};

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

    /**
     * Structured CPO config carried per package-session in the bulk wizard:
     * per-installment date/amount/discount overrides, whole-CPO discount,
     * and the offline-payment fields. Sent verbatim as `cpo_config` on the
     * AssignmentItem. Applies to every learner selected in the bulk run.
     */
    cpoConfig?: CpoEnrollmentConfig;

    /**
     * True when `package_session.is_org_associated` — enrolling into it requires choosing the
     * sub-organization the learner belongs to (the sub-org step of the wizard).
     */
    isOrgAssociated?: boolean;

    /** Sub-org step: the existing organization picked for this course. */
    subOrgId?: string | null;
    subOrgName?: string | null;

    /** Sub-org step: 'LEARNER' → "ADMIN,LEARNER", 'ADMIN' → admin-only access. */
    subOrgRole?: SubOrgRoleChoice;

    /** Sub-org step: set instead of `subOrgId` when creating a new organization inline. */
    newSubOrg?: NewSubOrgInput;
}

/**
 * Role the enrolled member holds inside the sub-org. These map onto the three CSV values
 * actually stored on `ssigm.comma_separated_org_roles`:
 * - 'STAFF' → `LEARNER` — ordinary member: course access only, no admin rights. The default,
 *   and by far the most common value in practice.
 * - 'ADMIN' → `ADMIN,LEARNER` — runs the organization's roster AND takes the course.
 * - 'ADMIN_ONLY' → `ADMIN` — manages the roster without any course access.
 *
 * Note `ADMIN,LEARNER` grants BOTH — anything containing ADMIN makes the member an
 * organization admin (see findAdminsBySubOrg's `LIKE '%ADMIN%'`). Picking 'STAFF' must
 * therefore emit `LEARNER` alone, never `ADMIN,LEARNER`.
 */
export type SubOrgRoleChoice = 'STAFF' | 'ADMIN' | 'ADMIN_ONLY';

export interface NewSubOrgInput {
    name: string;
    email?: string;
    mobileNumber?: string;
}

/** Serialises a role choice to the CSV the backend stores on the SSIGM. */
export const subOrgRolesCsv = (role: SubOrgRoleChoice | undefined): string => {
    if (role === 'ADMIN') return 'ADMIN,LEARNER';
    if (role === 'ADMIN_ONLY') return 'ADMIN';
    return 'LEARNER';
};

/** A sub-org already present in a package session, from /sub-org/v1/by-package-session. */
export interface PackageSessionSubOrg {
    sub_org_id: string;
    name: string | null;
    email: string | null;
    mobile_number: string | null;
    member_count: number | null;
    admins: Array<{
        user_id: string | null;
        name: string | null;
        email: string | null;
        role: string | null;
    }>;
}

/**
 * A course in the sub-org step is ready once the admin either picked an existing
 * organization or typed a name for a new one.
 */
export const isSubOrgSelectionReady = (ps: SelectedPackageSession): boolean => {
    if (!ps.isOrgAssociated) return true;
    if (ps.subOrgId) return true;
    return !!ps.newSubOrg?.name?.trim();
};

/** Global bulk enroll options (Step 3) */
export interface BulkEnrollOptions {
    duplicateHandling: 'SKIP' | 'ERROR' | 'RE_ENROLL';
    notifyLearners: boolean;
    sendCredentials: boolean;
    transactionId: string;
    paymentDate: string;
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
