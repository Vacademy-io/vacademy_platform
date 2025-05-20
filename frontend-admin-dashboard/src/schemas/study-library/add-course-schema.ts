import { z } from "zod";

export const AddSessionSchema = z.object({
    session_name: z.string(),
});

export const AddLevelSchema = z.object({
    level_name: z.string(),
    sessions: z.array(AddSessionSchema),
});

export const AddCourseSchema = z.object({
    course_name: z.string().min(1, "Course Name is required"),
    thumbnail_file_id: z.string(),
    contain_levels: z.boolean(),
    levels: z.array(AddLevelSchema).optional(),
});
