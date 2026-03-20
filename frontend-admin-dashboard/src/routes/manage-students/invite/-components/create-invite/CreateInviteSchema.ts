import { z } from 'zod';

export interface Course {
    id: string;
    name: string;
}

export interface Level {
    levelId: string;
    levelName: string;
}

export interface Session {
    sessionId: string;
    sessionName: string;
    levels: Level[];
}

export interface Batch {
    sessionId: string;
    levelId: string;
    sessionName: string;
    levelName: string;
    courseId: string;
    courseName: string;
    isParent?: boolean;
}

// Schema for the CreateInvite form
export const createInviteSchema = z.object({
    selectedCourse: z
        .object({
            id: z.string(),
            name: z.string(),
        })
        .nullable(),
    selectedSession: z
        .object({
            sessionId: z.string(),
            sessionName: z.string(),
            levels: z.array(
                z.object({
                    levelId: z.string(),
                    levelName: z.string(),
                })
            ),
        })
        .nullable(),
    selectedLevel: z
        .object({
            levelId: z.string(),
            levelName: z.string(),
        })
        .nullable(),
    selectedBatches: z.array(
        z.object({
            sessionId: z.string(),
            levelId: z.string(),
            sessionName: z.string(),
            levelName: z.string(),
            courseId: z.string(),
            courseName: z.string(),
            isParent: z.boolean().optional(),
        })
    ),
    showCourseDropdown: z.boolean().default(false),
    showSessionDropdown: z.boolean().default(false),
    showLevelDropdown: z.boolean().default(false),
    showSummaryDialog: z.boolean().default(false),
    dialogOpen: z.boolean().default(false),
});

export type CreateInviteFormValues = z.infer<typeof createInviteSchema>;

export const defaultCreateInviteValues: CreateInviteFormValues = {
    selectedCourse: null,
    selectedSession: null,
    selectedLevel: null,
    selectedBatches: [],
    showCourseDropdown: false,
    showSessionDropdown: false,
    showLevelDropdown: false,
    showSummaryDialog: false,
    dialogOpen: false,
};
