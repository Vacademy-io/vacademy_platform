// usePDFSync.ts
import { ActivitySchema } from "@/schemas/study-library/pdf-tracking-schema";
import { useAddDocumentActivity } from "@/services/study-library/tracking-api/add-document-activity";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { TrackingDataType } from "@/types/tracking-data-type";
import { calculateAndUpdatePageViews } from "@/utils/study-library/tracking/calculateAndUpdatePageViews";
import { Preferences } from "@capacitor/preferences";
import { useRouter } from "@tanstack/react-router";
import { z } from "zod";

const STORAGE_KEY = "pdf_tracking_data";
const USER_ID_KEY = "StudentDetails";

export const usePDFSync = () => {
  const addUpdateDocumentActivity = useAddDocumentActivity();
  const { activeItem } = useContentStore();
  const router = useRouter();
  const { chapterId } = router.state.location.search;

  const syncPDFTrackingData = async () => {
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

      for (let activity of activities) {
        if (activity.sync_status === "SYNCED") {
          updatedActivities.push(activity);
          continue;
        }

        activity = calculateAndUpdatePageViews(activity);

        const apiPayload: TrackingDataType = {
          id: activity.activity_id,
          source_id: activity.source_id,
          source_type: activity.source,
          user_id: chapterId || "",
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
          if (activity.page_views.length >= 1 && activity.new_activity) {
            await addUpdateDocumentActivity.mutateAsync({
              slideId: activity.slide_id || "",
              chapterId: chapterId || "",
              requestPayload: apiPayload,
            });
            activity.sync_status = "SYNCED";
            activity.new_activity = false; // Move this here, after successful API call
            updatedActivities.push(activity);
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
      console.error("Failed to sync PDF tracking data:", error);
      throw error;
    }
  };

  return { syncPDFTrackingData };
};
