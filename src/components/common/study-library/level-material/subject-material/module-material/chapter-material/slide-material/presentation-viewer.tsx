import type React from "react";
import { useEffect, useState, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { useTrackingStore } from "@/stores/study-library/pdf-tracking-store";
import { getISTTime, getEpochTimeInMillis } from "./utils";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { FileX } from "@phosphor-icons/react";
import { ExcalidrawViewer } from "./ExcalidrawViewer";

interface PresentationViewerProps {
  slideTitle?: string;
}

const PresentationViewer: React.FC<PresentationViewerProps> = ({
  slideTitle,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  const { addActivity } = useTrackingStore();
  const { activeItem } = useContentStore();

  const activityId = useRef(uuidv4());
  const startTime = useRef(getISTTime());
  const startTimeInMillis = useRef(getEpochTimeInMillis());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const viewStartTime = useRef<Date>(new Date());

  // Get fileId from activeItem.document_slide.published_data
  const fileId = activeItem?.document_slide?.published_data;

  // Debug logging
  useEffect(() => {
    console.log("[PresentationViewer] Props and activeItem:", {
      fileId,
      slideTitle,
      activeItem: activeItem ? {
        id: activeItem.id,
        source_id: activeItem.source_id,
        source_type: activeItem.source_type,
        title: activeItem.title
      } : null
    });
  }, [fileId, slideTitle, activeItem]);

  // Timer functionality
  const startTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    startTimer();
    return () => {
      stopTimer();
    };
  }, []);

  // Track activity
  useEffect(() => {
    if (fileId) {
      console.log("[PresentationViewer] Adding activity with fileId:", fileId);
      addActivity({
        slide_id: activeItem?.id || "",
        activity_id: activityId.current,
        source: "PRESENTATION" as const,
        source_id: fileId,
        start_time: startTime.current,
        end_time: getISTTime(),
        start_time_in_millis: startTimeInMillis.current,
        end_time_in_millis: getEpochTimeInMillis(),
        duration: elapsedTime.toString(),
        page_views: [
          {
            id: uuidv4(),
            page: 1,
            duration: elapsedTime,
            start_time: viewStartTime.current.toISOString(),
            end_time: new Date().toISOString(),
            start_time_in_millis: viewStartTime.current.getTime(),
            end_time_in_millis: Date.now(),
          },
        ],
        total_pages_read: 1,
        sync_status: "STALE",
        current_page: 1,
        current_page_start_time_in_millis: viewStartTime.current.getTime(),
        new_activity: true,
        concentration_score: {
          id: activityId.current,
          concentration_score: 0,
          tab_switch_count: 0,
          pause_count: 0,
          wrong_answer_count: 0,
          answer_times_in_seconds: [],
        },
      });
    } else {
              console.warn("[PresentationViewer] No fileId available from activeItem.document_slide.published_data");
    }
  }, [elapsedTime, fileId, activeItem?.id, addActivity]);

  // If fileId is undefined, show error state
  if (!fileId) {
    console.error("[PresentationViewer] fileId not available from activeItem.document_slide.published_data:", { activeItem });
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh] bg-gradient-to-br from-red-50 to-orange-50">
        <div className="text-center space-y-6 p-8 max-w-md mx-auto">
          <div className="relative">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-200">
              <FileX size={40} weight="duotone" className="text-red-500" />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Missing Presentation File
              </h3>
              <p className="text-gray-600 leading-relaxed">
                No presentation file ID found in the current slide data.
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700 font-medium">Debug Info:</p>
              <p className="text-sm text-red-600 mt-1">
                                  activeItem.document_slide.published_data: {JSON.stringify(activeItem?.document_slide?.published_data)}<br/>
                  activeItem.source_type: {JSON.stringify(activeItem?.source_type)}<br/>
                slideTitle: {JSON.stringify(slideTitle)}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ExcalidrawViewer 
        fileId={fileId} 
        slideTitle={slideTitle || activeItem?.title} 
      />
    </div>
  );
};

export default PresentationViewer;
