import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    SUB_ORG_REGISTRATION_TEMPLATE_CREATE,
    SUB_ORG_REGISTRATION_TEMPLATE_LIST,
    SUB_ORG_REGISTRATION_TEMPLATE_STATUS,
    SUB_ORG_REGISTRATION_TEMPLATE_DETAIL,
    SUB_ORG_REGISTRATION_TEMPLATE_UPDATE,
    SUB_ORG_REGISTRATION_REGISTRATIONS,
} from '@/constants/urls';

/**
 * One per-template custom form field, in admin_core's InstituteCustomFieldDTO shape.
 *
 * The OUTER keys are snake_case (`InstituteCustomFieldDTO` is @JsonNaming(SnakeCase)),
 * but the NESTED `custom_field` object maps to `common.dto.CustomFieldDTO`, which has
 * NO naming annotation — Jackson expects camelCase there (`fieldName`, `fieldType`,
 * `config`, `formOrder`, `isMandatory`). This mirrors the proven-working audience
 * campaign payload (see create-audience-campaign.ts) which hits the same DTO pair.
 * `institute_id`/`type`/`type_id` are re-stamped server-side by
 * `syncFeatureCustomFields`, so `type_id` can be omitted at create time.
 */
export interface RegistrationTemplateCustomField {
    institute_id: string;
    type: 'ENROLL_INVITE';
    type_id?: string;
    individual_order?: number;
    is_mandatory?: boolean;
    status?: 'ACTIVE';
    custom_field: {
        id?: string;
        fieldKey?: string;
        fieldName: string;
        fieldType: string; // TEXT | NUMBER | EMAIL | PHONE | DROPDOWN
        config?: string; // dropdown options as JSON: [{id,value,label}]
        formOrder?: number;
        isMandatory?: boolean;
    };
}

export interface CreateRegistrationTemplateRequest {
    name: string;
    package_session_ids: string[];
    member_count?: number;
    validity_in_days?: number;
    auth_roles?: string[];
    admin_permissions?: string[];
    allowed_team_roles?: string[];
    tnc_file_id?: string;
    /** Consent statements (required checkboxes on the T&C step); inline links via [label](url). */
    tnc_consent_items?: string[];
    max_registrations?: number;
    institute_custom_fields?: RegistrationTemplateCustomField[];
    /** Defaults to FREE server-side; FREE keeps the fresh-option backend path. */
    payment_type?: 'FREE' | 'ONE_TIME' | 'SUBSCRIPTION';
    /** REQUIRED for paid — an institute-level PaymentOption id of matching type. */
    payment_option_id?: string;
    /** REQUIRED for paid — payment gateway vendor name. */
    vendor?: string;
    vendor_id?: string;
    /** Optional — backend falls back to the picked option's first active plan currency. */
    currency?: string;
    /**
     * DigiLocker KYC documents the registering admin must verify — `["AADHAAR"]` or
     * `["AADHAAR","PAN"]` (backend validates AADHAAR must be included). Omit/empty = no KYC step.
     */
    kyc_documents?: string[];
}

export interface CreateRegistrationTemplateResponse {
    template_id: string;
    invite_code: string;
}

export interface RegistrationTemplateListItem {
    id: string;
    name: string;
    invite_code: string;
    status: string; // ACTIVE | INACTIVE
    created_at?: string | number | null;
    completed_count?: number;
    total_attempts?: number;
    max_registrations?: number | null;
    steps?: string[] | null;
}

/**
 * Full editable config of one registration template (GET .../template/{id}/detail).
 * Outer keys snake_case; nested `custom_field` camelCase — same DTO pair as create.
 */
export interface TemplateDetail {
    template_id: string;
    name: string;
    invite_code: string;
    status: string; // ACTIVE | INACTIVE
    package_session_ids: string[];
    member_count: number | null;
    validity_in_days: number | null;
    auth_roles: string[];
    admin_permissions: string[];
    allowed_team_roles: string[];
    tnc_file_id: string | null;
    tnc_consent_items: string[] | null;
    max_registrations: number | null;
    kyc_documents: string[] | null;
    /** Immutable after creation — the PUT endpoint ignores all payment fields. */
    payment_type: string; // FREE | ONE_TIME | SUBSCRIPTION
    payment_option_id: string | null;
    vendor: string | null;
    currency: string | null;
    institute_custom_fields: RegistrationTemplateCustomField[] | null;
}

export interface SubOrgRegistrationRow {
    id: string;
    status: string;
    org_name?: string | null;
    admin_name?: string | null;
    admin_email?: string | null;
    admin_phone?: string | null;
    spawned_sub_org_id?: string | null;
    created_at?: string | number | null;
    /** PENDING | VERIFIED | CONSENT_DENIED | EXPIRED | FAILED; null = not started / not required. */
    kyc_status?: string | null;
}

export const createRegistrationTemplate = async (
    instituteId: string,
    data: CreateRegistrationTemplateRequest
): Promise<CreateRegistrationTemplateResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: SUB_ORG_REGISTRATION_TEMPLATE_CREATE,
        params: { instituteId },
        data,
    });
    return response.data;
};

export const getRegistrationTemplateDetail = async (
    templateId: string,
    instituteId: string
): Promise<TemplateDetail> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: SUB_ORG_REGISTRATION_TEMPLATE_DETAIL(templateId),
        params: { instituteId },
    });
    return response.data;
};

/**
 * PUT full-config update. Body is the same CreateRegistrationTemplateRequest, but the
 * backend IGNORES payment fields (payment_type/payment_option_id/vendor/vendor_id/currency)
 * — payment config is immutable after creation. The invite_code never changes.
 */
export const updateRegistrationTemplate = async (
    templateId: string,
    instituteId: string,
    data: CreateRegistrationTemplateRequest
): Promise<CreateRegistrationTemplateResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'PUT',
        url: SUB_ORG_REGISTRATION_TEMPLATE_UPDATE(templateId),
        params: { instituteId },
        data,
    });
    return response.data;
};

export const listRegistrationTemplates = async (
    instituteId: string
): Promise<RegistrationTemplateListItem[]> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: SUB_ORG_REGISTRATION_TEMPLATE_LIST,
        params: { instituteId },
    });
    return Array.isArray(response.data) ? response.data : [];
};

export const updateRegistrationTemplateStatus = async (
    templateId: string,
    status: 'ACTIVE' | 'INACTIVE',
    instituteId: string
): Promise<{ template_id: string; status: string }> => {
    const response = await authenticatedAxiosInstance({
        method: 'PATCH',
        url: SUB_ORG_REGISTRATION_TEMPLATE_STATUS(templateId),
        params: { status, instituteId },
    });
    return response.data;
};

export const listTemplateRegistrations = async (
    templateInviteId: string,
    instituteId: string
): Promise<SubOrgRegistrationRow[]> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: SUB_ORG_REGISTRATION_REGISTRATIONS,
        params: { templateInviteId, instituteId },
    });
    return Array.isArray(response.data) ? response.data : [];
};
