import { ActivitySchema } from "@/schemas/study-library/presentation-tracking-schema";
import { useAddDocumentActivity } from "@/services/study-library/tracking-api/add-document-activity";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { TrackingDataType } from "@/types/tracking-data-type";
import { getPackageSessionId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import { Preferences } from "@capacitor/preferences";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useSlidesRefresh } from "./useSlidesRefresh";

const STORAGE_KEY = "presentation_tracking_data";
const USER_ID_KEY = "StudentDetails";

export const usePresentationSync = () => {
  const addUpdateDocumentActivity = useAddDocumentActivity();
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

  const syncPresentationTrackingData = async () => {
    console.log("🚀 [usePresentationSync] Starting presentation sync process");
    try {
      const userDetailsStr = await Preferences.get({ key: USER_ID_KEY });
      const userDetails = userDetailsStr.value
        ? JSON.parse(userDetailsStr.value)
        : null;
      const userId = userDetails?.user_id;

      console.log("👤 [usePresentationSync] User ID found:", userId);

      if (!userId) {
        throw new Error("User ID not found in storage");
      }

      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (!value) {
        console.log("📭 [usePresentationSync] No tracking data found in storage");
        return;
      }

      console.log("📊 [usePresentationSync] Found tracking data, processing...");

      const trackingData = JSON.parse(value);
      const activities = trackingData.data as Array<
        z.infer<typeof ActivitySchema>
      >;
      const updatedActivities = [];

      console.log(`📋 [usePresentationSync] Processing ${activities.length} activities`);

      for (let activity of activities) {
        if (activity.sync_status === "SYNCED") {
          console.log(`✅ [usePresentationSync] Activity ${activity.activity_id} already synced, skipping`);
          updatedActivities.push(activity);
          continue;
        }

        console.log(`🔄 [usePresentationSync] Processing unsynced activity: ${activity.activity_id}`);

        // Total viewing time is not used for percentage calculation (presentations are 100% on view)

                 const apiPayload: TrackingDataType = {
           id: activity.activity_id,
           source_id: activity.source_id,
           source_type: "PRESENTATION",
           user_id: userId,
           slide_id: activeItem?.id || "",
           start_time_in_millis: activity.start_time_in_millis,
           end_time_in_millis: activity.end_time_in_millis,
           percentage_watched: 100, // Presentations are marked as 100% complete when viewed
                     videos: null,
           documents: activity.view_sessions.length > 0 
             ? activity.view_sessions.map((session, index) => ({
                 id: session.id,
                 start_time_in_millis: session.start_time_in_millis,
                 end_time_in_millis: session.end_time_in_millis,
                 page_number: index + 1, // Presentations are treated as single page documents
               }))
             : [{
                 id: activity.activity_id,
                 start_time_in_millis: activity.start_time_in_millis,
                 end_time_in_millis: activity.end_time_in_millis,
                 page_number: 1, // Single page for presentation viewing
               }],
          new_activity: activity.new_activity,
          concentration_score: activity.concentration_score,
        };

                try {
          // For presentations, we want to sync immediately when it's a new activity, even without view sessions
          if (activity.new_activity || activity.view_sessions.length >= 1) {
            console.log(`📡 [usePresentationSync] Making API call for activity: ${activity.activity_id}`);
            console.log(`📡 [usePresentationSync] API payload:`, {
              slideId: activity.slide_id,
              chapterId,
              percentage_watched: apiPayload.percentage_watched,
              new_activity: apiPayload.new_activity
            });

            await addUpdateDocumentActivity.mutateAsync({
              slideId: activity.slide_id || "",
              chapterId: chapterId || "",
              requestPayload: apiPayload,
              packageSessionId: packageSessionId || "",
              moduleId: moduleId || "",
              subjectId: subjectId || "",
            });
            
            console.log(`✅ [usePresentationSync] API call successful for activity: ${activity.activity_id}`);
            
            activity.sync_status = "SYNCED";
            activity.new_activity = false;
            updatedActivities.push(activity);
            
            // Refresh slides data to get updated progress
            console.log("🔄 [usePresentationSync] Triggering slides refresh...");
            await refreshSlides();
            console.log("✅ [usePresentationSync] Slides refresh completed");
          } else {
            console.log(`⏭️ [usePresentationSync] Skipping activity ${activity.activity_id}: view_sessions=${activity.view_sessions.length}, new_activity=${activity.new_activity}, sync_status=${activity.sync_status}`);
            updatedActivities.push(activity);
          }
        } catch (error) {
          console.error("❌ [usePresentationSync] API call failed:", error);
          updatedActivities.push(activity);
        }
      }

      await Preferences.set({
        key: STORAGE_KEY,
        value: JSON.stringify({ data: updatedActivities }),
      });
    } catch (error) {
      console.error("Failed to sync presentation tracking data:", error);
      throw error;
    }
  };

  return { syncPresentationTrackingData };
}; 