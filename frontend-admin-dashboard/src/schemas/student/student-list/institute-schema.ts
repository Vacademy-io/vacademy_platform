import { z } from "zod";

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
    start_time: z.string(),
    status: z.string(),
    package_dto: PackageSchema,
});

const SubjectSchema = z.object({
    id: z.string(),
    subject_name: z.string(),
    subject_code: z.string(),
    credit: z.number().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
});

const InstituteTypeSchema = z.enum(["Coaching Institute", "School", "University", "Corporate"]);

const InstituteSchema = z.object({
    institute_name: z.string(),
    id: z.string(),
    country: z.string(),
    state: z.string(),
    city: z.string(),
    address: z.string(),
    pin_code: z.string(),
    phone: z.string(),
    email: z.string().email(),
    website_url: z.string().url(),
    institute_logo_file_id: z.string().nullable(),
    institute_theme_code: z.string(),
    language: z.string().nullable(),
    description: z.string().nullable(),
    type: InstituteTypeSchema,
    held_by: z.string().nullable(),
    founded_date: z.string().nullable(),
    sub_modules: z.array(SubModuleSchema),
    sessions: z.array(SessionSchema),
    batches_for_sessions: z.array(BatchForSessionSchema),
    levels: z.array(LevelSchema),
    genders: z.array(z.enum(["MALE", "FEMALE", "OTHER"])),
    student_statuses: z.array(z.enum(["ACTIVE", "INACTIVE"])),
    subjects: z.array(SubjectSchema),
    session_expiry_days: z.array(z.number()),
});

export type InstituteDetailsType = z.infer<typeof InstituteSchema> | null;
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
};
export type levelsWithPackageDetails = Array<levelWithDetails>;
export type InstituteType = z.infer<typeof InstituteTypeSchema>;
