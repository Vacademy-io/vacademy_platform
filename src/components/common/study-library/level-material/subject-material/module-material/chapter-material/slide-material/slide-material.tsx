import { useEffect, useRef, useState } from "react";
import PDFViewer from "./pdf-viewer";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { EmptySlideMaterial } from "@/assets/svgs";
import YouTubePlayerWrapper from "./youtube-player";
import { useFileUpload } from "@/hooks/use-file-upload";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { extractVideoId } from "@/utils/study-library/tracking/extractVideoId";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { ChatText } from "@phosphor-icons/react";
import { DoubtResolutionSidebar } from "./doubt-resolution-sidebar/components/sidebar";
import CustomVideoPlayer from "./custom-video-player";
import QuestionSlide from "./question-slide";
import AssignmentSlide from "./assignment-slide";

import { MyButton } from "@/components/design-system/button";
import { DocViewer } from "./doc-viewer";
import PresentationViewer from "./presentation-viewer";

export const SlideMaterial = () => {
  const { activeItem } = useContentStore();
  const selectionRef = useRef(null);
  const loadGenerationRef = useRef(0);
  const [heading, setHeading] = useState(activeItem?.title || "");
  const [content, setContent] = useState<JSX.Element | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { uploadFile, getPublicUrl } = useFileUpload();
  const { toggleSidebar, open } = useSidebar();


  const playerRef = useRef<any>(null);

  // Video time update handler - simplified since questions are now handled internally by YouTube player
  const handleVideoTimeUpdate = (currentTime: number) => {
    // Questions are now handled internally by the YouTube player component
    // This function can be used for other time-based functionality if needed
  };

  const handleQuestionSubmit = async (
    selectedOption: string | string[]
  ) => {
    const optionToSubmit = Array.isArray(selectedOption)
      ? selectedOption[0]
      : selectedOption;

    // Questions are now handled internally by the YouTube player
    // This function is kept for other question types (e.g., QuestionSlide)
    return {
      success: true,
      isCorrect: true,
      correctOption: optionToSubmit,
      explanation: "Correct answer!",
    };
  };

  const handleAssignmentUpload = async (file: File) => {
    try {
      setIsUploading(true);
      const fileId = await uploadFile({
        file,
        setIsUploading,
        userId: "your-user-id",
        source: "ASSIGNMENT",
        sourceId: activeItem?.source_id || "",
        publicUrl: true,
      });
      if (fileId) {
        console.log(`Assignment uploaded: ${fileId}`);
        return { success: true, fileId };
      }
      return { success: false, error: "Upload failed" };
    } catch (error) {
      console.error("Assignment upload error:", error);
      return { success: false, error: "Upload failed" };
    } finally {
      setIsUploading(false);
    }
  };

  const loadContent = async (generationId: number) => {
    if (generationId !== loadGenerationRef.current) return;
    setError(null);

    if (!activeItem) {
      if (generationId !== loadGenerationRef.current) return;
      setContent(
        <div className="flex h-[500px] flex-col items-center justify-center rounded-lg py-10">
          <EmptySlideMaterial />
          <p className="mt-4 text-neutral-500">
            No study material has been added yet
          </p>
        </div>
      );
      return;
    }

    if (generationId !== loadGenerationRef.current) return;
    setContent(<DashboardLoader />);

    try {
      switch (activeItem.source_type) {
        case "VIDEO": {
          if (generationId !== loadGenerationRef.current) return;
          const videoSourceType = activeItem.video_slide?.source_type;
          const videoStatus = activeItem.status;
          const fileId =
            videoStatus === "PUBLISHED"
              ? activeItem.video_slide?.published_url
              : activeItem.video_slide?.url;

          switch (videoSourceType) {
            case "FILE_ID": {
              if (!fileId) throw new Error("Video file ID not available");
              const videoUrl = await getPublicUrl(fileId);
              if (!videoUrl) throw new Error("Failed to retrieve video URL");
              setContent(
                <div
                  key={`video-${activeItem.id}`}
                  className="h-full w-full overflow-hidden rounded-lg"
                >
                  <CustomVideoPlayer
                    videoUrl={videoUrl}
                    onTimeUpdate={handleVideoTimeUpdate}
                    ref={playerRef}
                  />
                </div>
              );
              break;
            }
            default:
              setContent(
                <div key={`video-${activeItem.id}`} className="h-full w-full">
                  <YouTubePlayerWrapper
                    videoId={extractVideoId(
                      activeItem.video_slide?.published_url ||
                        activeItem.video_slide?.url ||
                        ""
                    )}
                    onTimeUpdate={handleVideoTimeUpdate}
                    ref={playerRef}
                    ms={activeItem.progress_marker}
                    questions={activeItem.video_slide?.questions || []}
                  />
                </div>
              );
              break;
          }
          break;
        }

        case "QUESTION": {
          if (activeItem.question_slide) {
            setContent(
              <QuestionSlide
                questionData={activeItem.question_slide}
                onSubmit={handleQuestionSubmit}
              />
            );
          }
          break;
        }

        case "DOCUMENT":
          if (activeItem.document_slide?.type === "PDF") {
            const url = await getPublicUrl(
              activeItem.document_slide.published_data || ""
            );
            if (!url) throw new Error("Failed to retrieve PDF URL");
            // NOTE: PDFViewer might need specific sizing, so we can keep a special case for it.
            setContent(<div className="h-full w-full max-w-4xl mx-auto"><PDFViewer pdfUrl={url} /></div>);
          } else if (activeItem.document_slide?.type === "DOC") {
                    const isHtml = activeItem.document_slide.published_data && 
                                  activeItem.document_slide.published_data.includes("<html");
                    if (isHtml) {
                        setContent(
                            <DocViewer
                                docUrl={activeItem.document_slide.published_data}
                                documentId={activeItem.id}
                                isHtml={true}
                            />
                        );
                    } else {
                        const url = await getPublicUrl(activeItem.document_slide.published_data);
                        setContent(
                            <DocViewer
                                docUrl={url}
                                documentId={activeItem.id}
                                isHtml={false}
                            />
                        );
                    }
                
          } else if (activeItem.document_slide?.type === "PRESENTATION") {
            const url = await getPublicUrl(
              activeItem.document_slide.published_data || ""
            );
            if (!url) throw new Error("Failed to retrieve presentation URL");
            setContent(
              <PresentationViewer
                slideTitle={activeItem.title}
              />
            );
          }
          break;
        case "ASSIGNMENT": {
          if (activeItem.assignment_slide) {
            setContent(
              <AssignmentSlide
                assignmentData={activeItem.assignment_slide}
                onUpload={handleAssignmentUpload}
                isUploading={isUploading}
              />
            );
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error("Error loading content:", err);
      if (generationId === loadGenerationRef.current) {
        setError(err instanceof Error ? err.message : "Failed to load content");
        setContent(
          <div className="flex h-[300px] flex-col items-center justify-center">
            <p className="text-red-500">
              {error || "An error occurred while loading content"}
            </p>
          </div>
        );
      }
    }
  };

  useEffect(() => {
    loadGenerationRef.current += 1;
    const currentGeneration = loadGenerationRef.current;

    if (open) {
      toggleSidebar();
    }

    if (activeItem) {
      setHeading(activeItem.title || "");
      loadContent(currentGeneration);
    } else {
      setHeading("No content");
      if (currentGeneration === loadGenerationRef.current) {
        setContent(
          <div className="flex h-[500px] flex-col items-center justify-center rounded-lg py-10">
            <EmptySlideMaterial />
            <p className="mt-4 text-neutral-500">
              No study material has been added yet
            </p>
          </div>
        );
      }
    }
  }, [activeItem]);

  return (
    // FIX 1: Add `h-full` to the root element to make it fill its container's height.
    <div className="flex h-full w-full flex-col" ref={selectionRef}>
      <div className="flex flex-shrink-0 items-center justify-between gap-6 border-b border-neutral-300 p-4">
        <h3 className="text-subtitle font-semibold text-neutral-600">
          {heading || "No content"}
        </h3>
        <SidebarTrigger className="mr-6">
              <MyButton scale="medium" className=" flex items-center gap-2" buttonType="secondary" ><p className="leading-[1rem]">Doubts</p> <ChatText /></MyButton>
          </SidebarTrigger>
      </div>

      {/* FIX 2: This container now grows to fill the remaining space. */}
      {/* It's simpler and works for all content types that need to fill the screen. */}
      <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 min-h-0">
        {content}
      </div>

      {isUploading && <DashboardLoader />}
      <DoubtResolutionSidebar />
    </div>
  );
};