import { z } from 'zod';
import { AccessType, WaitingRoomType } from '../../-constants/enums';

/**
 * Single row in the Bulk Schedule grid. Each row produces one independent
 * live session via the `/create/bulk` endpoint. Kept intentionally narrow:
 * advanced toggles (BBB config, feedback, learner-button, recurring days,
 * waiting room) intentionally don't apply to bulk rows — only the fields
 * commonly varied across many sessions.
 */
export const bulkSessionRowSchema = z
    .object({
        title: z.string().min(1, 'Title is required'),
        subject: z.string().optional(),
        startDate: z.string().min(1, 'Start date is required'),
        startTime: z.string().min(1, 'Start time is required'),
        durationHours: z.string().default('0'),
        durationMinutes: z.string().default('30'),
        platform: z.string().default('other'),
        link: z.string().optional().or(z.literal('')),
        description: z.string().optional(),
        /**
         * Batches assigned to THIS row only. Each entry is a (course, session,
         * level) tuple — same shape step 2 uses for the existing single-class
         * flow so we can reuse the participants picker.
         */
        selectedLevels: z
            .array(
                z.object({
                    courseId: z.string(),
                    sessionId: z.string(),
                    levelId: z.string(),
                })
            )
            .default([]),

        // === Waiting-room per-row overrides ===
        // Each is OPTIONAL on purpose: an undefined value means "use the
        // shared default from sharedOptions". The submit logic (resolveWaiting
        // helpers below) merges row-level overrides with the shared values so
        // admins can leave most rows alone and only customise outliers.
        /** Override: whether the waiting room is enabled for this row only. */
        waitingRoomEnabled: z.boolean().optional(),
        /** Override: minutes before start the waiting room opens for this row. */
        waitingRoomMinutes: z.string().optional(),
        /**
         * Override: waiting-room behaviour for this row. DEFAULT = waiting-room
         * screen; PRE_JOINING = learner joins the live class directly. Undefined
         * is treated as DEFAULT at submit time.
         */
        waitingRoomType: z.nativeEnum(WaitingRoomType).optional(),
        /** Override: S3 file id of a row-specific waiting-room thumbnail. */
        waitingRoomThumbnailFileId: z.string().optional(),
        /** Override: S3 file id of a row-specific waiting-room background score. */
        waitingRoomMusicFileId: z.string().optional(),
    })
    .superRefine((row, ctx) => {
        const h = parseInt(row.durationHours || '0', 10);
        const m = parseInt(row.durationMinutes || '0', 10);
        if ((isNaN(h) ? 0 : h) === 0 && (isNaN(m) ? 0 : m) === 0) {
            ctx.addIssue({
                code: 'custom',
                message: 'Duration must be greater than zero',
                path: ['durationMinutes'],
            });
        }
        if (row.platform !== 'zoho' && row.platform !== 'bbb') {
            if (!row.link) {
                ctx.addIssue({
                    code: 'custom',
                    message: 'Link is required',
                    path: ['link'],
                });
            } else {
                try {
                    new URL(row.link);
                } catch {
                    ctx.addIssue({
                        code: 'custom',
                        message: 'Invalid URL',
                        path: ['link'],
                    });
                }
            }
        }
    });

export const feedbackQuestionSchema = z.object({
    id: z.string(),
    type: z.string(),
    label: z.string(),
    enabled: z.boolean(),
    mandatory: z.boolean(),
    max_stars: z.number().nullish(),
    allow_half: z.boolean().nullish(),
});

/**
 * One field on the public registration form. Mirrors the single-class step-2
 * `addParticipantsSchema.fields` shape so the bulk flow can reuse the exact
 * same builder UI and feed `transformFormToDTOStep2` without translation.
 */
export const bulkRegistrationFieldSchema = z.object({
    id: z.string().optional(),
    label: z.string().min(1, 'Field label is required').max(100, 'Field label too long'),
    required: z.boolean(),
    isDefault: z.boolean(),
    type: z.string(),
    options: z.array(z.object({ label: z.string(), name: z.string() })).optional(),
});

export const bulkSharedOptionsSchema = z.object({
    enableWaitingRoom: z.boolean().default(false),
    /** Minutes before start time to open the waiting room. Used only when enableWaitingRoom is true. */
    waitingRoomMinutes: z.string().default('5'),
    /**
     * Shared waiting-room behaviour for every row. DEFAULT = waiting-room screen;
     * PRE_JOINING = learner joins the live class directly during the window
     * (thumbnail / background score don't apply). A row can override this.
     */
    waitingRoomType: z.nativeEnum(WaitingRoomType).default(WaitingRoomType.WAITING_ROOM),
    /** S3 file id of the waiting-room thumbnail uploaded once and applied to every bulk row. */
    waitingRoomThumbnailFileId: z.string().optional(),
    /** S3 file id of the waiting-room background music. */
    waitingRoomMusicFileId: z.string().optional(),
    allowRewind: z.boolean().default(true),
    allowPause: z.boolean().default(true),
    enableFeedback: z.boolean().default(false),
    /** When true, learner cannot skip the feedback form — serialized as feedback_config.allow_skip = false. */
    feedbackCompulsory: z.boolean().default(false),
    /** Per-question feedback config sent to the backend when enableFeedback is true. */
    feedbackQuestions: z.array(feedbackQuestionSchema).default([]),
    /** Maps to bbb_record on the backend; only takes effect for rows whose platform is BBB. */
    recordSession: z.boolean().default(false),
    /** Auto-start recording when the BBB meeting begins. */
    autoStartRecording: z.boolean().default(false),
    /** Mute participants when they join. */
    muteOnStart: z.boolean().default(true),
    /** Only the moderator can share their webcam. */
    webcamsOnlyForModerator: z.boolean().default(false),
    /** How guest learners are admitted. */
    guestPolicy: z
        .enum(['ALWAYS_ACCEPT', 'ASK_MODERATOR', 'ALWAYS_DENY'])
        .default('ALWAYS_ACCEPT'),
    /**
     * Default streaming platform for new rows. The "Add row" button stamps
     * each new row's platform with this value so admins don't have to set it
     * per row when they're creating many of the same kind of class.
     */
    defaultPlatform: z.string().default('other'),
    /**
     * Default description (HTML) applied to rows whose description is blank
     * when the admin clicks "Apply to empty rows". Each row keeps an editable
     * description override (`bulkSessionRowSchema.description`).
     */
    defaultDescription: z.string().optional(),
});

export const bulkSessionFormSchema = z.object({
    timeZone: z.string().min(1, 'Time zone is required'),
    rows: z.array(bulkSessionRowSchema).min(1, 'Add at least one session'),
    sharedOptions: bulkSharedOptionsSchema,

    // === Step-2 settings (applied to every created session) ===
    /** Private = batches assigned per row; Public = anyone with the link. */
    accessType: z.nativeEnum(AccessType).default(AccessType.PRIVATE),
    /**
     * Public registration-form fields, shared across every session created from
     * the grid. Only meaningful when accessType === PUBLIC — seeded from the
     * institute's default fields and editable like single-class step 2.
     */
    fields: z.array(bulkRegistrationFieldSchema).default([]),
    notifyBy: z
        .object({
            mail: z.boolean(),
            whatsapp: z.boolean(),
            push_notification: z.boolean(),
            system_notification: z.boolean(),
        })
        .default({
            mail: false,
            whatsapp: false,
            push_notification: false,
            system_notification: false,
        }),
    notifySettings: z
        .object({
            onCreate: z.boolean(),
            beforeLive: z.boolean(),
            beforeLiveTime: z
                .array(z.object({ time: z.string().min(1, 'Select time') }))
                .optional(),
            onLive: z.boolean(),
            onAttendance: z.boolean(),
        })
        .default({
            onCreate: false,
            beforeLive: false,
            beforeLiveTime: [],
            onLive: true,
            onAttendance: false,
        }),
})
    .superRefine((data, ctx) => {
        // Private bulk sessions are restricted to assigned batches (there's no
        // individual-learner picker in the grid), so every row must have at
        // least one batch — otherwise that class would be created with nobody
        // able to join. Public rows join via the shared link and need none.
        if (data.accessType === AccessType.PRIVATE) {
            data.rows.forEach((row, index) => {
                if ((row.selectedLevels?.length ?? 0) === 0) {
                    ctx.addIssue({
                        code: 'custom',
                        message: 'Assign at least one batch to this private class.',
                        path: ['rows', index, 'selectedLevels'],
                    });
                }
            });
        }
    });

export type BulkSessionRow = z.infer<typeof bulkSessionRowSchema>;
export type BulkSharedOptions = z.infer<typeof bulkSharedOptionsSchema>;
export type BulkSessionForm = z.infer<typeof bulkSessionFormSchema>;
