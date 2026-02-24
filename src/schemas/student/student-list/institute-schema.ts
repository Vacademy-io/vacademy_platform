import { z } from 'zod';

const SubModuleSchema = z.object({
    module: z.string(),
    sub_module: z.string(),
    sub_module_description: z.string(),
});

const SessionSchema = z.object({
    id: z.string(),
    session_name: z.string(),
    status: z.string(),
    start_date: z.string(),
});

export const LevelSchema = z.object({
    id: z.string(),
    level_name: z.string(),
    duration_in_days: z.number().nullable(),
    thumbnail_id: z.string().nullable(),
});

export const PackageSchema = z.object({
    id: z.string(),
    package_name: z.string(),
    thumbnail_id: z.string().nullable().optional(),
});

export const BatchForSessionSchema = z.object({
    id: z.string(),
    level: LevelSchema,
    session: SessionSchema,
    start_time: z.string().nullable(),
    status: z.string(),
    package_dto: PackageSchema,
    is_org_associated: z.boolean().optional(),
    group: z.any().nullable().optional(),
    is_parent: z.boolean().optional(),
    parent_id: z.string().nullable().optional(),
});

const SubjectSchema = z.object({
    id: z.string(),
    subject_name: z.string(),
    subject_code: z.string(),
    credit: z.number().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
});

const InstituteTypeSchema = z.enum(['Coaching Institute', 'School', 'University', 'Corporate']);

const CustomFieldSchema = z.object({
    guestId: z.string().nullable(),
    id: z.string(),
    fieldKey: z.string(),
    fieldName: z.string(),
    fieldType: z.string(),
    defaultValue: z.string().nullable(),
    config: z.string(),
    formOrder: z.number().nullable(),
    isMandatory: z.boolean(),
    isFilter: z.boolean().nullable(),
    isSortable: z.boolean().nullable(),
    isHidden: z.boolean().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    sessionId: z.string().nullable(),
    liveSessionId: z.string().nullable(),
    customFieldValue: z.string().nullable(),
    groupName: z.string().nullable(),
    groupInternalOrder: z.number().nullable(),
    individualOrder: z.number().nullable(),
    settingRequest: z.any().nullable(),
});

const InstituteInfoSchema = z.object({
    module_request_ids: z.any().nullable(),
    batches_for_sessions: z.array(BatchForSessionSchema),
    levels: z.array(LevelSchema),
    genders: z.array(z.enum(['MALE', 'FEMALE', 'OTHER'])),
    student_statuses: z.array(z.enum(['ACTIVE', 'INACTIVE'])),
    session_expiry_days: z.array(z.number()),
    package_groups: z.array(z.any()),
    letter_head_file_id: z.string().nullable(),
    tags: z.array(z.string()),
});

const InstituteSetupResponseSchema = z.object({
    institute_info_dto: InstituteInfoSchema,
    sub_org_roles: z.array(z.string()).optional(),
    dropdown_custom_fields: z.array(CustomFieldSchema).optional(),
});

const InstituteSchema = z.object({
    institute_name: z.string().optional(),
    id: z.string().optional(),
    country: z.string().optional(),
    state: z.string().optional(),
    city: z.string().optional(),
    address: z.string().optional(),
    pin_code: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    website_url: z.string().url().optional(),
    institute_logo_file_id: z.string().nullable().optional(),
    institute_theme_code: z.string().optional(),
    language: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    type: InstituteTypeSchema.optional(),
    held_by: z.string().nullable().optional(),
    founded_date: z.string().nullable().optional(),
    sub_modules: z.array(SubModuleSchema).optional(),
    sessions: z.array(SessionSchema).optional(),
    batches_for_sessions: z.array(BatchForSessionSchema),
    levels: z.array(LevelSchema),
    genders: z.array(z.enum(['MALE', 'FEMALE', 'OTHER'])),
    student_statuses: z.array(z.enum(['ACTIVE', 'INACTIVE'])),
    setting: z.string().optional(),
    subjects: z.array(SubjectSchema).optional(),
    session_expiry_days: z.array(z.number()),
    tags: z.array(z.string()),
    learner_portal_base_url: z.string().optional(),
    admin_portal_base_url: z.string().optional(),
    teacher_portal_base_url: z.string().optional(),
    sub_org_roles: z.array(z.string()).optional(),
    dropdown_custom_fields: z.array(CustomFieldSchema).optional(),
    playStoreAppLink: z.string().nullable().optional(),
    appStoreAppLink: z.string().nullable().optional(),
    windowsAppLink: z.string().nullable().optional(),
    macAppLink: z.string().nullable().optional(),
    learnerPortalUrl: z.string().nullable().optional(),
    instructorPortalUrl: z.string().nullable().optional(),
});

export type InstituteDetails = z.infer<typeof InstituteSchema>;
export type InstituteDetailsType = InstituteDetails | null;
export type InstituteSetupResponseType = z.infer<typeof InstituteSetupResponseSchema>;
export type CustomFieldType = z.infer<typeof CustomFieldSchema>;
export type LevelType = z.infer<typeof LevelSchema>;
export type SessionType = z.infer<typeof SessionSchema>;
export type BatchForSessionType = z.infer<typeof BatchForSessionSchema>;
export type levelWithDetails = {
    level_dto: {
        id: string;
        level_name: string;
        duration_in_days: number | null;
        thumbnail_id?: string | null;
    };
    package_session_id: string;
    package_session_status: string;
    start_date: string;
    is_parent?: boolean;
    parent_id?: string | null;
};
export type levelsWithPackageDetails = Array<levelWithDetails>;
export type InstituteType = z.infer<typeof InstituteTypeSchema>;
export type SubModuleType = z.infer<typeof SubModuleSchema>;
