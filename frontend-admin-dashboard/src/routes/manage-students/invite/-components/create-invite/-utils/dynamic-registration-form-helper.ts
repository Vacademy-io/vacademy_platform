import z from 'zod';
import { isBlankPhone, isValidPhoneValue } from '@/lib/phone-validation';

export interface AssessmentCustomFieldOpenRegistration {
    id: string;
    field_name: string;
    field_key: string;
    field_order: number;
    comma_separated_options: string;
    status: string;
    is_mandatory: boolean;
    field_type: string;
    created_at: string;
    updated_at: string;
}

/**
 * Builds the zod schema for a non-dropdown custom field's `value`. Phone fields
 * (`field_type === 'phone'`, the same type the renderer maps to PhoneNumberInput)
 * get country-aware validation; everything else keeps the generic string rule.
 */
const buildValueSchema = (field: AssessmentCustomFieldOpenRegistration): z.ZodTypeAny => {
    const requiredMsg = `${field.field_name} is required`;
    if (field.field_type === 'phone') {
        const invalidMsg = `Enter a valid ${field.field_name.toLowerCase()} for the selected country`;
        return field.is_mandatory
            ? z.string().min(1, requiredMsg).refine(isValidPhoneValue, invalidMsg)
            : z.string().refine((v) => isBlankPhone(v) || isValidPhoneValue(v), invalidMsg);
    }
    return field.is_mandatory ? z.string().min(1, requiredMsg) : z.string();
};

export const getDynamicSchema = (formFields: AssessmentCustomFieldOpenRegistration[]) => {
    const dynamicSchema = z.object(
        formFields.reduce<Record<string, z.ZodTypeAny>>((schema, field) => {
            if (field.field_type === 'dropdown') {
                const options = field.comma_separated_options
                    ? field.comma_separated_options.split(',').map((opt) => opt.trim())
                    : [];

                schema[field.field_key] = z.object({
                    id: z.string().optional(),
                    name: z.string(),
                    value:
                        field.is_mandatory && options.length > 0
                            ? z.string().refine((val) => options.includes(val), {
                                  message: `${field.field_name} must be one of the available options`,
                              })
                            : z.string(),
                    is_mandatory: z.boolean(),
                    type: z.string(),
                    comma_separated_options: z.array(z.string()).optional(),
                });
            } else {
                schema[field.field_key] = z.object({
                    id: z.string().optional(),
                    name: z.string(),
                    value: buildValueSchema(field),
                    is_mandatory: z.boolean(),
                    type: z.string(),
                });
            }
            return schema;
        }, {})
    );

    return dynamicSchema;
};
