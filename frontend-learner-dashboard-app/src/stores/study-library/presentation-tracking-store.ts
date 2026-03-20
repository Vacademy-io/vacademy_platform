import { create } from 'zustand';
import { z } from 'zod';
import { Preferences } from '@capacitor/preferences';
import { ActivitySchema } from '@/schemas/study-library/presentation-tracking-schema';

const STORAGE_KEY = 'presentation_tracking_data';

interface TrackingDataSchema {
  data: z.infer<typeof ActivitySchema>[];
}

interface PresentationTrackingStore {
   trackingData: TrackingDataSchema;
   addActivity: (activity: z.infer<typeof ActivitySchema>, isUpdate?: boolean) => Promise<void>;
   syncActivities: () => Promise<void>;
   getStoredActivities: () => Promise<void>;
}

const loadFromStorage = async (): Promise<TrackingDataSchema> => {
   try {
       const { value } = await Preferences.get({ key: STORAGE_KEY });
       return value ? JSON.parse(value) : { data: [] };
   } catch (error) {
       console.error('Failed to load from storage:', error);
       return { data: [] };
   }
};

export const usePresentationTrackingStore = create<PresentationTrackingStore>((set) => ({
    trackingData: { data: [] },

    addActivity: async (activity, isUpdate = false) => {
        try {
            const storedData = await loadFromStorage();
            const existingActivities = storedData.data;
    
            set(() => {
                // Find existing activity for current session
                const existingActivityIndex = existingActivities.findIndex(
                    (item) => item.activity_id === activity.activity_id
                );
    
                let updatedData;
                if (existingActivityIndex !== -1 && isUpdate) {
                    // Update existing activity
                    const existingActivity = existingActivities[existingActivityIndex];
                    
                    // Remove the existing activity before adding updated version
                    updatedData = existingActivities.filter(
                        (item) => item.activity_id !== activity.activity_id
                    );
                    
                    // Add the updated activity
                    updatedData.push({
                        ...existingActivity,
                        start_time: activity.start_time,
                        end_time: activity.end_time,
                        duration: activity.duration,
                        total_viewing_time: activity.total_viewing_time,
                        sync_status: 'STALE',
                        new_activity: existingActivity.new_activity,
                        view_sessions: Array.from(
                            new Set([
                                ...existingActivity.view_sessions.map((t) => JSON.stringify(t)),
                                ...activity.view_sessions.map((t) => JSON.stringify(t))
                            ])
                        ).map((t) => JSON.parse(t))
                    });
                } else {
                    // For new activity, remove any existing activities with the same ID first
                    updatedData = existingActivities.filter(
                        (item) => item.activity_id !== activity.activity_id
                    );
                    updatedData.push(activity);
                }
    
                Preferences.set({
                    key: STORAGE_KEY,
                    value: JSON.stringify({ data: updatedData })
                });
    
                return { trackingData: { data: updatedData } };
            });
        } catch (error) {
            console.error('Failed to add/update presentation activity:', error);
            throw error;
        }
    },

    syncActivities: async () => {
        try {
            set((state) => {
                const updatedActivities = state.trackingData.data.map((activity) => ({
                    ...activity,
                    sync_status: 'SYNCED' as const
                }));

                Preferences.set({
                    key: STORAGE_KEY,
                    value: JSON.stringify({ data: updatedActivities })
                });

                return { trackingData: { data: updatedActivities } };
            });
        } catch (error) {
            console.error('Failed to sync presentation activities:', error);
            throw error;
        }
    },

    getStoredActivities: async () => {
        try {
            const storedData = await loadFromStorage();
            console.log('Loaded stored presentation activities:', storedData);
            set({ trackingData: storedData });
        } catch (error) {
            console.error('Failed to get stored presentation activities:', error);
            throw error;
        }
    }
})); 