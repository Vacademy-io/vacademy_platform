// useAudioSync.ts
import { AudioActivitySchema } from "@/schemas/study-library/audio-tracking-schema";
import { useAddAudioActivity, AudioActivityPayload } from "@/services/study-library/tracking-api/add-audio-activity";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { Preferences } from "@capacitor/preferences";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

const STORAGE_KEY = "audio_tracking_data";
const USER_ID_KEY = "StudentDetails";

export const useAudioSync = () => {
    const addUpdateAudioActivity = useAddAudioActivity();
    const { activeItem } = useContentStore();
    const [userId, setUserId] = useState<string | null>(null);
    
    // Use refs for values that shouldn't trigger re-renders
    const activeItemIdRef = useRef<string | null>(null);
    const isSyncingRef = useRef<boolean>(false);

    // Update ref when activeItem changes
    useEffect(() => {
        activeItemIdRef.current = activeItem?.id || null;
    }, [activeItem?.id]);

    // Load user ID on mount
    useEffect(() => {
        const loadUserId = async () => {
            const userDetailsStr = await Preferences.get({ key: USER_ID_KEY });
            const userDetails = userDetailsStr.value
                ? JSON.parse(userDetailsStr.value)
                : null;
            setUserId(userDetails?.user_id || null);
        };
        loadUserId();
    }, []);

    const syncAudioTrackingData = useCallback(async () => {
        // Prevent concurrent syncs
        if (isSyncingRef.current) {
            console.log("[useAudioSync] Already syncing, skipping...");
            return;
        }

        try {
            if (!userId) {
                console.warn("[useAudioSync] User ID not found in storage");
                return;
            }

            const { value } = await Preferences.get({ key: STORAGE_KEY });
            if (!value) {
                console.log("[useAudioSync] No tracking data in storage");
                return;
            }

            const trackingData = JSON.parse(value);
            const activities = trackingData.data as Array<
                z.infer<typeof AudioActivitySchema>
            >;
            
            if (activities.length === 0) {
                console.log("[useAudioSync] No activities to sync");
                return;
            }

            // Find activities that need syncing
            const staleActivities = activities.filter(a => a.sync_status === "STALE");
            if (staleActivities.length === 0) {
                console.log("[useAudioSync] No stale activities to sync");
                return;
            }

            isSyncingRef.current = true;
            console.log(`[useAudioSync] Starting sync for ${staleActivities.length} activity(ies)`);

            const updatedActivities: Array<z.infer<typeof AudioActivitySchema>> = [];

            for (let i = 0; i < activities.length; i++) {
                const activity = activities[i];

                // Skip already synced activities (keep only the last one for UI state)
                if (activity.sync_status === "SYNCED") {
                    if (i === activities.length - 1) {
                        updatedActivities.push(activity);
                    }
                    continue;
                }

                // Skip if no timestamps to sync
                if (!activity.timestamps || activity.timestamps.length === 0) {
                    console.log("[useAudioSync] Skipping activity with no timestamps");
                    continue;
                }

                // Prepare simplified payload per backend spec
                const apiPayload: AudioActivityPayload = {
                    slide_id: activeItemIdRef.current || activity.id,
                    user_id: userId,
                    is_new_activity: activity.new_activity,
                    learner_operation: "AUDIO_LAST_TIMESTAMP",
                    audios: activity.timestamps.map((timestamp) => ({
                        start_time_in_millis: timestamp.start,
                        end_time_in_millis: timestamp.end,
                        playback_speed: timestamp.speed,
                    })),
                };

                try {
                    console.log(`📡 [useAudioSync] Syncing audio activity: ${activity.activity_id}`);
                    await addUpdateAudioActivity.mutateAsync(apiPayload);
                    console.log(`✅ [useAudioSync] Audio activity synced successfully`);
                    
                    // Mark as synced
                    updatedActivities.push({
                        ...activity,
                        sync_status: "SYNCED",
                        new_activity: false,
                    });

                    // NOTE: Do NOT call refreshSlides() here as it causes re-renders and potential loops
                } catch (error) {
                    console.error("[useAudioSync] API call failed:", error);
                    // Keep as STALE for retry
                    updatedActivities.push(activity);
                }
            }

            // Save updated activities
            await Preferences.set({
                key: STORAGE_KEY,
                value: JSON.stringify({ data: updatedActivities }),
            });
            
            console.log("[useAudioSync] Sync completed, storage updated");
        } catch (error) {
            console.error("[useAudioSync] Failed to sync audio tracking data:", error);
        } finally {
            isSyncingRef.current = false;
        }
    }, [userId, addUpdateAudioActivity]);

    return { syncAudioTrackingData };
};
