import { z } from 'zod';
import { toast } from 'sonner';
import { AccessType, RecurringType } from '../../-constants/enums';

const weekDaysEnum = z.enum([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
]);

// Schema for learner button configuration
const learnerButtonConfigSchema = z.object({
    text: z.string().min(1, 'Button text is required').max(50, 'Button text must be 50 characters or less'),
    url: z.string().url('Invalid URL'),
    background_color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color format'),
    text_color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color format'),
    visible: z.boolean(),
}).optional().nullable();

const sessionDetailsSchema = z.object({
    id: z.string().optional(),
    startTime: z.string().optional(),
    durationHours: z
        .string()
        .refine(
            (val) => {
                const num = parseInt(val);
                return !val || (num >= 0 && num <= 24);
            },
            { message: 'Hours must be between 0 and 24' }
        )
        .optional(),
    durationMinutes: z
        .string()
        .refine(
            (val) => {
                const num = parseInt(val);
                return !val || (num >= 0 && num <= 59);
            },
            { message: 'Minutes must be between 0 and 59' }
        )
        .optional(),
    link: z.string().url('Invalid URL').optional().or(z.literal('')),
    countAttendanceDaily: z.boolean().optional(),
    thumbnailFileId: z.string().optional(),
});

export const weeklyClassSchema = z.object({
    id: z.string().optional(),
    day: weekDaysEnum,
    isSelect: z.boolean(),
    // Day-level configurations (shared across all sessions on this day)
    default_class_link: z.string().url('Invalid URL').optional().or(z.literal('')).nullable(),
    default_class_name: z.string().max(100, 'Class name must be 100 characters or less').optional().nullable(),
    learner_button_config: learnerButtonConfigSchema,
    sessions: z.array(sessionDetailsSchema),
});

export const sessionFormSchema = z
    .object({
        id: z.string().optional(),
        title: z.string().min(1, 'Title must be at least 1 characters'),
        subject: z.string().optional(),
        openWaitingRoomBefore: z.string().optional(),
        sessionType: z.string(),
        sessionPlatform: z.string(),
        enableWaitingRoom: z.boolean(),
        streamingType: z.string(),
        allowRewind: z.boolean(),
        allowPause: z.boolean(),
        startTime: z.string({
            required_error: 'Start time is required',
            invalid_type_error: 'Invalid date',
        }),
        endDate: z
            .string({
                required_error: 'End date is required',
                invalid_type_error: 'Invalid date',
            })
            .optional(),
        timeZone: z.string().min(1, 'Time zone is required'),
        events: z.string().regex(/^\d+$/, 'Must be a number'),
        description: z.string().optional(),
        durationMinutes: z.string({
            required_error: 'Duration is required',
        }),
        durationHours: z.string({
            required_error: 'Duration is required',
        }),
        defaultLink: z.string().optional().or(z.literal('')),
        meetingType: z.nativeEnum(RecurringType),
        recurringSchedule: z.array(weeklyClassSchema).optional(),
        learner_button_config: learnerButtonConfigSchema,
    })
    .superRefine((data, ctx) => {
        if (data.sessionPlatform !== 'zoho' && !data.defaultLink) {
            ctx.addIssue({
                code: 'custom',
                message: 'Live class link is required',
                path: ['defaultLink'],
            });
        }
        if (data.sessionPlatform !== 'zoho' && data.defaultLink) {
            try {
                new URL(data.defaultLink);
            } catch {
                ctx.addIssue({
                    code: 'custom',
                    message: 'Invalid URL',
                    path: ['defaultLink'],
                });
            }
        }
        // Validate total duration is greater than zero
        const hours = parseInt(data.durationHours || '0', 10);
        const minutes = parseInt(data.durationMinutes || '0', 10);
        if (hours === 0 && minutes === 0) {
            ctx.addIssue({
                code: 'custom',
                message: 'Duration must be greater than zero.',
                path: ['durationMinutes'],
            });
        }
        // Validate end date for recurring meetings
        if (data.meetingType === RecurringType.WEEKLY && !data.endDate) {
            ctx.addIssue({
                code: 'custom',
                message: 'End date is required for recurring meetings.',
                path: ['endDate'],
            });
        }
        // Validate end date is greater than start date
        if (data.meetingType === RecurringType.WEEKLY && data.endDate && data.startTime) {
            const startDateStr = data.startTime.split('T')[0];
            if (startDateStr && data.endDate <= startDateStr) {
                toast.error('End date should be greater than start date.');
                ctx.addIssue({
                    code: 'custom',
                    message: 'End date should be greater than start date.',
                    path: ['endDate'],
                });
            }
        }
    });

export const addParticipantsSchema = z.object({
    accessType: z.nativeEnum(AccessType),
    batchSelectionType: z.enum(['batch', 'individual']),
    selectedLevels: z.array(
        z.object({
            courseId: z.string(),
            sessionId: z.string(),
            levelId: z.string(),
        })
    ),
    selectedLearners: z.array(z.string()).optional(),
    joinLink: z.string().url('Enter a valid URL'),
    notifyBy: z.object({
        mail: z.boolean(),
        whatsapp: z.boolean(),
    }),
    notifySettings: z.object({
        onCreate: z.boolean(),
        beforeLive: z.boolean(),
        beforeLiveTime: z
            .array(
                z.object({
                    time: z.string().min(1, 'Select time'), // e.g., "10 min"
                })
            )
            .optional(),
        onLive: z.boolean(),
    }),
    fields: z.array(
        z.object({
            id: z.string().optional(),
            label: z.string().min(1, 'Field label is required').max(100, 'Field label too long'),
            required: z.boolean(),
            isDefault: z.boolean(),
            type: z.string(),
            options: z.array(z.object({ label: z.string(), name: z.string() })).optional(),
        })
    ),
});

export const addCustomFiledSchema = z.object({
    fieldType: z.string(),
    fieldName: z.string(),
    options: z.array(z.object({ optionField: z.string() })),
});
