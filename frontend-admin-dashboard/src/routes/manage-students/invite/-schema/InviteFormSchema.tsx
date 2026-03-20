import { BatchForSessionSchema } from '@/schemas/student/student-list/institute-schema';
import { z } from 'zod';

// Define the email entry schema
const emailEntrySchema = z.object({
    id: z.string(),
    value: z.string().email(),
});

// Define the dropdown item type schema
const dropdownItemSchema = z.object({
    id: z.string(),
    name: z.string(),
});

const selectionModeSchema = z.enum(['institute', 'student', 'both']);

const levelSchema = z.object({
    id: z.string(),
    name: z.string(),
    packageSessionId: z.string(),
});

const batchSchema = z
    .object({
        maxCourses: z.number().or(z.nan()),
        courseSelectionMode: selectionModeSchema,
        preSelectedCourses: z.array(BatchForSessionSchema),
        learnerChoiceCourses: z.array(BatchForSessionSchema),
    })
    .superRefine((data, ctx) => {
        if (data.courseSelectionMode === 'student') {
            if (isNaN(data.maxCourses)) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'This field is required',
                    path: ['maxCourses'],
                });
            }
            if (data.learnerChoiceCourses.length === 1) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'invite link for this batch is already present',
                    path: ['learnerChoiceCourses'],
                });
            }
        }
        if (data.courseSelectionMode === 'institute') {
            if (data.preSelectedCourses.length === 1) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'invite link for this batch is already present',
                    path: ['preSelectedCourses'],
                });
            }
        }
    });

const customFieldSchema = z.object({
    id: z.number(),
    type: z.string(),
    name: z.string(),
    oldKey: z.boolean(),
    isRequired: z.boolean(),
    options: z
        .array(
            z.object({
                id: z.number(),
                value: z.string(),
                disabled: z.boolean(),
            })
        )
        .optional(),
    _id: z.string().optional(),
    status: z.enum(['ACTIVE', 'DELETED']),
});

// Create schema for form validation
export const inviteFormSchema = z.object({
    inviteLink: z.string().min(1, 'Invite link is required'),
    activeStatus: z.boolean(),
    custom_fields: z.array(customFieldSchema),
    batches: batchSchema,
    studentExpiryDays: z.number(),
    inviteeEmail: z.string().optional(), // For the input field
    inviteeEmails: z.array(emailEntrySchema).optional(),
});

export type InviteForm = z.infer<typeof inviteFormSchema>;
export type SelectionMode = z.infer<typeof selectionModeSchema>;
export type BatchField = z.infer<typeof dropdownItemSchema>;
export type LevelField = z.infer<typeof levelSchema>;
export type BatchDetails = z.infer<typeof batchSchema>;
export type CustomField = z.infer<typeof customFieldSchema>;

export const defaultFormValues: Partial<InviteForm> = {
    inviteLink: '',
    activeStatus: true,
    custom_fields: [
        {
            id: 0,
            type: 'textfield',
            name: 'Full Name',
            oldKey: true,
            isRequired: true,
            status: 'ACTIVE',
        },
        {
            id: 1,
            type: 'textfield',
            name: 'Email',
            oldKey: true,
            isRequired: true,
            status: 'ACTIVE',
        },
        {
            id: 2,
            type: 'textfield',
            name: 'Phone Number',
            oldKey: true,
            isRequired: true,
            status: 'ACTIVE',
        },
    ],
    batches: {
        maxCourses: 0,
        courseSelectionMode: 'institute',
        preSelectedCourses: [],
        learnerChoiceCourses: [],
    },
    studentExpiryDays: 365,
    inviteeEmail: '',
    inviteeEmails: [],
};

const learnerChoiceSessionSchema = z.object({
    id: z.string(),
    name: z.string(),
    maxLevels: z.number(),
    levelSelectionMode: selectionModeSchema,
    learnerChoiceLevels: z.array(levelSchema),
});

const preSelectedSessionSchema = z.object({
    id: z.string(),
    name: z.string(),
    maxLevels: z.number(),
    levelSelectionMode: selectionModeSchema,
    learnerChoiceLevels: z.array(levelSchema),
    preSelectedLevels: z.array(levelSchema),
});

const learnerChoiceCoursesSchema = z.object({
    id: z.string(),
    name: z.string(),
    maxSessions: z.number(),
    sessionSelectionMode: selectionModeSchema,
    learnerChoiceSessions: z.array(learnerChoiceSessionSchema),
});

const preSelectedCoursesSchema = z.object({
    id: z.string(),
    name: z.string(),
    maxSessions: z.number(),
    sessionSelectionMode: selectionModeSchema,
    learnerChoiceSessions: z.array(learnerChoiceSessionSchema),
    preSelectedSessions: z.array(preSelectedSessionSchema),
});

export type PreSelectedSession = z.infer<typeof preSelectedSessionSchema>;
export type LearnerChoiceSession = z.infer<typeof learnerChoiceSessionSchema>;
export type PreSelectedCourse = z.infer<typeof preSelectedCoursesSchema>;
export type LearnerChoiceCourse = z.infer<typeof learnerChoiceCoursesSchema>;
