/* eslint-disable */
import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { CodeEditorSlide } from "./code-editor-slide";
import { JupyterNotebookSlide } from "./jupyter-notebook-slide";
import { ScratchProjectSlide } from "./scratch-project-slide";
import YouTubePlayerWrapper from "./youtube-player";
import CustomVideoPlayer from "./custom-video-player";
import { useFileUpload } from "@/hooks/use-file-upload";
import { extractVideoId } from "@/utils/study-library/tracking/extractVideoId";
import { DotsSixVertical } from "@phosphor-icons/react";

interface SplitScreenVideoSlideProps {
  videoSlide: {
    source_type: string;
    published_url?: string;
    url?: string;
    embedded_type?: "CODE" | "SCRATCH" | "JUPYTER";
    embedded_data?: string;
    questions?: unknown[];
  };
  status: string;
  onTimeUpdate?: () => void;
  progressMarker?: number;
}

export const SplitScreenVideoSlide: React.FC<SplitScreenVideoSlideProps> = ({
  videoSlide,
  status,
  onTimeUpdate,
  progressMarker,
}) => {
  const [leftWidth, setLeftWidth] = useState(50); // Percentage width for left panel
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { getPublicUrl } = useFileUpload();
  const playerRef = useRef<HTMLVideoElement | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newLeftWidth =
      ((e.clientX - containerRect.left) / containerRect.width) * 100;

    // Constrain between 20% and 80%
    const constrainedWidth = Math.max(20, Math.min(80, newLeftWidth));
    setLeftWidth(constrainedWidth);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  const renderEmbeddedSlide = () => {
    if (!videoSlide.embedded_type || !videoSlide.embedded_data) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-neutral-500">No embedded content</div>
        </div>
      );
    }

    switch (videoSlide.embedded_type) {
      case "CODE":
        return <CodeEditorSlide published_data={videoSlide.embedded_data} />;
      case "JUPYTER":
        return (
          <JupyterNotebookSlide published_data={videoSlide.embedded_data} />
        );
      case "SCRATCH":
        return (
          <ScratchProjectSlide published_data={videoSlide.embedded_data} />
        );
      default:
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-neutral-500">Unsupported embedded type</div>
          </div>
        );
    }
  };

  const renderVideoPlayer = async () => {
    const fileId =
      status === "PUBLISHED" ? videoSlide.published_url : videoSlide.url;

    if (videoSlide.source_type === "FILE_ID") {
      if (!fileId) {
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-neutral-500">Video file not available</div>
          </div>
        );
      }

      const videoUrl = await getPublicUrl(fileId);
      if (!videoUrl) {
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-neutral-500">Failed to load video</div>
          </div>
        );
      }

      return (
        <div className="h-full w-full bg-black rounded-lg overflow-hidden">
          <CustomVideoPlayer
            videoUrl={videoUrl}
            onTimeUpdate={onTimeUpdate}
            ref={playerRef}
          />
        </div>
      );
    } else {
      // YouTube or other video sources
      const videoId = extractVideoId(fileId || "");
      return (
        <div className="h-full w-full bg-black rounded-lg overflow-hidden">
          <YouTubePlayerWrapper
            videoId={videoId}
            onTimeUpdate={onTimeUpdate}
            ref={playerRef}
            ms={progressMarker}
            questions={(videoSlide.questions as any) || []}
          />
        </div>
      );
    }
  };

  const [videoContent, setVideoContent] = useState<JSX.Element | null>(null);

  useEffect(() => {
    renderVideoPlayer().then(setVideoContent);
  }, [videoSlide, status]);

  return (
    <div className="h-full p-1">
      <Card className="h-full flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-neutral-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-primary-500 rounded-full"></div>
              <div>
                <h3 className="font-medium text-sm text-neutral-900">
                  Split Screen Learning
                </h3>
                <p className="text-xs text-neutral-500">
                  Video with{" "}
                  {videoSlide.embedded_type?.toLowerCase() || "content"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Split Screen Content */}
        <div className="flex-1 relative overflow-hidden" ref={containerRef}>
          <div className="flex h-full">
            {/* Left Panel - Embedded Content */}
            <div
              className="relative overflow-hidden"
              style={{ width: `${leftWidth}%` }}
            >
              <div className="h-full">{renderEmbeddedSlide()}</div>
            </div>

            {/* Resizer */}
            <div
              className={`relative flex items-center justify-center w-2 bg-neutral-100 hover:bg-neutral-200 cursor-col-resize transition-colors group ${
                isDragging ? "bg-primary-200" : ""
              }`}
              onMouseDown={handleMouseDown}
            >
              <div className="absolute inset-y-0 w-4 -mx-1" />
              <DotsSixVertical
                size={16}
                className={`text-neutral-400 group-hover:text-neutral-600 transition-colors ${
                  isDragging ? "text-primary-600" : ""
                }`}
              />
            </div>

            {/* Right Panel - Video */}
            <div
              className="relative overflow-hidden"
              style={{ width: `${100 - leftWidth}%` }}
            >
              <div className="h-full p-2">
                {videoContent || (
                  <div className="flex items-center justify-center h-full bg-neutral-100 rounded-lg">
                    <div className="text-neutral-500">Loading video...</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Drag Overlay */}
          {isDragging && (
            <div className="absolute inset-0 bg-transparent cursor-col-resize z-10" />
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-neutral-200 px-4 py-2">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <div className="flex items-center gap-4">
              <span>Layout: Split Screen</span>
              <span>Left: {videoSlide.embedded_type}</span>
              <span>Right: Video</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                Interactive
              </span>
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                Resizable
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
