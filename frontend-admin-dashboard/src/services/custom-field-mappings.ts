import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

/**
 * Thin client for the per-mapping custom field endpoints introduced by the
 * Custom Fields Revamp (2026-04). These endpoints operate on individual
 * `institute_custom_fields` rows — not on the institute setting JSON blob —
 * and are used by:
 *
 *   - The cascade-delete dialog in Settings → Custom Fields (lists every
 *     active mapping for one custom field across all features so the admin
 *     can pick which ones to soft-delete).
 *   - The per-feature pickers (Enroll Invite, Audience, Live Class,
 *     Assessment) — they call `syncFeatureCustomFields` after saving the
 *     parent feature, sending the FULL list of fields the admin picked.
 */

const BASE = '/admin-core-service/common/custom-fields';

/** One row from `institute_custom_fields` flattened for the cascade delete UI. */
export interface CustomFieldMappingUsage {
    /** institute_custom_fields.id — the primary key the soft-delete uses. */
    mapping_id: string;
    /** DEFAULT_CUSTOM_FIELD / ENROLL_INVITE / AUDIENCE_FORM / SESSION / ASSESSMENT */
    type: string;
    /** Parent feature instance id (null for DEFAULT_CUSTOM_FIELD). */
    type_id: string | null;
    /** Always 'ACTIVE' here, kept for forward-compatibility. */
    status: string;
}

/** Custom field type values used by the picker payload. */
export type CustomFieldFeatureType =
    | 'DEFAULT_CUSTOM_FIELD'
    | 'ENROLL_INVITE'
    | 'AUDIENCE_FORM'
    | 'SESSION'
    | 'ASSESSMENT';

/** Body for `POST /feature-fields`. Mirrors `InstituteCustomFieldDTO` on the backend. */
export interface InstituteCustomFieldPayload {
    custom_field?: {
        id?: string;
        field_name?: string;
        field_type?: string;
        config?: string;
        default_value?: string;
        is_mandatory?: boolean;
    } | null;
    field_id?: string | null;
    individual_order?: number | null;
    group_internal_order?: number | null;
    group_name?: string | null;
    is_mandatory?: boolean | null;
    status?: 'ACTIVE' | 'DELETED';
}

/**
 * Get every ACTIVE `institute_custom_fields` mapping for one custom field.
 * Used by the cascade-delete dialog.
 */
export const getCustomFieldUsages = async (
    instituteId: string,
    customFieldId: string
): Promise<CustomFieldMappingUsage[]> => {
    const response = await authenticatedAxiosInstance.get<CustomFieldMappingUsage[]>(
        `${BASE}/usages`,
        { params: { instituteId, customFieldId } }
    );
    return Array.isArray(response?.data) ? response.data : [];
};

/**
 * Soft-delete a list of `institute_custom_fields` rows by id. "Delete" here
 * only means status = DELETED — the master row and any custom_field_values
 * answers stay in place. Returns the server's success message.
 */
export const softDeleteCustomFieldMappings = async (
    mappingIds: string[]
): Promise<string> => {
    if (!mappingIds || mappingIds.length === 0) return 'no-op';
    const response = await authenticatedAxiosInstance.delete<string>(
        `${BASE}/mappings`,
        { data: mappingIds }
    );
    return response.data;
};

/**
 * Persist the full set of custom fields the admin picked for one feature
 * instance (Enroll Invite, Audience, Live Session, Assessment). The backend
 * handles insert / reactivate / soft-delete in one transaction so this is
 * the only call needed on save.
 */
export const syncFeatureCustomFields = async (
    instituteId: string,
    type: CustomFieldFeatureType,
    typeId: string,
    fields: InstituteCustomFieldPayload[]
): Promise<string> => {
    const response = await authenticatedAxiosInstance.post<string>(
        `${BASE}/feature-fields`,
        fields,
        { params: { instituteId, type, typeId } }
    );
    return response.data;
};
