import z from 'zod';

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
                    value: field.is_mandatory
                        ? z.string().min(1, `${field.field_name} is required`)
                        : z.string(),
                    is_mandatory: z.boolean(),
                    type: z.string(),
                });
            }
            return schema;
        }, {})
    );

    return dynamicSchema;
};
