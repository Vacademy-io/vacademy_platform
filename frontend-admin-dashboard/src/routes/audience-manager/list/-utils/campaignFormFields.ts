/**
 * Field conversion for the audience campaign form — the two directions a
 * registration form's custom fields travel:
 *
 *   API  → editor   `convertExistingCustomFields`
 *   editor → API    `convertFieldsToPayload`
 *
 * Kept out of the component so both directions are unit-testable: a field's
 * type, its options and its position all have to survive the round trip, and
 * every one of them has been silently lost at some point.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    configHoldsOptions,
    isOptionFieldType,
    parseFieldOptionsForForm,
} from './parseFieldOptions';

export const generateKeyFromName = (name: string): string =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

export const mapApiFieldTypeToUi = (type?: string): string => {
    const normalized = (type || '').toLowerCase();
    if (normalized === 'select') return 'dropdown';
    if (normalized === 'textfield') return 'text';
    return normalized || 'text';
};

const parseFieldsInput = (fields?: any[] | string | null) => {
    if (!fields) {
        return null;
    }

    if (Array.isArray(fields)) {
        return fields;
    }

    if (typeof fields === 'string') {
        try {
            const parsed = JSON.parse(fields);
            if (Array.isArray(parsed)) {
                return parsed;
            }
            // console.warn('⚠️ [convertExistingCustomFields] Parsed custom fields is not an array');
        } catch (error) {
            console.error(
                '❌ [convertExistingCustomFields] Failed to parse custom fields JSON:',
                error
            );
        }
    }

    return null;
};

export const convertExistingCustomFields = (fields?: any[] | string | null) => {
    const normalizedFields = parseFieldsInput(fields);

    if (!normalizedFields || normalizedFields.length === 0) {
        console.log('📋 [convertExistingCustomFields] No custom fields to convert');
        return null;
    }

    // Seeded keys: Full Name / Email / Phone Number must stay locked even in
    // edit mode. The previous code hardcoded `oldKey: false` which let admins
    // delete these system fields when editing an existing audience campaign.
    const SEEDED_KEYS = ['full_name', 'name', 'email', 'phone_number', 'phone', 'mobile_number'];
    const SEEDED_NAMES = ['full name', 'name', 'email', 'phone number', 'phone', 'mobile number'];

    const converted = normalizedFields
        .map((field, index) => {
            const meta = field?.custom_field || {};
            const fieldName = meta.fieldName || field.field_name || `Field ${index + 1}`;
            const fieldKey = meta.fieldKey || generateKeyFromName(fieldName);
            const normalizedKey = fieldKey ? fieldKey.toLowerCase() : '';
            const normalizedName = (fieldName || '').toLowerCase();
            const isSeeded =
                SEEDED_KEYS.includes(normalizedKey) || SEEDED_NAMES.includes(normalizedName);
            // The builder stores options as a JSON array; comma-splitting it turned one
            // option into several fragments and re-saving persisted the fragments.
            const uiType = mapApiFieldTypeToUi(meta.fieldType || field.type);
            const configOptions = isOptionFieldType(uiType)
                ? parseFieldOptionsForForm(
                      meta.config,
                      field.id || meta.id || field.field_id || index
                  )
                : undefined;

            // Preserve status from API - default to ACTIVE if not present
            const fieldStatus = field.status || 'ACTIVE';

            const convertedField = {
                id: field.id || meta.id || field.field_id || `${index}`,
                _id: meta.id || field.id || field.field_id,
                field_id: field.field_id || meta.id || field.id,
                type: uiType,
                name: fieldName,
                oldKey: isSeeded,
                isRequired:
                    typeof meta.isMandatory === 'boolean'
                        ? meta.isMandatory
                        : field.isRequired ?? true,
                key: fieldKey,
                // Order by the per-form mapping order (individual_order) so the editor
                // matches what the public form renders. Fall back to the master formOrder
                // (1-based) only when the mapping has no order, then to array index.
                order:
                    typeof field.individual_order === 'number'
                        ? field.individual_order
                        : typeof meta.formOrder === 'number'
                          ? Math.max(meta.formOrder - 1, 0)
                          : index,
                options: configOptions,
                // Preserve all original field data for payload
                status: fieldStatus,
                institute_id: field.institute_id,
                type_id: field.type_id,
                group_name: field.group_name || meta.groupName,
                individual_order: field.individual_order,
                group_internal_order: field.group_internal_order,
                // Store full custom_field object for payload
                custom_field_data: meta,
            };

            return convertedField;
        })
        .filter((field) => field.status !== 'DELETED') // Filter out deleted fields from display
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((field, index) => ({
            ...field,
            order: index,
        }));

    return converted;
};

export const mapFieldTypeToPayload = (type?: string) => {
    if (!type) return 'TEXT';
    const normalized = type.toLowerCase();
    switch (normalized) {
        case 'text':
        case 'textfield':
            return 'TEXT';
        // Not folded into TEXT: the picker offers Text Area as its own type, so
        // collapsing it here made every saved text area come back as a text field.
        case 'textarea':
            return 'TEXTAREA';
        case 'number':
            return 'NUMBER';
        case 'email':
            return 'EMAIL';
        case 'date':
            return 'DATE';
        case 'dropdown':
        case 'select':
            return 'DROPDOWN';
        default:
            return normalized.toUpperCase();
    }
};

export const convertFieldsToPayload = (fields: any[], instituteId: string) => {
    if (!Array.isArray(fields) || fields.length === 0) return [];

    return fields.map((field, index) => {
        const options =
            Array.isArray(field.options) && field.options.length > 0
                ? field.options.map((option: any) => option.value?.trim()).filter(Boolean)
                : undefined;

        // Use existing field data if available (from API), otherwise create new structure
        const fieldId = field.id || field._id || field.field_id;
        const customFieldData = field.custom_field_data || field.custom_field || {};

        // Build the payload according to the required structure
        const payload: any = {
            ...(fieldId && { id: fieldId }),
            field_id: field.field_id || customFieldData.id || fieldId,
            institute_id: field.institute_id || instituteId,
            type: '',
            type_id: '',
            group_name: field.group_name || customFieldData.groupName || '',
            status: field.status || 'ACTIVE', // Preserve status (ACTIVE or DELETED)
            // Per-form required-ness. The public form still renders the master
            // flag, but the mapping is the per-form home for it, so keep it in
            // step instead of leaving it at its insert-time default.
            is_mandatory: Boolean(
                typeof field.isRequired === 'boolean'
                    ? field.isRequired
                    : field.custom_field_data?.isMandatory ?? true
            ),
            // Persist the current on-screen order so reordering in the editor
            // actually updates the effective per-form order the public form reads.
            // The array index is the display order and stays dense after a delete,
            // whereas a carried-over `field.order` leaves holes.
            individual_order: index,
            group_internal_order: field.group_internal_order ?? 0,
            custom_field: {
                ...((customFieldData.id || field._id) && {
                    id: customFieldData.id || field._id,
                }),
                ...(customFieldData.guestId && { guestId: customFieldData.guestId }),
                fieldKey: field.key || customFieldData.fieldKey || generateKeyFromName(field.name),
                fieldName: field.name || customFieldData.fieldName || `Field ${index + 1}`,
                fieldType: mapFieldTypeToPayload(field.type || customFieldData.fieldType),
                defaultValue: customFieldData.defaultValue || '',
                // Switching a choice field to a plain type must not leave its old
                // option list behind; a settings object (help text, file limits)
                // belongs to the field itself and is preserved.
                config: options
                    ? JSON.stringify(
                          options.map((v: string, i: number) => ({
                              id: i + 1,
                              value: v,
                              label: v,
                          }))
                      )
                    : configHoldsOptions(customFieldData.config)
                      ? ''
                      : customFieldData.config || '',
                // Only read for brand-new master rows — the backend leaves form_order
                // alone on an existing field so one form cannot reshuffle the
                // shared catalog every other form inherits.
                formOrder: index + 1,
                isMandatory: Boolean(
                    typeof field.isRequired === 'boolean'
                        ? field.isRequired
                        : customFieldData.isMandatory ?? true
                ),
                isFilter: customFieldData.isFilter ?? false,
                isSortable: customFieldData.isSortable ?? false,
                isHidden: customFieldData.isHidden ?? false,
                ...(customFieldData.createdAt && { createdAt: customFieldData.createdAt }),
                ...(customFieldData.updatedAt && { updatedAt: customFieldData.updatedAt }),
                ...(customFieldData.sessionId && { sessionId: customFieldData.sessionId }),
                ...(customFieldData.liveSessionId && {
                    liveSessionId: customFieldData.liveSessionId,
                }),
                customFieldValue: customFieldData.customFieldValue || '',
                groupName: field.group_name || customFieldData.groupName || '',
                groupInternalOrder: field.group_internal_order ?? 0,
                individualOrder: index,
            },
        };

        return payload;
    });
};
