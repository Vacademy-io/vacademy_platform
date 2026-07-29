import { z } from 'zod';

// Define schemas using zod for validation
export const TimestampSchema = z.object({
    id: z.string(),
    start_time: z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/),
    end_time: z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/),
    start: z.number(),
    end: z.number(),
});

// Real concentration metrics computed by the players. Optional because older
// stored activities won't carry it; the sync hook forwards it when present
// instead of fabricating zeros (which silently discarded every tab-switch and
// pause the players had counted).
export const VideoConcentrationSchema = z.object({
    id: z.string(),
    concentration_score: z.number(),
    tab_switch_count: z.number(),
    pause_count: z.number(),
    wrong_answer_count: z.number().optional(),
    missed_answer_count: z.number().optional(),
    answer_times_in_seconds: z.array(z.number()),
});

export const ActivitySchema = z.object({
    id: z.string(),
    activity_id: z.string(),
    source: z.enum(["DOCUMENT", "VIDEO"]),
    source_id: z.string(),
    start_time: z.number(),
    end_time: z.number(),
    duration: z.string(),
    timestamps: z.array(TimestampSchema),
    percentage_watched: z.string(),
    sync_status: z.enum(['SYNCED', 'STALE']),
    current_start_time: z.string().optional(),
    current_start_time_in_epoch: z.number(),
    concentration_score: VideoConcentrationSchema.optional(),
    new_activity: z.boolean()
});

export const TrackingDataSchema = z.object({
    data: z.array(ActivitySchema)
});

// Define the TrackingStore interface
export interface TrackingStore {
    trackingData: z.infer<typeof TrackingDataSchema>;
    addActivity: (activity: z.infer<typeof ActivitySchema>, isUpdate?: boolean) => Promise<void>;
    syncActivities: () => Promise<void>;
    getStoredActivities: () => Promise<void>;
}