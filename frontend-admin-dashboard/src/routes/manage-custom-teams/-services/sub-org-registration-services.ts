import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    SUB_ORG_REGISTRATION_TEMPLATE_CREATE,
    SUB_ORG_REGISTRATION_TEMPLATE_LIST,
    SUB_ORG_REGISTRATION_TEMPLATE_STATUS,
    SUB_ORG_REGISTRATION_TEMPLATE_DETAIL,
    SUB_ORG_REGISTRATION_TEMPLATE_UPDATE,
    SUB_ORG_REGISTRATION_REGISTRATIONS,
    SUB_ORG_REGISTRATION_REGISTRATION_FACETS,
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
    /** Helper text shown under the Organization Name field in the wizard (<=300 chars). */
    org_name_hint?: string;
    /**
     * When true the wizard collects Address Line 1/2, City, State and Pincode
     * (line 2 optional) and stamps them onto the spawned institute.
     */
    collect_address?: boolean;
    /**
     * Custom copy for the identity-verification step (<=1000 chars); supports
     * [label](url) links. Omit for the backend's default DigiLocker note.
     */
    kyc_instructions?: string;
    /**
     * Completion precedence: completion_redirect_url -> auto-redirect; else
     * completion_message/button -> custom success page; else the default success
     * copy + "Go to Admin Portal" button. Message <=2000 chars, [label](url) links.
     */
    completion_message?: string;
    /** Completion CTA label (<=100 chars) — must be sent together with completion_button_url. */
    completion_button_label?: string;
    /** Completion CTA target — must start with https:// and pair with completion_button_label. */
    completion_button_url?: string;
    /** Auto-redirect target after completion — must start with https://; wins over message/button. */
    completion_redirect_url?: string;
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
    /** Helper text under the wizard's Organization Name field. */
    org_name_hint?: string | null;
    /** Whether the wizard collects the full address (line1/line2/city/state/pincode). */
    collect_address?: boolean | null;
    /** Custom identity-verification step copy; null/absent = backend default note. */
    kyc_instructions?: string | null;
    /** Custom completion-page copy; see CreateRegistrationTemplateRequest for precedence. */
    completion_message?: string | null;
    completion_button_label?: string | null;
    completion_button_url?: string | null;
    /** Auto-redirect target after completion; wins over message/button. */
    completion_redirect_url?: string | null;
}

export interface SubOrgRegistrationRow {
    id: string;
    status: string;
    org_name?: string | null;
    admin_name?: string | null;
    admin_email?: string | null;
    admin_phone?: string | null;
    /** Collected only when the template had "Collect full address" on; null otherwise. */
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    /** Seats of the spawned sub-org — null until the registration spawns one.
     *  used = active learner members; total = the template's member_count cap. */
    used_seats?: number | null;
    total_seats?: number | null;
    spawned_sub_org_id?: string | null;
    created_at?: string | number | null;
    /** PENDING | VERIFIED | CONSENT_DENIED | EXPIRED | FAILED; null = not started / not required. */
    kyc_status?: string | null;
}

/** Optional filters + 0-based page for the registrations listing. */
export interface ListTemplateRegistrationsParams {
    templateInviteId: string;
    instituteId: string;
    page?: number;
    size?: number;
    /** Match any of the selected cities (exact, case-insensitive). Empty/undefined = no filter. */
    cities?: string[];
    /** Match any of the selected states. */
    states?: string[];
    /** Match any of the selected pincodes. */
    pincodes?: string[];
    /**
     * Per-custom-field filters: custom_field id → selected values. A registration must
     * match at least one selected value for EACH field with a non-empty selection.
     */
    customFieldFilters?: Record<string, string[]>;
    /** Exact registration status (DRAFT | OTP_VERIFIED | PENDING_PAYMENT | COMPLETED | FAILED). */
    status?: string;
    /** Free-text search across org name / admin name / admin email. */
    search?: string;
}

/** One filterable custom field + the distinct values its registrants submitted. */
export interface CustomFieldFacet {
    id: string;
    label: string;
    values: string[];
}

/** Distinct values present in a template's registrations — drive the listing filters. */
export interface RegistrationFacets {
    cities: string[];
    states: string[];
    pincodes: string[];
    /** One entry per form-collected custom field worth filtering on. */
    customFields: CustomFieldFacet[];
}

/** Drop blank entries; return undefined when nothing is selected so the param is omitted. */
const cleanList = (values?: string[]): string[] | undefined => {
    if (!values) return undefined;
    const cleaned = values.map((v) => v.trim()).filter(Boolean);
    return cleaned.length ? cleaned : undefined;
};

/** Flatten {fieldId: [v1, v2]} into ["fieldId:v1", "fieldId:v2"] for repeated `customField` params. */
const encodeCustomFieldFilters = (
    filters?: Record<string, string[]>
): string[] | undefined => {
    if (!filters) return undefined;
    const pairs: string[] = [];
    Object.entries(filters).forEach(([fieldId, values]) => {
        (values || []).forEach((value) => {
            const v = value?.trim();
            if (fieldId && v) pairs.push(`${fieldId}:${v}`);
        });
    });
    return pairs.length ? pairs : undefined;
};

/** Raw Spring Page<> passthrough (camelCase wrapper, snake_case rows). */
export interface SubOrgRegistrationPage {
    content: SubOrgRegistrationRow[];
    total_pages: number;
    total_elements: number;
    /** 0-based current page. */
    page_no: number;
    page_size: number;
    last: boolean;
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

export const getRegistrationFacets = async (
    templateInviteId: string,
    instituteId: string
): Promise<RegistrationFacets> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: SUB_ORG_REGISTRATION_REGISTRATION_FACETS,
        params: { templateInviteId, instituteId },
    });
    const data = response.data ?? {};
    return {
        cities: Array.isArray(data.cities) ? data.cities : [],
        states: Array.isArray(data.states) ? data.states : [],
        pincodes: Array.isArray(data.pincodes) ? data.pincodes : [],
        customFields: Array.isArray(data.custom_fields)
            ? data.custom_fields
                  .filter((f: CustomFieldFacet) => f && f.id && Array.isArray(f.values))
                  .map((f: CustomFieldFacet) => ({
                      id: f.id,
                      label: f.label || f.id,
                      values: f.values,
                  }))
            : [],
    };
};

export const listTemplateRegistrations = async ({
    templateInviteId,
    instituteId,
    page = 0,
    size = 10,
    cities,
    states,
    pincodes,
    customFieldFilters,
    status,
    search,
}: ListTemplateRegistrationsParams): Promise<SubOrgRegistrationPage> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: SUB_ORG_REGISTRATION_REGISTRATIONS,
        // indexes:null → arrays serialize as repeated keys (cities=A&cities=B), which
        // Spring binds to List<String>. Bracketed keys (the axios default) would not.
        paramsSerializer: { indexes: null },
        params: {
            templateInviteId,
            instituteId,
            page,
            size,
            cities: cleanList(cities),
            states: cleanList(states),
            pincodes: cleanList(pincodes),
            customField: encodeCustomFieldFilters(customFieldFilters),
            status: status || undefined,
            search: search?.trim() || undefined,
        },
    });
    // Backend returns a raw Spring Page<> (camelCase wrapper). Normalize to our
    // snake_case shape; tolerate a bare array in case an older API is hit.
    const data = response.data;
    if (Array.isArray(data)) {
        return {
            content: data,
            total_pages: 1,
            total_elements: data.length,
            page_no: 0,
            page_size: data.length,
            last: true,
        };
    }
    return {
        content: Array.isArray(data?.content) ? data.content : [],
        total_pages: data?.totalPages ?? 1,
        total_elements: data?.totalElements ?? 0,
        page_no: data?.number ?? 0,
        page_size: data?.size ?? size,
        last: data?.last ?? true,
    };
};

/**
 * Fetch EVERY registration matching the given filters (ignoring UI pagination) for CSV
 * export. Walks all pages at a large page size so even long lists come back complete.
 */
export const fetchAllTemplateRegistrations = async (
    params: Omit<ListTemplateRegistrationsParams, 'page' | 'size'>
): Promise<SubOrgRegistrationRow[]> => {
    const PAGE = 500;
    const first = await listTemplateRegistrations({ ...params, page: 0, size: PAGE });
    const rows = [...first.content];
    for (let p = 1; p < first.total_pages; p++) {
        const next = await listTemplateRegistrations({ ...params, page: p, size: PAGE });
        rows.push(...next.content);
    }
    return rows;
};
