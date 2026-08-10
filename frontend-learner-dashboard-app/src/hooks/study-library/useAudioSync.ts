// useAudioSync.ts
import { AudioActivitySchema } from "@/schemas/study-library/audio-tracking-schema";
import { useAddAudioActivity } from "@/services/study-library/tracking-api/add-audio-activity";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { TrackingDataType } from "@/types/tracking-data-type";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useResolvedPackageSessionId } from "./useResolvedPackageSessionId";
import { useSlidesRefresh } from "./useSlidesRefresh";
import { ADD_UPDATE_AUDIO_ACTIVITY } from "@/constants/urls";
import { isNetworkError, trackOrQueue } from "@/lib/offline/events/track-or-queue";

const STORAGE_KEY = "audio_tracking_data";
const USER_ID_KEY = "StudentDetails";

const toActivityPayload = (
    activity: z.infer<typeof AudioActivitySchema>,
    userId: string,
    slideId: string
): TrackingDataType => ({
    id: activity.activity_id,
    source_id: activity.source_id || "",
    source_type: "AUDIO",
    user_id: userId,
    slide_id: slideId,
    start_time_in_millis: activity.start_time,
    end_time_in_millis: activity.end_time,
    percentage_watched: activity.percentage_watched,
    audios: activity.timestamps.map((t) => ({
        id: t.id,
        start_time_in_millis: t.start,
        end_time_in_millis: t.end,
        playback_speed: t.speed,
    })),
    videos: null,
    documents: null,
    new_activity: activity.new_activity,
});

export const useAudioSync = () => {
    const addUpdateAudioActivity = useAddAudioActivity();
    const { activeItem } = useContentStore();
    const [userId, setUserId] = useState<string | null>(null);
    const { refreshSlides } = useSlidesRefresh();
    const router = useRouter();
    const { chapterId, moduleId, subjectId } = router.state.location.search as {
        chapterId?: string;
        moduleId?: string;
        subjectId?: string;
    };
    const resolvePackageSessionId = useResolvedPackageSessionId();

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

    // Tab-close safety net (web only). Mirror of the video flow's pagehide
    // handler: read pending tracking data synchronously from localStorage
    // (Capacitor Preferences is async, can't be used in pagehide), then
    // fire fetch with keepalive:true so the browser flushes the request
    // even after the page unloads.
    useEffect(() => {
        const handlePageHide = () => {
            try {
                const raw = localStorage.getItem("CapacitorStorage." + STORAGE_KEY);
                if (!raw) return;
                const parsed = JSON.parse(raw);
                const activities = (parsed?.data ?? []) as Array<
                    z.infer<typeof AudioActivitySchema>
                >;
                const pending = activities.filter(
                    (a) =>
                        a.sync_status !== "SYNCED" &&
                        Array.isArray(a.timestamps) &&
                        a.timestamps.length > 0
                );
                if (pending.length === 0) return;

                const accessToken = localStorage.getItem(
                    "CapacitorStorage.accessToken"
                );
                if (!accessToken) return;

                const studentRaw = localStorage.getItem(
                    "CapacitorStorage.StudentDetails"
                );
                const student = studentRaw ? JSON.parse(studentRaw) : null;
                const userIdSync: string | undefined =
                    student?.user_id || student?.userId;
                if (!userIdSync) return;

                // Route context comes from the URL — synchronous and reliable
                // during pagehide. The audio endpoint needs all four cascade
                // ids or the rollup above the slide silently keeps old values.
                const params = new URLSearchParams(window.location.search);
                const slideIdInUrl = params.get("slideId") || "";
                const chapterIdInUrl = params.get("chapterId") || "";
                const moduleIdInUrl = params.get("moduleId") || "";
                const subjectIdInUrl = params.get("subjectId") || "";
                const packageSessionIdInUrl = (
                    params.get("sessionId") ||
                    params.get("courseId") ||
                    ""
                ).trim();
                if (
                    !slideIdInUrl ||
                    !chapterIdInUrl ||
                    !moduleIdInUrl ||
                    !subjectIdInUrl ||
                    !packageSessionIdInUrl
                ) {
                    return;
                }

                const url =
                    ADD_UPDATE_AUDIO_ACTIVITY +
                    `?slideId=${slideIdInUrl}` +
                    `&chapterId=${chapterIdInUrl}` +
                    `&packageSessionId=${packageSessionIdInUrl}` +
                    `&moduleId=${moduleIdInUrl}` +
                    `&subjectId=${subjectIdInUrl}`;

                const instituteId =
                    localStorage.getItem("CapacitorStorage.InstituteId") ||
                    localStorage.getItem("CapacitorStorage.instituteId") ||
                    "";
                const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                    "X-User-Id": String(userIdSync),
                    "X-Package-Session-Id": packageSessionIdInUrl,
                };
                if (instituteId) {
                    headers["clientId"] = instituteId;
                    headers["X-Institute-Id"] = instituteId;
                }

                for (const activity of pending) {
                    if (activity.id !== slideIdInUrl) continue;

                    const validTimestamps = activity.timestamps.filter(
                        (t) =>
                            t.start != null &&
                            t.end != null &&
                            typeof t.start === "number" &&
                            typeof t.end === "number" &&
                            !isNaN(t.start) &&
                            !isNaN(t.end) &&
                            t.end > t.start
                    );
                    if (validTimestamps.length === 0) continue;

                    const payload = toActivityPayload(
                        { ...activity, timestamps: validTimestamps },
                        userIdSync,
                        slideIdInUrl
                    );

                    try {
                        fetch(url, {
                            method: "POST",
                            keepalive: true,
                            headers,
                            body: JSON.stringify(payload),
                        }).catch(() => {
                            /* swallow — pagehide must not throw */
                        });
                    } catch {
                        /* swallow */
                    }
                }
            } catch {
                /* swallow — pagehide must never block tab close */
            }
        };

        window.addEventListener("pagehide", handlePageHide);
        return () => window.removeEventListener("pagehide", handlePageHide);
    }, []);

    // Native lifecycle safety net (Android/iOS): pagehide never fires there,
    // so flush through the normal sync path when the app is backgrounded.
    const syncFnRef = useRef<() => Promise<void>>();
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
        const listener = App.addListener("appStateChange", ({ isActive }) => {
            if (!isActive) {
                syncFnRef.current?.().catch(() => {});
            }
        });
        return () => {
            listener.then((handle) => handle.remove()).catch(() => {});
        };
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
            const staleActivities = activities.filter(
                (a) => a.sync_status === "STALE"
            );
            if (staleActivities.length === 0) {
                console.log("[useAudioSync] No stale activities to sync");
                return;
            }

            isSyncingRef.current = true;
            console.log(
                `[useAudioSync] Starting sync for ${staleActivities.length} activity(ies)`
            );

            const packageSessionId = await resolvePackageSessionId();

            const updatedActivities: Array<z.infer<typeof AudioActivitySchema>> =
                [];
            let didSync = false;

            for (let i = 0; i < activities.length; i++) {
                const activity = activities[i];

                // Skip already synced activities (keep only the last one for UI state)
                if (activity.sync_status === "SYNCED") {
                    if (i === activities.length - 1) {
                        updatedActivities.push(activity);
                    }
                    continue;
                }

                // Keep activities with no timestamps yet — segments may still
                // be accumulating; dropping them would lose the open session.
                if (!activity.timestamps || activity.timestamps.length === 0) {
                    updatedActivities.push(activity);
                    continue;
                }

                const slideId = activeItemIdRef.current || activity.id;
                const apiPayload = toActivityPayload(activity, userId, slideId);

                const queueContext = {
                    slideId,
                    chapterId: chapterId || "",
                    moduleId: moduleId || "",
                    subjectId: subjectId || "",
                    packageSessionId: packageSessionId || "",
                };
                try {
                    const queued = await trackOrQueue({
                        userId,
                        eventType: "AUDIO",
                        context: queueContext,
                        payload: apiPayload,
                    });
                    if (!queued) {
                        console.log(
                            `📡 [useAudioSync] Syncing audio activity: ${activity.activity_id}`
                        );
                        await addUpdateAudioActivity.mutateAsync({
                            slideId,
                            chapterId: chapterId || "",
                            moduleId: moduleId || "",
                            subjectId: subjectId || "",
                            packageSessionId: packageSessionId || "",
                            requestPayload: apiPayload,
                        });
                        console.log(`✅ [useAudioSync] Audio activity synced successfully`);
                    }

                    // Mark as synced
                    updatedActivities.push({
                        ...activity,
                        sync_status: "SYNCED",
                        new_activity: false,
                    });
                    didSync = true;
                } catch (error) {
                    if (isNetworkError(error)) {
                        try {
                            await trackOrQueue({
                                userId,
                                eventType: "AUDIO",
                                context: queueContext,
                                payload: apiPayload,
                                force: true,
                            });
                            updatedActivities.push({
                                ...activity,
                                sync_status: "SYNCED",
                                new_activity: false,
                            });
                            didSync = true;
                            continue;
                        } catch (queueErr) {
                            console.error("[useAudioSync] failed to queue offline event", queueErr);
                        }
                    }
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

            // Refresh every progress-bearing cache so the sidebar / chapter /
            // course % update live. Safe to call here despite the prior
            // "loop" concern because the new useSlidesRefresh adds a 600 ms
            // delay and invalidates without an explicit refetch — combined
            // with isSyncingRef guarding concurrent syncs above, no loop is
            // reachable.
            if (didSync) {
                void refreshSlides();
            }
        } catch (error) {
            console.error(
                "[useAudioSync] Failed to sync audio tracking data:",
                error
            );
        } finally {
            isSyncingRef.current = false;
        }
    }, [
        userId,
        addUpdateAudioActivity,
        refreshSlides,
        resolvePackageSessionId,
        chapterId,
        moduleId,
        subjectId,
    ]);

    syncFnRef.current = syncAudioTrackingData;

    return { syncAudioTrackingData };
};
