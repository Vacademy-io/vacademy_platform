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

export const audienceCampaignSchema = z.object({
    campaign_name: z
        .string()
        .min(1, 'Campaign name is required')
        .min(3, 'Name must be at least 3 characters'),
    campaign_type: z.string().toUpperCase().min(1, 'Campaign type is required'),
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
    campaign_image: z.string().optional(),
    campaign_imageBlob: z.string().optional(),
    uploadingStates: z
        .object({
            campaign_image: z.boolean().default(false),
        })
        .default({ campaign_image: false }),
}).catchall(z.any()); // Allow additional fields for preview (e.g., preview_Gender_0)

export type AudienceCampaignForm = z.infer<typeof audienceCampaignSchema>;

// Set start date to today (date only, no time)
const today = new Date();
const todayDateOnly = today.toISOString().split('T')[0] || today.toISOString().substring(0, 10); // Format: YYYY-MM-DD
const oneWeekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const oneWeekLaterDateOnly = oneWeekLater.toISOString().split('T')[0] || oneWeekLater.toISOString().substring(0, 10); // Format: YYYY-MM-DD

export const defaultFormValues: AudienceCampaignForm = {
    campaign_name: '',
    campaign_type: '',
    description: '',
    campaign_objective: '',
    to_notify: '',
    send_respondent_email: false,
    start_date_local: todayDateOnly,
    end_date_local: oneWeekLaterDateOnly,
    status: 'ACTIVE',
    json_web_metadata: '',
    institute_custom_fields: '',
    // custom_fields are loaded dynamically from settings via getCampaignCustomFields()
    // If no fields are configured in settings, the form will start with an empty array
    // Users can add fields manually or configure them in settings
    custom_fields: [],
    customHtml: '',
    selectedOptionValue: 'textfield',
    textFieldValue: '',
    dropdownOptions: [],
    isDialogOpen: false,
    campaign_image: '',
    campaign_imageBlob: '',
    uploadingStates: {
        campaign_image: false,
    },
};
