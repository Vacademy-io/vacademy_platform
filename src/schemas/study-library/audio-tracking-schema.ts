import { z } from 'zod';

// Define schemas using zod for validation
export const AudioTimestampSchema = z.object({
    id: z.string(),
    start: z.number(),
    end: z.number(),
    speed: z.number(),
});

export const AudioActivitySchema = z.object({
    id: z.string(), // Slide ID
    activity_id: z.string(),
    source: z.literal("AUDIO"),
    source_id: z.string(), // file ID
    start_time: z.number(), // session start epoch
    end_time: z.number(), // session end epoch
    duration: z.string().optional(),
    timestamps: z.array(AudioTimestampSchema),
    percentage_watched: z.number(), // Store as number for audio
    sync_status: z.enum(['SYNCED', 'STALE']),
    current_start_time_in_epoch: z.number(),
    new_activity: z.boolean()
});

export const AudioTrackingDataSchema = z.object({
    data: z.array(AudioActivitySchema)
});

// Define the TrackingStore interface
export interface AudioTrackingStore {
    trackingData: z.infer<typeof AudioTrackingDataSchema>;
    addActivity: (activity: z.infer<typeof AudioActivitySchema>, isUpdate?: boolean) => Promise<void>;
    syncActivities: () => Promise<void>;
    getStoredActivities: () => Promise<void>;
}
