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
    payment_type: 'SUBSCRIPTION' | 'ONE_TIME' | 'FREE';
    actual_price?: number;
    elevated_price?: number;
    currency?: string;
    member_count: number;
    validity_in_days: number;
    vendor?: string;
    vendor_id?: string;
    auth_roles?: string[];
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

export interface AddSubOrgMemberRequest {
    user: {
        email: string;
        full_name: string;
        mobile_number?: string;
        roles: string[];
    };
    package_session_id: string;
    sub_org_id: string;
    institute_id: string;
    comma_separated_org_roles: string;
    status?: string;
}

export interface AddSubOrgMemberResponse {
    user: {
        id: string;
        email: string;
        full_name: string;
    };
    mapping_id: string;
    message: string;
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
    invite_ids?: string[];
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
    invites: Array<{ id: string; name: string }>;
}

/** Returns the caller's accessible PSes + invites for the Add Member form. */
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
