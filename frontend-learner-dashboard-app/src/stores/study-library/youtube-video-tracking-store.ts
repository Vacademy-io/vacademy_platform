import { create } from 'zustand';
import { Preferences } from '@capacitor/preferences';
import { TrackingStore, TrackingDataSchema, ActivitySchema } from '@/schemas/study-library/youtube-video-tracking-schema';
import { z } from 'zod';

const STORAGE_KEY = 'video_tracking_data';

// Function to load data from storage
const loadFromStorage = async (): Promise<z.infer<typeof TrackingDataSchema>> => {
    try {
        const { value } = await Preferences.get({ key: STORAGE_KEY });
        return value ? JSON.parse(value) : { data: [] };
    } catch (error) {
        console.error('Failed to load from storage:', error);
        return { data: [] };
    }
};

// Create Zustand store with proper typing
export const useTrackingStore = create<TrackingStore>((set) => ({
    trackingData: { data: [] },

    // Add or update an activity
    addActivity: async (activity, isUpdate = false) => {
        try {
            // Load existing activities from storage
            const storedData = await loadFromStorage();
            const existingActivities = storedData.data as Array<z.infer<typeof ActivitySchema>>;

            // set((state) => {
            set(() => {
                const existingActivityIndex = existingActivities.findIndex(
                    (item) => item.activity_id === activity.activity_id
                );

                let updatedData;
                if (existingActivityIndex !== -1 && isUpdate) {
                    // Update existing activity
                    const existingActivity = existingActivities[existingActivityIndex];

                    updatedData = [...existingActivities];
                    updatedData[existingActivityIndex] = {
                        ...existingActivity,
                        start_time: activity.start_time,
                        end_time: activity.end_time,
                        duration: activity.duration,
                        percentage_watched: activity.percentage_watched,
                        sync_status: 'STALE',
                        current_start_time: activity.current_start_time,
                        current_start_time_in_epoch: activity.current_start_time_in_epoch,
                        new_activity: existingActivity.new_activity,
                        timestamps: Array.from(
                            new Set([
                                ...existingActivity.timestamps.map((t) => JSON.stringify(t)),
                                ...activity.timestamps.map((t) => JSON.stringify(t))
                            ])
                        ).map((t) => JSON.parse(t))
                    };
                } else {
                    // Append new activity
                    updatedData = [...existingActivities, activity];
                }

                // Save updated activities back to storage
                Preferences.set({
                    key: STORAGE_KEY,
                    value: JSON.stringify({ data: updatedData })
                });

                return { trackingData: { data: updatedData } };
            });
        } catch (error) {
            console.error('Failed to add/update activity:', error);
            throw error;
        }
    },

    // Sync activities by marking them as SYNCED
    syncActivities: async () => {
        try {
            set((state) => {
                const updatedActivities = state.trackingData.data.map((activity) => ({
                    ...activity,
                    sync_status: 'SYNCED' as const
                }));

                // Save synced activities back to storage
                Preferences.set({
                    key: STORAGE_KEY,
                    value: JSON.stringify({ data: updatedActivities })
                });

                return { trackingData: { data: updatedActivities } };
            });
        } catch (error) {
            console.error('Failed to sync activities:', error);
            throw error;
        }
    },

    // Load stored activities into the store state
    getStoredActivities: async () => {
        try {
            const storedData = await loadFromStorage();
            console.log('Loaded stored activities:', storedData);
            set({ trackingData: storedData });
        } catch (error) {
            console.error('Failed to get stored activities:', error);
            throw error;
        }
    }
}));
