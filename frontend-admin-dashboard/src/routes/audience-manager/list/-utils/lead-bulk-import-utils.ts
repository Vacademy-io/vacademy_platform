/**
 * Utilities for bulk CSV lead import.
 */

export interface CustomFieldConfig {
    id: string;
    fieldName: string;
    fieldKey: string;
    fieldType: string;
    isMandatory: boolean;
    defaultValue?: string;
    formOrder: number;
}

/**
 * Parse the custom fields JSON string passed via search params into a typed array.
 */
export function parseCustomFieldsFromJson(json: string | undefined): CustomFieldConfig[] {
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map((field: any) => {
                const cf = field.custom_field || field;
                return {
                    id: cf.id || field.id,
                    fieldName: cf.fieldName || cf.field_name || field.field_name || '',
                    fieldKey: cf.fieldKey || cf.field_key || field.field_key || '',
                    fieldType: cf.fieldType || cf.field_type || field.field_type || 'TEXT',
                    isMandatory: cf.isMandatory ?? field.isMandatory ?? true,
                    defaultValue: cf.defaultValue || field.defaultValue || '',
                    formOrder: cf.formOrder || field.formOrder || 0,
                } as CustomFieldConfig;
            })
            .filter((f: CustomFieldConfig) => f.id && f.fieldName)
            .sort((a: CustomFieldConfig, b: CustomFieldConfig) => a.formOrder - b.formOrder);
    } catch {
        return [];
    }
}

/**
 * Generate a CSV template string with headers from the campaign's custom fields.
 */
export function generateCsvTemplate(customFields: CustomFieldConfig[]): string {
    const headers = customFields.map((f) => f.fieldName);
    const sampleRow = customFields.map((f) => {
        const key = f.fieldKey.toLowerCase();
        const name = f.fieldName.toLowerCase();
        const isEmail = key.includes('email') || name.includes('email');
        const isPhone =
            key.includes('phone') || key.includes('mobile') || name.includes('phone') || name.includes('mobile');
        if (isEmail) return 'john@example.com';
        if (isPhone) return '+919876543210';
        if (!isEmail && !isPhone && (key.includes('name') || name.includes('name'))) return 'John Doe';
        return '';
    });

    const escape = (v: string) => {
        if (v.includes(',') || v.includes('"') || v.includes('\n')) {
            return `"${v.replace(/"/g, '""')}"`;
        }
        return v;
    };

    return [headers.map(escape).join(','), sampleRow.map(escape).join(',')].join('\n');
}

/**
 * Build a map from CSV column header (normalized) to custom field ID.
 * Matching is case-insensitive, whitespace-trimmed, with underscore normalization.
 */
export function buildHeaderToFieldIdMap(
    csvHeaders: string[],
    customFields: CustomFieldConfig[]
): Map<string, string> {
    const normalize = (s: string) =>
        s
            .trim()
            .toLowerCase()
            .replace(/[\s_-]+/g, '');

    const map = new Map<string, string>();

    for (const header of csvHeaders) {
        const normalizedHeader = normalize(header);
        // Try exact match on fieldName, then fieldKey
        const match = customFields.find(
            (f) => normalize(f.fieldName) === normalizedHeader || normalize(f.fieldKey) === normalizedHeader
        );
        if (match) {
            map.set(header, match.id);
        }
    }

    return map;
}

/**
 * Extract email, phone, and full name from a CSV row using the header-to-fieldId map.
 */
export function extractUserInfoFromRow(
    row: Record<string, string>,
    headerToFieldId: Map<string, string>,
    customFields: CustomFieldConfig[]
): { email: string; phone: string; fullName: string } {
    let email = '';
    let phone = '';
    let fullName = '';

    const fieldIdToConfig = new Map(customFields.map((f) => [f.id, f]));

    for (const [header, fieldId] of headerToFieldId) {
        const config = fieldIdToConfig.get(fieldId);
        if (!config) continue;

        const value = (row[header] || '').trim();
        if (!value) continue;

        const key = config.fieldKey.toLowerCase();
        const name = config.fieldName.toLowerCase();

        if (!email && (key.includes('email') || name.includes('email'))) {
            email = value;
        }
        if (
            !phone &&
            (key.includes('phone') || key.includes('mobile') || name.includes('phone') || name.includes('mobile'))
        ) {
            phone = value;
        }
        const isEmailField = key.includes('email') || name.includes('email');
        const isPhoneField =
            key.includes('phone') || key.includes('mobile') || name.includes('phone') || name.includes('mobile');
        if (
            !fullName &&
            !isEmailField &&
            !isPhoneField &&
            (key.includes('full_name') ||
                key.includes('fullname') ||
                name.includes('full name') ||
                name.includes('name'))
        ) {
            fullName = value;
        }
    }

    return { email, phone, fullName };
}

/**
 * Validate a single CSV row. Returns array of error messages (empty = valid).
 */
export function validateRow(
    row: Record<string, string>,
    headerToFieldId: Map<string, string>,
    customFields: CustomFieldConfig[]
): string[] {
    const errors: string[] = [];
    const fieldIdToConfig = new Map(customFields.map((f) => [f.id, f]));

    // Check mandatory fields have values
    for (const [header, fieldId] of headerToFieldId) {
        const config = fieldIdToConfig.get(fieldId);
        if (!config) continue;

        const value = (row[header] || '').trim();
        if (config.isMandatory && !value) {
            errors.push(`${config.fieldName} is required`);
        }
    }

    // Validate email format if present
    for (const [header, fieldId] of headerToFieldId) {
        const config = fieldIdToConfig.get(fieldId);
        if (!config) continue;
        const key = config.fieldKey.toLowerCase();
        const name = config.fieldName.toLowerCase();
        const value = (row[header] || '').trim();

        if (value && (key.includes('email') || name.includes('email'))) {
            if (!isValidEmail(value)) {
                errors.push(`Invalid email: ${value}`);
            }
        }
    }

    return errors;
}

export function isValidEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function isValidMobile(v: string): boolean {
    return /^\+?[0-9]{7,15}$/.test(v.replace(/[\s-]/g, ''));
}

/**
 * Check which mandatory columns are missing from the CSV headers.
 */
export function getMissingMandatoryColumns(
    headerToFieldId: Map<string, string>,
    customFields: CustomFieldConfig[]
): string[] {
    const mappedFieldIds = new Set(headerToFieldId.values());
    return customFields
        .filter((f) => f.isMandatory && !mappedFieldIds.has(f.id))
        .map((f) => f.fieldName);
}
