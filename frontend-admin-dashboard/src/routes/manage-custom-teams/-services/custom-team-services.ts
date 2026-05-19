import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    GRANT_USER_ACCESS,
    GET_ALL_FACULTY_V2,
    CREATE_SUB_ORG,
    GET_ALL_SETTINGS,
    SAVE_GENERIC_SETTING,
    ROLES_BASE,
    INVITE_USERS_URL,
    GET_SUB_ORGS,
    CREATE_SUB_ORG_WITH_SUBSCRIPTION,
    GET_SUB_ORG_SCOPED_INVITES,
    GET_SUB_ORG_SEAT_USAGE,
    GET_SUB_ORG_SUBSCRIPTION_STATUS,
    ADD_SUB_ORG_MEMBER,
    SUB_ORG_TEAM_LIST,
    SUB_ORG_TEAM_ADD,
    SUB_ORG_TEAM_REMOVE,
    SUB_ORG_TEAM_ACCESSIBLE,
    SUB_ORG_TEAM_ACCESSIBLE_GRANTS,
    SUB_ORG_TEAM_PENDING_INSTALLMENTS,
    GET_SUB_ORG_FINANCE_DETAIL,
    GET_INVOICES_BY_USER,
    BASE_URL,
} from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

export interface GrantUserAccessRequest {
    user_id: string;
    package_session_id?: string;
    subject_id?: string;
    status: 'ACTIVE' | 'INACTIVE';
    name: string;
    user_type: string;
    type_id: string;
    access_type: string;
    access_id: string;
    access_permission: string;
    linkage_type: 'DIRECT' | 'INHERITED' | 'PARTNERSHIP';
    suborg_id?: string;
}

export interface FacultyFilterRequest {
    name?: string;
    subjects?: string[];
    batches?: string[];
    status?: string[];
    sortColumns?: Record<string, 'ASC' | 'DESC'>;
    pageNo?: number;
    pageSize?: number;
}

export interface CreateSubOrgRequest {
    institute_name: string;
    email?: string;
    phone?: string;
    description?: string;
    institute_logo_file_id?: string;
}

export interface CustomRole {
    id: string;
    name: string;
    permissions: string[]; // IDs of permissions
}

/** Request body for POST /institute/{instituteId}/roles (Create) and PUT .../roles/{roleId} (Update) */
export interface CreateRoleDTO {
    name: string;
    permissionIds: string[];
}

export interface AssignFacultyRequest {
    user: {
        fullName: string;
        email: string;
        mobileNumber: string;
        countryCode?: string;
    };
    isNewUser: boolean;
    batchSubjectMappings?: Array<{
        batchId: string;
        subjectIds: string[];
    }>;
}

export interface InviteUserRequest {
    email: string;
    full_name: string;
    roles: string[];
    root_user: boolean;
}

export const inviteUser = async (data: InviteUserRequest) => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: INVITE_USERS_URL,
        params: { instituteId },
        data,
    });
    return response.data;
};

export const assignFacultyToSubjectsAndBatches = async (data: AssignFacultyRequest) => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: INVITE_USERS_URL,
        params: { instituteId },
        data,
    });
    return response.data;
};

export const grantUserAccess = async (data: GrantUserAccessRequest) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GRANT_USER_ACCESS,
        data,
    });
    return response.data;
};

export const getAllFacultyV2 = async (filters: FacultyFilterRequest) => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_ALL_FACULTY_V2,
        params: {
            instituteId,
            pageNo: filters.pageNo || 0,
            pageSize: filters.pageSize || 10,
        },
        data: {
            name: filters.name,
            subjects: filters.subjects,
            batches: filters.batches,
            status: filters.status,
            sortColumns: filters.sortColumns,
        },
    });
    return response.data;
};

export const createSubOrg = async (data: CreateSubOrgRequest) => {
    const parentInstituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: CREATE_SUB_ORG,
        params: { parentInstituteId },
        data,
    });
    return response.data;
};

export const getSubOrgs = async (parentInstituteId?: string) => {
    const id = parentInstituteId || getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_SUB_ORGS,
        params: { parentInstituteId: id },
    });
    return response.data;
};

export const getAllRoles = async () => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: `${ROLES_BASE}/${instituteId}/roles`,
    });
    return response.data;
};

export const createCustomRole = async (payload: CreateRoleDTO) => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: `${ROLES_BASE}/${instituteId}/roles`,
        data: payload,
    });
    return response.data;
};

export const updateCustomRole = async (roleId: string, payload: CreateRoleDTO) => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'PUT',
        url: `${ROLES_BASE}/${instituteId}/roles/${roleId}`,
        data: payload,
    });
    return response.data;
};

export const deleteCustomRole = async (roleId: string) => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'DELETE',
        url: `${ROLES_BASE}/${instituteId}/roles/${roleId}`,
    });
    return response.data;
};

// --- Sub-Org Subscription APIs ---

export interface CreateSubOrgSubscriptionRequest {
    sub_org_details: {
        institute_name: string;
        email?: string;
        phone?: string;
        institute_logo_file_id?: string;
    };
    package_session_ids: string[];
    payment_type: 'SUBSCRIPTION' | 'ONE_TIME' | 'FREE' | 'CPO';
    actual_price?: number;
    elevated_price?: number;
    currency?: string;
    member_count: number;
    validity_in_days: number;
    vendor?: string;
    vendor_id?: string;
    auth_roles?: string[];
    /** Custom roles the sub-org admin can later assign on /manage-suborg-teams.
     *  Empty / undefined = no restriction. */
    allowed_team_roles?: string[];
    /** Required when payment_type === 'CPO'. */
    complex_payment_option_id?: string;
}

export interface CreateSubOrgSubscriptionResponse {
    sub_org_id: string;
    enroll_invite_id: string;
    invite_code: string;
    short_url: string;
}

export interface SeatUsage {
    package_session_id: string;
    package_name: string;
    used_seats: number;
    total_seats: number;
}

export interface SubOrgSubscriptionStatus {
    sub_org_id: string;
    org_user_plan_status: string;
    seat_usages: SeatUsage[];
    invite_code: string;
    short_url: string;
}

export const createSubOrgWithSubscription = async (
    data: CreateSubOrgSubscriptionRequest
): Promise<CreateSubOrgSubscriptionResponse> => {
    const parentInstituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: CREATE_SUB_ORG_WITH_SUBSCRIPTION,
        params: { parentInstituteId },
        data,
    });
    return response.data;
};

/**
 * Replace the ALLOWED_TEAM_ROLES list for a sub-org. Pass an empty list to clear
 * (no restriction). Editable by the parent institute admin only.
 */
export const updateSubOrgTeamRoles = async (
    subOrgId: string,
    allowedTeamRoles: string[]
): Promise<{ sub_org_id: string; allowed_team_roles: string[] }> => {
    const parentInstituteId = getCurrentInstituteId();
    const url = `${BASE_URL}/admin-core-service/institute/v1/sub-org/${subOrgId}/team-roles`;
    const response = await authenticatedAxiosInstance({
        method: 'PATCH',
        url,
        params: { parentInstituteId },
        data: { allowed_team_roles: allowedTeamRoles },
    });
    return response.data;
};

export const getScopedInvites = async (subOrgId: string) => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_SUB_ORG_SCOPED_INVITES,
        params: { subOrgId, instituteId },
    });
    return response.data;
};

export const getSeatUsage = async (
    subOrgId: string,
    packageSessionId: string
): Promise<SeatUsage> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_SUB_ORG_SEAT_USAGE,
        params: { subOrgId, packageSessionId },
    });
    return response.data;
};

export const getSubscriptionStatus = async (
    subOrgId: string
): Promise<SubOrgSubscriptionStatus> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_SUB_ORG_SUBSCRIPTION_STATUS,
        params: { subOrgId, instituteId },
    });
    return response.data;
};

// --- Add User to Sub-Org ---

export interface AddSubOrgMemberInstallmentOverride {
    aft_installment_id: string;
    start_date?: string;
    due_date?: string;
    amount?: number;
    discount?: {
        type: 'PERCENTAGE' | 'FLAT';
        value: number;
        reason?: string;
    };
}

export interface AddSubOrgMemberCpoConfig {
    installment_overrides?: AddSubOrgMemberInstallmentOverride[];
    cpo_discount?: {
        type: 'PERCENTAGE' | 'FLAT';
        value: number;
        reason?: string;
    };
}

export interface AddSubOrgMemberRequest {
    user: {
        email: string;
        full_name: string;
        mobile_number?: string;
        roles: string[];
    };
    package_session_id?: string;
    /** Multi-PS variant — admin gets access to every PS in the list in one round-trip. */
    package_session_ids?: string[];
    sub_org_id: string;
    institute_id: string;
    comma_separated_org_roles: string;
    status?: string;

    // Optional manual offline-payment recording. Mirrors bulk/v3/assign non-CPO path.
    payment_mode?: 'SKIP' | 'OFFLINE';
    offline_payment_amount?: number;
    offline_payment_currency?: string;
    offline_payment_date?: string; // ISO
    offline_payment_reference?: string;
    generate_invoice?: boolean;

    // Per-learner payment-option override. When set to a CPO mirror id, the backend
    // generates SFPs + applies cpo_config + FIFO-allocates offline payment.
    payment_option_id?: string;
    cpo_config?: AddSubOrgMemberCpoConfig;
}

export interface AddSubOrgMemberResponse {
    user: {
        id: string;
        email: string;
        full_name: string;
    };
    mapping_id: string;
    message: string;
    payment_log_id?: string | null;
    invoice_id?: string | null;
}

export const addSubOrgMember = async (
    data: AddSubOrgMemberRequest
): Promise<AddSubOrgMemberResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: ADD_SUB_ORG_MEMBER,
        data,
    });
    return response.data;
};

// --- Sub-Org Team (custom-role) management ---

export interface SubOrgTeamListRequest {
    sub_org_id: string;
    institute_id: string;
    roles?: string[];
    status?: string[];
    name?: string;
    page_number?: number;
    page_size?: number;
}

export interface SubOrgTeamListResponse {
    content: Array<{
        userId: string;
        username?: string;
        fullName?: string;
        email?: string;
        mobileNumber?: string;
        roles?: Array<{ id: string; name: string; institute_id?: string; status?: string }>;
        [key: string]: unknown;
    }>;
    page_number: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
    last: boolean;
    first: boolean;
}

export const listSubOrgTeamMembers = async (
    data: SubOrgTeamListRequest
): Promise<SubOrgTeamListResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: SUB_ORG_TEAM_LIST,
        data,
    });
    return response.data;
};

export interface SubOrgTeamAddRequest {
    sub_org_id: string;
    institute_id: string;
    user: {
        email: string;
        full_name: string;
        mobile_number?: string;
    };
    role_name: string;
    role_id?: string;
    package_session_ids: string[];
    access_permission?: string;
}

export interface SubOrgTeamAddResponse {
    user_id: string;
    granted_count: number;
}

export const addSubOrgTeamMember = async (
    data: SubOrgTeamAddRequest
): Promise<SubOrgTeamAddResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: SUB_ORG_TEAM_ADD,
        data,
    });
    return response.data;
};

export interface SubOrgTeamRemoveRequest {
    sub_org_id: string;
    institute_id: string;
    user_id: string;
}

export const removeSubOrgTeamMember = async (
    data: SubOrgTeamRemoveRequest
): Promise<{ user_id: string; sub_org_id: string; deactivated_mappings: number }> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: SUB_ORG_TEAM_REMOVE,
        data,
    });
    return response.data;
};

export interface AccessibleSubOrg {
    id: string;
    name: string;
}

export const listAccessibleSubOrgs = async (
    instituteId: string
): Promise<AccessibleSubOrg[]> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: SUB_ORG_TEAM_ACCESSIBLE,
        params: { instituteId },
    });
    return response.data;
};

export interface AccessibleGrants {
    package_session_ids: string[];
}

/** Returns the caller's accessible package sessions for the Add Member form.
 *  Invite-level access is auto-linked server-side from the selected PSes — no client choice. */
export const listAccessibleGrants = async (
    instituteId: string
): Promise<AccessibleGrants> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: SUB_ORG_TEAM_ACCESSIBLE_GRANTS,
        params: { instituteId },
    });
    return response.data;
};

// --- Sub-Org Finance Detail (manage-sub-orgs detail panel) ---

export interface SubOrgInstallment {
    student_fee_payment_id: string;
    amount_expected: number;
    amount_paid: number;
    due_date?: string;
    status: string; // PENDING / PARTIAL_PAID / PAID / WAIVED / OVERDUE
}

export interface SubOrgAdminPayment {
    user_id?: string;
    full_name?: string;
    user_plan_id?: string;
    payment_type?: string;             // FREE / ONE_TIME / SUBSCRIPTION / CPO
    complex_payment_option_id?: string;
    user_plan_status?: string;
    start_date?: string;
    end_date?: string;
    total_amount?: number;
    paid_amount?: number;
    outstanding_amount?: number;
    installment_count?: number;
    pending_installments_count?: number;
    next_due?: SubOrgInstallment;
    installments?: SubOrgInstallment[];
}

export interface SubOrgLearnerRow {
    user_id: string;
    full_name?: string;
    package_session_id?: string;
    user_plan_id?: string;
    enrolled_date?: string;
    outstanding_amount?: number;
    pending_installments_count?: number;
    next_due?: SubOrgInstallment;
}

export interface SubOrgFinanceDetail {
    sub_org_id: string;
    sub_org_name?: string;
    admin_payment?: SubOrgAdminPayment;
    learners: SubOrgLearnerRow[];
    totals: {
        learner_count: number;
        total_outstanding: number;
    };
    seat_usage?: {
        used?: number;
        total?: number | null;
        remaining?: number | null;
    };
}

export const getSubOrgFinanceDetail = async (
    subOrgId: string,
    parentInstituteId?: string
): Promise<SubOrgFinanceDetail> => {
    const params: Record<string, string> = { subOrgId };
    if (parentInstituteId) params.parentInstituteId = parentInstituteId;
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_SUB_ORG_FINANCE_DETAIL,
        params,
    });
    return response.data;
};

// --- Sub-Org Team Pending Installments (manage-suborg-teams column) ---

export interface SubOrgTeamMemberInstallmentRow {
    user_id: string;
    outstanding_amount?: number;
    pending_installments_count?: number;
    total_installments?: number;
    next_due_date?: string;
    next_due_amount?: number;
    next_due_status?: string;
}

export interface SubOrgTeamPendingInstallments {
    sub_org_id: string;
    members: SubOrgTeamMemberInstallmentRow[];
}

export const getSubOrgTeamPendingInstallments = async (
    subOrgId: string,
    instituteId: string
): Promise<SubOrgTeamPendingInstallments> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: SUB_ORG_TEAM_PENDING_INSTALLMENTS,
        params: { subOrgId, instituteId },
    });
    return response.data;
};

// --- Invoices (per user) ---

export interface InvoiceSummary {
    id: string;
    invoiceNumber?: string;
    invoice_number?: string;
    totalAmount?: number;
    total_amount?: number;
    currency?: string;
    status?: string;
    invoice_date?: string;
    invoiceDate?: string;
    pdfUrl?: string;
    pdf_url?: string;
    fileId?: string;
    file_id?: string;
    [key: string]: unknown;
}

export const getInvoicesByUser = async (userId: string): Promise<InvoiceSummary[]> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_INVOICES_BY_USER(userId),
    });
    return Array.isArray(response.data) ? response.data : [];
};

/**
 * Force a browser save dialog for the invoice PDF.
 *
 * The URL we receive is a pre-signed S3 link (1-day TTL). Plain `<a download>` is a hint
 * only for cross-origin downloads and most browsers ignore it for S3, so we fetch the
 * PDF as a blob and trigger an in-page anchor click. If CORS blocks the fetch
 * (production-side S3 mis-config), we fall back to opening the URL in a new tab so the
 * user can still save from the browser PDF viewer.
 */
export const downloadInvoicePdf = async (url: string, filename: string): Promise<void> => {
    try {
        const resp = await fetch(url, { credentials: 'omit' });
        if (!resp.ok) throw new Error(`Invoice fetch ${resp.status}`);
        const blob = await resp.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Give the browser a moment to start the download before revoking.
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
};

/** Builds a stable filename for invoice downloads. */
export const buildInvoiceFilename = (invoice: InvoiceSummary): string => {
    const num =
        (invoice.invoice_number as string | undefined)
        || (invoice.invoiceNumber as string | undefined)
        || invoice.id;
    return `invoice-${num}.pdf`;
};
