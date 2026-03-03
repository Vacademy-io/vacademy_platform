import { z } from 'zod';

const testInputFieldSchema = z.object({
    id: z.string(),
    type: z.string(),
    name: z.string(),
    oldKey: z.boolean(),
    isRequired: z.boolean(),
    key: z
        .string()
        .nullable()
        .optional()
        .transform((val) => val ?? ''),
    order: z
        .number()
        .nullable()
        .optional()
        .transform((val) => val ?? 0),
    options: z
        .array(
            z.object({
                id: z.string(),
                value: z.string(),
            })
        )
        .optional(),
});

const counsellorSettingsDataSchema = z.object({
    autoAssignEnabled: z.boolean(),
    assignmentStrategy: z.enum(['round_robin', 'in_order']),
    allowParentSelection: z.boolean(),
    counsellorIds: z.array(z.string()),
});

const counsellorSettingsSchema = z.object({
    key: z.literal('COUNSELLOR_ALLOCATION_SETTING'),
    name: z.literal('Counsellor Allocation Settings'),
    data: counsellorSettingsDataSchema,
});

export const enquirySchema = z
    .object({
        // Required fields
        campaign_name: z
            .string()
            .min(1, 'Enquiry name is required')
            .min(3, 'Name must be at least 3 characters'),
        campaign_type: z.string().toUpperCase().min(1, 'Enquiry type is required'),
        session_id: z.string().min(1, 'Session is required'),

        // Counsellor settings
        counsellor_settings: counsellorSettingsSchema.optional(),

        // Optional fields
        description: z.string().optional(),
        campaign_objective: z.string().optional().default(''),
        to_notify: z.string().optional(),
        send_respondent_email: z.boolean().optional(),
        start_date_local: z.string().min(1, 'Start date is required'),
        end_date_local: z.string().min(1, 'End date is required'),
        status: z.string().toUpperCase().default('Active'),
        json_web_metadata: z.string().optional(),
        institute_custom_fields: z.string().optional(),
        custom_fields: z.array(testInputFieldSchema).default([]),

        // UI-only fields
        customHtml: z.string().default(''),
        selectedOptionValue: z.string().default('textfield'),
        textFieldValue: z.string().default(''),
        dropdownOptions: z
            .array(
                z.object({
                    id: z.string(),
                    value: z.string(),
                    disabled: z.boolean(),
                })
            )
            .default([]),
        isDialogOpen: z.boolean().default(false),
        uploadingStates: z
            .object({
                campaign_image: z.boolean().default(false),
            })
            .default({ campaign_image: false }),
    })
    .catchall(z.any()) // Allow additional fields for preview (e.g., preview_Gender_0)
    .refine(
        (data) => {
            // Validation: if allowParentSelection is true, autoAssignEnabled must be false
            if (data.counsellor_settings?.data.allowParentSelection) {
                return !data.counsellor_settings.data.autoAssignEnabled;
            }
            return true;
        },
        {
            message: 'Auto-assign must be disabled when parent selection is enabled',
            path: ['counsellor_settings', 'data', 'autoAssignEnabled'],
        }
    );

export type EnquiryForm = z.infer<typeof enquirySchema>;

// Set start date to today (date only, no time)
const today = new Date();
const todayDateOnly = today.toISOString().split('T')[0] || today.toISOString().substring(0, 10);
const oneWeekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const oneWeekLaterDateOnly =
    oneWeekLater.toISOString().split('T')[0] || oneWeekLater.toISOString().substring(0, 10);

export const defaultEnquiryFormValues: EnquiryForm = {
    campaign_name: '',
    campaign_type: '',
    session_id: '',
    description: '',
    campaign_objective: '',
    to_notify: '',
    send_respondent_email: false,
    start_date_local: todayDateOnly,
    end_date_local: oneWeekLaterDateOnly,
    status: 'ACTIVE',
    json_web_metadata: '',
    institute_custom_fields: '',
    custom_fields: [],
    customHtml: '',
    selectedOptionValue: 'textfield',
    textFieldValue: '',
    dropdownOptions: [],
    isDialogOpen: false,
    uploadingStates: {
        campaign_image: false,
    },
    counsellor_settings: {
        key: 'COUNSELLOR_ALLOCATION_SETTING',
        name: 'Counsellor Allocation Settings',
        data: {
            autoAssignEnabled: true,
            assignmentStrategy: 'round_robin',
            allowParentSelection: false,
            counsellorIds: [],
        },
    },
};
