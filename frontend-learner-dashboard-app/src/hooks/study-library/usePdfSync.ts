// usePDFSync.ts
import { ActivitySchema } from "@/schemas/study-library/pdf-tracking-schema";
import { useAddDocumentActivity } from "@/services/study-library/tracking-api/add-document-activity";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { TrackingDataType } from "@/types/tracking-data-type";
import { calculateAndUpdatePageViews } from "@/utils/study-library/tracking/calculateAndUpdatePageViews";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { z } from "zod";
import { useResolvedPackageSessionId } from "./useResolvedPackageSessionId";
import { useSlidesRefresh } from "./useSlidesRefresh";
import { isNetworkError, trackOrQueue } from "@/lib/offline/events/track-or-queue";

const STORAGE_KEY = "pdf_tracking_data";
const USER_ID_KEY = "StudentDetails";

// Module-level guard: holds activity_ids currently being POSTed. Prevents
// two concurrent callers (e.g. a remount-refire loop triggered by
// refreshSlides) from both reading new_activity=true from Preferences
// before either has written SYNCED back, which would race the backend's
// concentration_score write and surface as a 511 StaleStateException.
const inFlight = new Set<string>();

export const usePDFSync = () => {
    const addUpdateDocumentActivity = useAddDocumentActivity();
    const { activeItem } = useContentStore();
    const router = useRouter();
    const { chapterId, moduleId, subjectId } = router.state.location.search;
    const resolvePackageSessionId = useResolvedPackageSessionId();

    const { refreshSlides } = useSlidesRefresh();

    // Native lifecycle safety net (Android/iOS): home button / app switch /
    // screen lock never fire pagehide, so everything since the last 60s tick
    // was lost. Flush through the normal sync path on backgrounding.
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

    const syncPDFTrackingData = async () => {
        try {
            const userDetailsStr = await Preferences.get({ key: USER_ID_KEY });
            const userDetails = userDetailsStr.value
                ? JSON.parse(userDetailsStr.value)
                : null;
            const userId = userDetails?.user_id;
            const packageSessionId = await resolvePackageSessionId();

            if (!userId) {
                throw new Error("User ID not found in storage");
            }

            const { value } = await Preferences.get({ key: STORAGE_KEY });
            if (!value) return;

            const trackingData = JSON.parse(value);
            const activities = trackingData.data as Array<
                z.infer<typeof ActivitySchema>
            >;
            const updatedActivities = [];
            let didSync = false;

            for (let activity of activities) {
                if (activity.sync_status === "SYNCED") {
                    updatedActivities.push(activity);
                    continue;
                }

                if (inFlight.has(activity.activity_id)) {
                    updatedActivities.push(activity);
                    continue;
                }

                activity = calculateAndUpdatePageViews(activity);

                const apiPayload: TrackingDataType = {
                    id: activity.activity_id,
                    source_id: activity.source_id,
                    source_type: activity.source,
                    user_id: userId,
                    slide_id: activeItem?.id || "",
                    start_time_in_millis: activity.start_time_in_millis,
                    end_time_in_millis: activity.end_time_in_millis,
                    percentage_watched: activity.total_pages_read,
                    videos: null,
                    documents: activity.page_views.map((view) => ({
                        id: view.id,
                        start_time_in_millis: view.start_time_in_millis,
                        end_time_in_millis: view.end_time_in_millis,
                        page_number: view.page,
                    })),
                    new_activity: activity.new_activity,
                    concentration_score: activity.concentration_score,
                };

                try {
                    if (
                        activity.page_views.length >= 1 &&
                        activity.new_activity
                    ) {
                        inFlight.add(activity.activity_id);
                        try {
                            const queueContext = {
                                slideId: activity.slide_id || "",
                                chapterId: chapterId || "",
                                moduleId: moduleId || "",
                                subjectId: subjectId || "",
                                packageSessionId: packageSessionId || "",
                            };
                            const queued = await trackOrQueue({
                                userId,
                                eventType: "DOCUMENT",
                                context: queueContext,
                                payload: apiPayload,
                            });
                            if (!queued) {
                                await addUpdateDocumentActivity.mutateAsync({
                                    slideId: activity.slide_id || "",
                                    chapterId: chapterId || "",
                                    requestPayload: apiPayload,
                                    packageSessionId: packageSessionId || "",
                                    moduleId: moduleId || "",
                                    subjectId: subjectId || "",
                                });
                            }
                            activity.sync_status = "SYNCED";
                            activity.new_activity = false; // Move this here, after successful API call
                            updatedActivities.push(activity);
                            didSync = true;
                        } catch (err) {
                            if (isNetworkError(err)) {
                                try {
                                    await trackOrQueue({
                                        userId,
                                        eventType: "DOCUMENT",
                                        context: {
                                            slideId: activity.slide_id || "",
                                            chapterId: chapterId || "",
                                            moduleId: moduleId || "",
                                            subjectId: subjectId || "",
                                            packageSessionId: packageSessionId || "",
                                        },
                                        payload: apiPayload,
                                        force: true,
                                    });
                                    activity.sync_status = "SYNCED";
                                    activity.new_activity = false;
                                    updatedActivities.push(activity);
                                    didSync = true;
                                    continue;
                                } catch (queueErr) {
                                    console.error("[usePDFSync] failed to queue offline event", queueErr);
                                }
                            }
                            throw err;
                        } finally {
                            inFlight.delete(activity.activity_id);
                        }
                    } else {
                        // Not syncable this tick (no page views yet, or not
                        // re-registered). Keep it — dropping it here erased
                        // accumulated page views that hadn't reached the
                        // backend yet.
                        updatedActivities.push(activity);
                    }
                } catch (error) {
                    console.error("API call failed:", error);
                    updatedActivities.push(activity);
                }
            }

            // Persist SYNCED status BEFORE triggering the slides refresh.
            // refreshSlides() invalidates queries which can re-mount this
            // viewer; the new mount must read the SYNCED state from storage
            // or it will re-fire the same activity in a tight loop.
            await Preferences.set({
                key: STORAGE_KEY,
                value: JSON.stringify({ data: updatedActivities }),
            });

            if (didSync) {
                await refreshSlides();
            }
        } catch (error) {
            console.error("Failed to sync PDF tracking data:", error);
            throw error;
        }
    };

    syncFnRef.current = syncPDFTrackingData;

    return { syncPDFTrackingData };
};
