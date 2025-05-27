import { useEffect, useRef, useState } from "react";
import PDFViewer from "./pdf-viewer";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { EmptySlideMaterial } from "@/assets/svgs";
import { YouTubePlayerComp } from "./youtube-player";
import { convertHtmlToPdf } from "@/utils/html-to-pdf";
import { useFileUpload } from "@/hooks/use-file-upload";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { extractVideoId } from "@/utils/study-library/tracking/extractVideoId";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { ChatText } from "@phosphor-icons/react";
import { DoubtResolutionSidebar } from "./doubt-resolution-sidebar/components/sidebar";
import CustomVideoPlayer from "./custom-video-player";
import QuestionSlide from "./question-slide";
import AssignmentSlide from "./assignment-slide";
import VideoQuestionOverlay from "./video-question-overlay";
// import { useMediaRefsStore } from "@/stores/mediaRefsStore";


export const SlideMaterial = () => {
    const { activeItem } = useContentStore();
    const selectionRef = useRef(null);
    const loadGenerationRef = useRef(0);
    const [heading, setHeading] = useState(activeItem?.title || "");
    const [content, setContent] = useState<JSX.Element | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { uploadFile, getPublicUrl } = useFileUpload();
    const {toggleSidebar, open} = useSidebar();
    // const { currentPdfPage } = useMediaRefsStore();

    const [currentVideoQuestion, setCurrentVideoQuestion] = useState<any>(null);
  const [showVideoQuestion, setShowVideoQuestion] = useState(false);
  const playerRef = useRef<any>(null);

//   useEffect(() => {
//     console.log("currentPdfPage: ", currentPdfPage);
//   }, [currentPdfPage]);

    const handleConvertAndUpload = async (htmlString: string | null): Promise<string | null> => {
        if (htmlString == null) return null;
        try {
            setIsUploading(true);
            setError(null);


            // Step 1: Convert HTML to PDF
            const pdfBlob = await convertHtmlToPdf(htmlString);


            // Step 2: Convert Blob to File
            const pdfFile = new File([pdfBlob], 'document.pdf', { type: 'application/pdf' });


            // Step 3: Upload the PDF file
            const uploadedFileId = await uploadFile({
                file: pdfFile,
                setIsUploading,
                userId: 'your-user-id',
                source: 'PDF',
                sourceId: "", // Optional
                publicUrl: true, // Set to true to get a public URL
            });


            if (uploadedFileId) {
                const publicUrl = await getPublicUrl(uploadedFileId);
                return publicUrl; // Return the public URL as a string
            }
        } catch (error) {
            console.error('Upload Failed:', error);
            setError('Failed to convert or upload document. Please try again.');
        } finally {
            setIsUploading(false);
        }
        return null; // Return null if the upload fails
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


  const loadContent = async (generationId: number) => {
    if (generationId !== loadGenerationRef.current) return;
    setError(null);

    if (!activeItem) {
        if (generationId !== loadGenerationRef.current) return;
        setContent(
            <div className="flex h-[500px] flex-col items-center justify-center rounded-lg py-10">
                <EmptySlideMaterial />
                <p className="mt-4 text-neutral-500">No study material has been added yet</p>
            </div>,
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
                    case "FILE_ID":
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
                    default:
                        setContent(
                            <div key={`video-${activeItem.id}`} className="h-full w-full">
                                <YouTubePlayerComp
                                    videoId={extractVideoId(
                                        activeItem.video_slide?.published_url ||
                                        activeItem.video_slide?.url ||
                                        ""
                                    )}
                                    ms={activeItem.progress_marker}
                                />
                            </div>
                        );
                        break;
                }
                break;
            }

            case "DOCUMENT": {
                switch (activeItem.document_slide?.type) {
                    case "PDF": {
                        const url = await getPublicUrl(activeItem?.document_slide?.published_data || "");
                        if (generationId !== loadGenerationRef.current) return;
                        if (!url) throw new Error("Failed to retrieve PDF URL");
                        setContent(<PDFViewer pdfUrl={url} />);
                        break;
                    }
                    case "DOC": {
                        const url = await handleConvertAndUpload(activeItem.document_slide?.published_data);
                        if (generationId !== loadGenerationRef.current) return;
                        if (url == null) throw new Error("Error generating PDF URL");
                        setContent(<PDFViewer pdfUrl={url} />);
                        break;
                    }
                    default:
                        // Handle unknown document type if needed
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
                // Handle unknown source_type if needed
                break;
        }
    } catch (err) {
        console.error("Error loading content:", err);
        if (generationId === loadGenerationRef.current) {
            setError(err instanceof Error ? err.message : "Failed to load content");
            setContent(
                <div className="flex h-[300px] flex-col items-center justify-center">
                    <p className="text-red-500">{error || "An error occurred while loading content"}</p>
                </div>
            );
        }
    }
};


    useEffect(() => {
        loadGenerationRef.current += 1;
        const currentGeneration = loadGenerationRef.current;

        if(open){
            toggleSidebar();
        }
       
        if (activeItem) {
            setHeading(activeItem.title || "");
            loadContent( currentGeneration);
        } else {
            setHeading("No content");
            if (currentGeneration === loadGenerationRef.current) {
                setContent(
                    <div className="flex h-[500px] flex-col items-center justify-center rounded-lg py-10">
                        <EmptySlideMaterial />
                        <p className="mt-4 text-neutral-500">No study material has been added yet</p>
                    </div>,
                );
            }
        }
    }, [activeItem]);

    return (
        <div className="flex w-full flex-col" ref={selectionRef}>
            <div className="-mx-8 -my-3 flex items-center justify-between gap-6 border-b border-neutral-300 px-8 py-2">
                <h3 className="text-subtitle font-semibold text-neutral-600">
                    {heading || "No content"}
                </h3>
                <SidebarTrigger  className="[&_svg]:size-6">
                    <ChatText className="text-neutral-500"/>
                </SidebarTrigger>
            </div>
            <div
                className={`mx-auto mt-8 ${
                    activeItem?.source_type=="DOCUMENT" && activeItem?.document_slide?.type == "PDF" ? "h-[calc(100vh-200px)] w-[500px]" : "h-full"
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
            <DoubtResolutionSidebar />
        </div>
    );
};

