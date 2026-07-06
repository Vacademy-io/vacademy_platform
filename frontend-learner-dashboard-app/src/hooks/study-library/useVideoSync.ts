// useVideoSync.ts
import { ActivitySchema } from "@/schemas/study-library/youtube-video-tracking-schema";
import { useAddVideoActivity } from "@/services/study-library/tracking-api/add-video-activity";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { TrackingDataType } from "@/types/tracking-data-type";
import { getPackageSessionId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import { calculateAndUpdateTimestamps } from "@/utils/study-library/tracking/calculateAndUpdateTimestamps";
import { Preferences } from "@capacitor/preferences";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useSlidesRefresh } from "./useSlidesRefresh";
import { ADD_UPDATE_VIDEO_ACTIVITY } from "@/constants/urls";

const STORAGE_KEY = "video_tracking_data";
const USER_ID_KEY = "StudentDetails";

// Module-level guard: holds activity_ids currently being POSTed. Prevents
// two concurrent callers (e.g. a remount-refire loop triggered by
// refreshSlides) from both reading new_activity=true from Preferences
// before either has written SYNCED back, which would race the backend's
// video_tracked delete+insert path and surface as a 511.
const inFlight = new Set<string>();

export const useVideoSync = () => {
  const addUpdateVideoActivity = useAddVideoActivity();
  const { activeItem } = useContentStore();
  const router = useRouter();
  const { chapterId, moduleId, subjectId } = router.state.location.search;
  const [packageSessionId, setPackageSessionId] = useState<string | null>(null);
  const { refreshSlides } = useSlidesRefresh();

  useEffect(() => {
    const fetchPackageSessionId = async () => {
      const id = await getPackageSessionId();
      setPackageSessionId(id);
    };
    fetchPackageSessionId();
  }, []);

  // Tab-close safety net. The periodic 60s sync covers the "user keeps the
  // tab open" case; this covers "user pauses then closes the tab". We use
  // fetch with keepalive:true (not sendBeacon, which can't set Authorization)
  // so the browser is guaranteed to flush the request even after the page
  // unloads. Web only — Capacitor native has its own background lifecycle.
  useEffect(() => {
    const handlePageHide = () => {
      try {
        const raw = localStorage.getItem("CapacitorStorage." + STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const activities = (parsed?.data ?? []) as Array<
          z.infer<typeof ActivitySchema>
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
        const userId: string | undefined = student?.user_id || student?.userId;
        if (!userId) return;

        // Snapshot route context from current URL — synchronous and reliable
        // during pagehide. We only flush activities for the slide that's
        // currently in the URL, since older slides' route context isn't
        // available here.
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
          ADD_UPDATE_VIDEO_ACTIVITY +
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
          "X-User-Id": String(userId),
          "X-Package-Session-Id": packageSessionIdInUrl,
        };
        if (instituteId) {
          headers["clientId"] = instituteId;
          headers["X-Institute-Id"] = instituteId;
        }

        for (const activity of pending) {
          // Only flush activities that match the current slide — we don't
          // have route context for other slides during pagehide.
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

          // Guard the activity-level window too (mirrors syncVideoTrackingData's
          // hasValidActivityWindow). Without this, a tab closed before playback set
          // videoStartTime beacons start_time = 0 (-> 1970) or an end < start row.
          if (
            typeof activity.start_time !== "number" ||
            typeof activity.end_time !== "number" ||
            isNaN(activity.start_time) ||
            isNaN(activity.end_time) ||
            activity.start_time <= 0 ||
            activity.end_time <= activity.start_time
          ) {
            continue;
          }

          const payload: TrackingDataType = {
            id: activity.activity_id,
            source_id: "",
            source_type: activity.source,
            user_id: userId,
            slide_id: slideIdInUrl,
            start_time_in_millis: activity.start_time,
            end_time_in_millis: activity.end_time,
            percentage_watched: parseFloat(activity.percentage_watched),
            videos: validTimestamps.map((t) => ({
              id: t.id,
              start_time_in_millis: t.start,
              end_time_in_millis: t.end,
            })),
            documents: null,
            new_activity: activity.new_activity,
            concentration_score: {
              id:
                crypto.randomUUID?.() ??
                Math.random().toString(36).substring(2, 15),
              concentration_score: 0,
              tab_switch_count: 0,
              pause_count: 0,
              answer_times_in_seconds: [],
            },
          };

          // Fire-and-forget. keepalive:true lets the browser complete the
          // request after the page unloads. We don't await the response.
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

  const syncVideoTrackingData = async () => {
    try {
      const userDetailsStr = await Preferences.get({ key: USER_ID_KEY });
      const userDetails = userDetailsStr.value
        ? JSON.parse(userDetailsStr.value)
        : null;
      const userId = userDetails?.user_id;

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

      for (let i = 0; i < activities.length; i++) {
        let activity = activities[i];

        if (activity.sync_status === "SYNCED") {
          if (i === activities.length - 1) {
            updatedActivities.push(activity);
          }
          continue;
        }

        if (inFlight.has(activity.activity_id)) {
          updatedActivities.push(activity);
          continue;
        }

        activity = calculateAndUpdateTimestamps(activity);

        // Helper function to validate video timestamp entry
        const isValidVideoTimestamp = (timestamp: { id: string; start: number; end: number }) => {
          return (
            timestamp.start != null &&
            timestamp.end != null &&
            typeof timestamp.start === 'number' &&
            typeof timestamp.end === 'number' &&
            !isNaN(timestamp.start) &&
            !isNaN(timestamp.end) &&
            timestamp.start >= 0 &&
            timestamp.end >= 0 &&
            timestamp.end > timestamp.start
          );
        };

        // Filter out invalid timestamps before creating payload
        const validTimestamps = activity.timestamps.filter(isValidVideoTimestamp);
        const invalidTimestamps = activity.timestamps.filter(t => !isValidVideoTimestamp(t));

        // Guard against invalid activity duration — backend rejects end_time <= start_time
        // with "Invalid activity duration" (ConcentrationScoreService). Skip the sync and
        // mark SYNCED so we don't keep retrying the same broken record.
        const hasValidActivityWindow =
          typeof activity.start_time === 'number' &&
          typeof activity.end_time === 'number' &&
          !isNaN(activity.start_time) &&
          !isNaN(activity.end_time) &&
          activity.start_time > 0 &&
          activity.end_time > activity.start_time;

        if (!hasValidActivityWindow) {
          console.warn('🚨 [useVideoSync] Skipping activity with invalid duration window:', {
            activityId: activity.activity_id,
            slideId: activity.id,
            start_time: activity.start_time,
            end_time: activity.end_time,
          });
          activity.sync_status = 'SYNCED';
          updatedActivities.push(activity);
          continue;
        }

        // Log invalid entries for debugging
        if (invalidTimestamps.length > 0) {
          console.warn('🚨 [useVideoSync] Invalid video tracking timestamps detected and filtered out:', {
            activityId: activity.activity_id,
            slideId: activity.id,
            invalidTimestamps: invalidTimestamps.map(t => ({
              id: t.id,
              start: t.start,
              end: t.end,
              startType: typeof t.start,
              endType: typeof t.end,
            })),
          });
        }

        const apiPayload: TrackingDataType = {
          id: activity.activity_id,
          source_id: '',
          source_type: activity.source,
          user_id: userId,
          slide_id: activeItem?.id || "",
          start_time_in_millis: activity.start_time,
          end_time_in_millis: activity.end_time,
          percentage_watched: parseFloat(activity.percentage_watched),
          videos: validTimestamps.map((timestamp) => ({
            id: timestamp.id,
            start_time_in_millis: timestamp.start,
            end_time_in_millis: timestamp.end,
          })),
          documents: null,
          new_activity: activity.new_activity,
          concentration_score: {
            id: crypto.randomUUID
              ? crypto.randomUUID()
              : Math.random().toString(36).substring(2, 15) +
                Math.random().toString(36).substring(2, 15),
            concentration_score: 0,
            tab_switch_count: 0,
            pause_count: 0,
            answer_times_in_seconds: [],
          },
        };

        try {
          if (
            activity.new_activity &&
            apiPayload.videos &&
            apiPayload.videos.length > 0
          ) {
            console.log(
              "Hitting add video activity api: ",
              activity.new_activity
            );
            inFlight.add(activity.activity_id);
            try {
              console.log(`📡 [useVideoSync] Making API call for NEW activity: ${activity.activity_id}`);
              await addUpdateVideoActivity.mutateAsync({
                slideId: activity.id || "",
                chapterId: chapterId || "",
                requestPayload: apiPayload,
                packageSessionId: packageSessionId || "",
                moduleId: moduleId || "",
                subjectId: subjectId || "",
              });
              console.log(`✅ [useVideoSync] NEW activity API call successful: ${activity.activity_id}`);
              activity.sync_status = "SYNCED";
              activity.new_activity = false; // Move this here, after successful API call
              updatedActivities.push(activity);
              didSync = true;
            } catch (err) {
              console.log("add api call failed: ", err);
            } finally {
              inFlight.delete(activity.activity_id);
            }
          } else {
            if (apiPayload.videos && apiPayload.videos.length > 0) {
              inFlight.add(activity.activity_id);
              try {
                console.log(`📡 [useVideoSync] Making API call for UPDATE activity: ${activity.activity_id}`);
                await addUpdateVideoActivity.mutateAsync({
                  slideId: activity.id || "",
                  chapterId: chapterId || "",
                  requestPayload: apiPayload,
                  packageSessionId: packageSessionId || "",
                  moduleId: moduleId || "",
                  subjectId: subjectId || "",
                });
                console.log(`✅ [useVideoSync] UPDATE activity API call successful: ${activity.activity_id}`);
                activity.sync_status = "SYNCED";
                updatedActivities.push(activity);
                didSync = true;
              } catch (err) {
                console.log("update api call failed: ", err);
              } finally {
                inFlight.delete(activity.activity_id);
              }
            }
          }
        } catch (error) {
          console.error("API call failed:", error);
          updatedActivities.push(activity);
        }
      }

      // Persist SYNCED status BEFORE triggering the slides refresh.
      // refreshSlides() invalidates queries which can re-mount the viewer;
      // the new mount must read the SYNCED state from storage or it will
      // re-fire the same activity, generating duplicate concurrent inserts
      // that race the backend's video_tracked delete+insert path and
      // surface as 511 (duplicate-key constraint violation).
      await Preferences.set({
        key: STORAGE_KEY,
        value: JSON.stringify({ data: updatedActivities }),
      });

      if (didSync) {
        console.log("🔄 [useVideoSync] Triggering slides refresh after sync...");
        await refreshSlides();
        console.log("✅ [useVideoSync] Slides refresh completed");
      }
    } catch (error) {
      console.error("Failed to sync video tracking data:", error);
      throw error;
    }
  };

  return { syncVideoTrackingData };
};
