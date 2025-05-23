"use client";

import { useEffect, useRef, useState } from "react";
import PDFViewer from "./pdf-viewer";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { EmptySlideMaterial } from "@/assets/svgs";
import { YouTubePlayerComp } from "./youtube-player";
import { convertHtmlToPdf } from "@/utils/html-to-pdf";
import { useFileUpload } from "@/hooks/use-file-upload";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { extractVideoId } from "@/utils/study-library/tracking/extractVideoId";
import QuestionSlide from "./question-slide";
import AssignmentSlide from "./assignment-slide";
import VideoQuestionOverlay from "./video-question-overlay";
import CustomVideoPlayer from "./custom-video-player";

export const SlideMaterial = () => {
  const { activeItem } = useContentStore();
  const selectionRef = useRef(null);
  const [heading, setHeading] = useState(activeItem?.title || "");
  const [content, setContent] = useState<JSX.Element | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { uploadFile, getPublicUrl } = useFileUpload();

  const [currentVideoQuestion, setCurrentVideoQuestion] = useState<any>(null);
  const [showVideoQuestion, setShowVideoQuestion] = useState(false);
  const playerRef = useRef<any>(null);

  const handleConvertAndUpload = async (
    htmlString: string | null
  ): Promise<string | null> => {
    if (!htmlString) return null;
    try {
      setIsUploading(true);
      setError(null);
      const pdfBlob = await convertHtmlToPdf(htmlString);
      const pdfFile = new File([pdfBlob], "document.pdf", {
        type: "application/pdf",
      });
      const uploadedFileId = await uploadFile({
        file: pdfFile,
        setIsUploading,
        userId: "your-user-id",
        source: "PDF",
        sourceId: "",
        publicUrl: true,
      });
      if (uploadedFileId) {
        const publicUrl = await getPublicUrl(uploadedFileId);
        return publicUrl;
      }
    } catch (error) {
      console.error("Upload Failed:", error);
      setError("Failed to convert or upload document. Please try again.");
    } finally {
      setIsUploading(false);
    }
    return null;
  };

  const handleVideoTimeUpdate = (currentTime: number) => {
    if (!activeItem?.video_slide?.questions?.length) return;
    const questionToShow = activeItem.video_slide.questions.find((q) => {
      const questionTime = q.question_time_in_millis
        ? q.question_time_in_millis / 1000
        : 0;
      return Math.abs(currentTime - questionTime) < 0.5;
    });
    if (questionToShow && !showVideoQuestion) {
      setCurrentVideoQuestion(questionToShow);
      setShowVideoQuestion(true);
      if (playerRef.current) playerRef.current.pauseVideo();
    }
  };

  const handleQuestionSubmit = async (
    questionId: string,
    selectedOption: string | string[]
  ) => {
    // If selectedOption is an array, pick the first option or handle as needed
    const optionToSubmit = Array.isArray(selectedOption)
      ? selectedOption[0]
      : selectedOption;

    console.log(`Answer for ${questionId}: ${optionToSubmit}`);

    if (showVideoQuestion && playerRef.current) {
      setShowVideoQuestion(false);
      setCurrentVideoQuestion(null);
      playerRef.current.playVideo();
    }

    return {
      success: true,
      isCorrect: true, // you can plug in actual evaluation logic here later
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

  const loadContent = async () => {
    setError(null);
    if (!activeItem) {
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
    setContent(<DashboardLoader />);

    try {
      switch (activeItem.source_type) {
        // case "VIDEO":
        //   setContent(
        //     <div key={`video-${activeItem.id}`} className="h-full w-full">
        //       <YouTubePlayerComp
        //         videoId={extractVideoId(activeItem.video_slide?.published_url || "") || ""}
        //         onTimeUpdate={handleVideoTimeUpdate}
        //         ref={playerRef}
        //       />
        //     </div>
        //   );
        //   break;

        // case "VIDEO":
        //   const videoSourceType = activeItem.video_slide?.source_type;
        //   const videoStatus = activeItem.status;

        //   const fileId =
        //     videoStatus === "PUBLISHED"
        //       ? activeItem.video_slide?.published_url
        //       : activeItem.video_slide?.url;

        //   if (videoSourceType === "FILE_ID") {
        //     if (!fileId) {
        //       throw new Error("Video file ID not available");
        //     }

        //     const videoUrl = await getPublicUrl(fileId);
        //     if (!videoUrl) throw new Error("Failed to retrieve video URL");

        //     setContent(
        //       <div
        //         key={`video-${activeItem.id}`}
        //         className="h-full w-full overflow-hidden rounded-lg"
        //       >
        //         <video
        //           controls
        //           controlsList="nodownload"
        //           className="w-full"
        //           onTimeUpdate={(e) =>
        //             handleVideoTimeUpdate(e.currentTarget.currentTime)
        //           }
        //           playsInline
        //           preload="metadata"
        //         >
        //           <source src={videoUrl} type="video/webm" />
        //           <source src={videoUrl} type="video/mp4" />
        //           <source src={videoUrl} type="video/ogg" />
        //           Your browser does not support the video tag or the video
        //           format.
        //         </video>
        //       </div>
        //     );
        //   } else {
        //     setContent(
        //       <div key={`video-${activeItem.id}`} className="h-full w-full">
        //         <YouTubePlayerComp
        //           videoId={extractVideoId(
        //             activeItem.video_slide?.published_url ||
        //               activeItem.video_slide?.url ||
        //               ""
        //           )}
        //           onTimeUpdate={handleVideoTimeUpdate}
        //           ref={playerRef}
        //         />
        //       </div>
        //     );
        //   }
        //   break;

        case "VIDEO": {
          const videoSourceType = activeItem.video_slide?.source_type;
          const videoStatus = activeItem.status;

          const fileId =
            videoStatus === "PUBLISHED"
              ? activeItem.video_slide?.published_url
              : activeItem.video_slide?.url;

          if (videoSourceType === "FILE_ID") {
            if (!fileId) {
              throw new Error("Video file ID not available");
            }

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
          } else {
            setContent(
              <div key={`video-${activeItem.id}`} className="h-full w-full">
                <YouTubePlayerComp
                  videoId={extractVideoId(
                    activeItem.video_slide?.published_url ||
                      activeItem.video_slide?.url ||
                      ""
                  )}
                  // onTimeUpdate={handleVideoTimeUpdate}
                />
              </div>
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
            setContent(<PDFViewer pdfUrl={url} />);
          } else if (activeItem.document_slide?.type === "DOC") {
            const url = await handleConvertAndUpload(
              activeItem.document_slide.published_data
            );
            if (!url) throw new Error("Error generating PDF URL");
            setContent(<PDFViewer pdfUrl={url} />);
          }
          break;

        case "QUESTION":
          if (activeItem.question_slide) {
            setContent(
              <QuestionSlide
                questionData={activeItem.question_slide}
                onSubmit={handleQuestionSubmit}
              />
            );
          }

          break;

        case "ASSIGNMENT":
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

        default:
          setContent(
            <div className="flex h-[500px] flex-col items-center justify-center rounded-lg py-10">
              <EmptySlideMaterial />
              <p className="mt-4 text-neutral-500">Unsupported content type</p>
            </div>
          );
      }
    } catch (err) {
      console.error("Error loading content:", err);
      setError(err instanceof Error ? err.message : "Failed to load content");
      setContent(
        <div className="flex h-[300px] flex-col items-center justify-center">
          <p className="text-red-500">
            {error || "An error occurred while loading content"}
          </p>
        </div>
      );
    }
  };

  useEffect(() => {
    if (activeItem) {
      setHeading(activeItem.title || "");
      loadContent();
    }
  }, [activeItem]);

  return (
    <div className="flex w-full flex-col" ref={selectionRef}>
      <div className="-mx-8 -my-3 flex items-center justify-between gap-6 border-b border-neutral-300 px-8 py-2">
        <h3 className="text-subtitle font-semibold text-neutral-600">
          {heading || "No content"}
        </h3>
      </div>
      <div
        className={`mx-auto mt-8 ${
          activeItem?.source_type === "DOCUMENT" &&
          activeItem?.document_slide?.type === "PDF"
            ? "h-[calc(100vh-200px)] w-[500px]"
            : "h-full"
        } w-full overflow-hidden`}
      >
        {content}
        {isUploading && <DashboardLoader />}
        {showVideoQuestion && currentVideoQuestion && (
          <VideoQuestionOverlay
            question={currentVideoQuestion}
            onSubmit={(optionId) =>
              handleQuestionSubmit(currentVideoQuestion.id, optionId)
            }
            onClose={() => {
              setShowVideoQuestion(false);
              setCurrentVideoQuestion(null);
              if (playerRef.current) playerRef.current.playVideo();
            }}
          />
        )}
      </div>
    </div>
  );
};
