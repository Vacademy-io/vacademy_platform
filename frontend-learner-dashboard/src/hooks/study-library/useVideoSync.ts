// useVideoSync.ts
import { ActivitySchema } from "@/schemas/study-library/youtube-video-tracking-schema";
import { useAddVideoActivity } from "@/services/study-library/tracking-api/add-video-activity";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { TrackingDataType } from "@/types/tracking-data-type";
import { calculateAndUpdateTimestamps } from "@/utils/study-library/tracking/calculateAndUpdateTimestamps";
import { Preferences } from "@capacitor/preferences";
import { useRouter } from "@tanstack/react-router";
import { z } from "zod";

const STORAGE_KEY = "video_tracking_data";
const USER_ID_KEY = "StudentDetails";

export const useVideoSync = () => {
  const addUpdateVideoActivity = useAddVideoActivity();
  const { activeItem } = useContentStore();
  const router = useRouter();
  const { chapterId } = router.state.location.search;

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

      for (let i = 0; i < activities.length; i++) {
        let activity = activities[i];

        if (activity.sync_status === "SYNCED") {
          if (i === activities.length - 1) {
            updatedActivities.push(activity);
          }
          continue;
        }

        activity = calculateAndUpdateTimestamps(activity);

        const apiPayload: TrackingDataType = {
          id: activity.activity_id,
          source_id: activity.source_id,
          source_type: activity.source,
          user_id: userId,
          slide_id: activeItem?.id || "",
          start_time_in_millis: activity.start_time,
          end_time_in_millis: activity.end_time,
          percentage_watched: parseFloat(activity.percentage_watched),
          videos: activity.timestamps.map((timestamp) => ({
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
            try {
              await addUpdateVideoActivity.mutateAsync({
                slideId: activity.id || "",
                chapterId: chapterId || "",
                requestPayload: apiPayload,
              });
              activity.sync_status = "SYNCED";
              activity.new_activity = false; // Move this here, after successful API call
              updatedActivities.push(activity);
            } catch (err) {
              console.log("add api call failed: ", err);
            }
          } else {
            if (apiPayload.videos && apiPayload.videos.length > 0) {
              try {
                await addUpdateVideoActivity.mutateAsync({
                  slideId: activity.id || "",
                  chapterId: chapterId || "",
                  requestPayload: apiPayload,
                });
                activity.sync_status = "SYNCED";
                updatedActivities.push(activity);
              } catch (err) {
                console.log("update api call failed: ", err);
              }
            }
          }
        } catch (error) {
          console.error("API call failed:", error);
          updatedActivities.push(activity);
        }
      }

      await Preferences.set({
        key: STORAGE_KEY,
        value: JSON.stringify({ data: updatedActivities }),
      });
    } catch (error) {
      console.error("Failed to sync video tracking data:", error);
      throw error;
    }
  };

  return { syncVideoTrackingData };
};
