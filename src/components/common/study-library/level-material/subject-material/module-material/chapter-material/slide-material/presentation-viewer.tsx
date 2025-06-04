import type React from "react";
import { useEffect, useState, useRef } from "react";
import { Excalidraw, THEME } from "@excalidraw/excalidraw";
import { v4 as uuidv4 } from "uuid";
import { useTrackingStore } from "@/stores/study-library/pdf-tracking-store";
import { getISTTime, getEpochTimeInMillis } from "./utils";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";

interface PresentationViewerProps {
  presentationUrl: string;
  documentId?: string;
}

const PresentationViewer: React.FC<PresentationViewerProps> = ({
  presentationUrl,
  documentId,
}) => {
  const [presentationData, setPresentationData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const { addActivity } = useTrackingStore();
  const { activeItem } = useContentStore();

  const activityId = useRef(uuidv4());
  const startTime = useRef(getISTTime());
  const startTimeInMillis = useRef(getEpochTimeInMillis());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const viewStartTime = useRef<Date>(new Date());

  const extractExcalidrawData = (htmlContent: string): any[] => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, "text/html");

      // Try <script type="application/json">
      const jsonScript = doc.querySelector('script[type="application/json"]');
      if (jsonScript) {
        const data = JSON.parse(jsonScript.textContent || "{}");
        if (data.isExcalidraw && Array.isArray(data.elements)) {
          return data.elements;
        }
      }

      // Try inline <script> containing 'const excalidrawData ='
      const scripts = doc.querySelectorAll("script");
      for (const script of scripts) {
        const content = script.textContent || "";
        const match = content.match(
          /const\s+excalidrawData\s*=\s*(\{[\s\S]*?\});/
        );
        if (match && match[1]) {
          const data = JSON.parse(match[1]);
          if (data.isExcalidraw && Array.isArray(data.elements)) {
            return data.elements;
          }
        }
      }

      // Try a div with data-excalidraw attribute
      const dataDiv = doc.querySelector("[data-excalidraw]");
      if (dataDiv) {
        const data = JSON.parse(
          dataDiv.getAttribute("data-excalidraw") || "{}"
        );
        if (data.isExcalidraw && Array.isArray(data.elements)) {
          return data.elements;
        }
      }

      console.warn("No valid Excalidraw data found.");
      return [];
    } catch (err) {
      console.error("Error extracting Excalidraw data:", err);
      return [];
    }
  };

  // Fetch presentation data from the URL
  useEffect(() => {
    const fetchPresentationData = async () => {
      try {
        setLoading(true);
        const response = await fetch(presentationUrl);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch presentation: ${response.statusText}`
          );
        }

        const htmlContent = await response.text();
        const data = extractExcalidrawData(htmlContent);
        setPresentationData(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching presentation:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load presentation"
        );
      } finally {
        setLoading(false);
      }
    };

    if (presentationUrl) {
      fetchPresentationData();
    }
  }, [presentationUrl]);

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
    if (!loading && !error) {
      addActivity({
        slide_id: activeItem?.id || "",
        activity_id: activityId.current,
        source: "PRESENTATION" as const,
        source_id: documentId || "",
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
    }
  }, [elapsedTime, documentId, loading, error, activeItem?.id, addActivity]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading presentation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Failed to Load Presentation
          </h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <Excalidraw
        initialData={{
          elements: presentationData,
          appState: {
            viewModeEnabled: true,
            gridModeEnabled: false,
            theme: THEME.LIGHT,
          },
        }}
        viewModeEnabled={true}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
            saveAsImage: false,
          },
          tools: {
            image: false,
          },
        }}
        renderTopRightUI={() => null}
        detectScroll={false}
        handleKeyboardGlobally={false}
      />
    </div>
  );
};

export default PresentationViewer;
