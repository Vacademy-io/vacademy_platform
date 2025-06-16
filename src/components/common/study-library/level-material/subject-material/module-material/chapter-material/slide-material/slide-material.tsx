import { useEffect, useRef, useState } from "react";
import PDFViewer from "./pdf-viewer";
import { DocViewer } from "./doc-viewer";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { EmptySlideMaterial } from "@/assets/svgs";
import YouTubePlayerWrapper from "./youtube-player";
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
import { MyButton } from "@/components/design-system/button";
import PresentationViewer from "./presentation-viewer";
import { YouTubePlayer } from "./youtube-player-new";
import { useMediaRefsStore } from "@/stores/mediaRefsStore";
import { useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useSlides, Slide } from "@/hooks/study-library/use-slides";

interface VideoQuestion {
    timestamp: number;
    question: string;
    options: string[];
    correctAnswer: string;
}

interface VideoQuestionProps {
    question: VideoQuestion;
    onSubmit: (answer: string) => void;
}

interface SlideData {
    id: string;
    type: string;
    content: string;
    video_questions?: VideoQuestion[];
}

interface YouTubePlayerProps {
    videoId: string;
    onTimeUpdate?: (currentTime: number) => void;
    ref?: React.RefObject<HTMLVideoElement>;
    ms?: number;
}

interface AssignmentSlideProps {
    assignmentData: any;
    onUpload: (file: File) => Promise<{ success: boolean; fileId?: string; error?: string }>;
    isUploading: boolean;
}

export const SlideMaterial = () => {
    const router = useRouter();
    const { chapterId, slideId } = router.state.location.search;
    const { slides } = useSlides(chapterId || "");
    const { activeItem } = useContentStore();
    const [content, setContent] = useState<React.ReactNode>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const loadGenerationRef = useRef<number>(0);
    const mediaRefsStore = useMediaRefsStore();
    const videoRef = useRef<HTMLVideoElement>(null);
    const { uploadFile, getPublicUrl } = useFileUpload();
    const [currentVideoQuestion, setCurrentVideoQuestion] = useState<any>(null);
    const [showVideoQuestion, setShowVideoQuestion] = useState(false);

    const handleNextSlide = () => {
        // Implement next slide logic
        console.log("Next slide");
    };

    const handlePreviousSlide = () => {
        // Implement previous slide logic
        console.log("Previous slide");
    };

    const handleConvertAndUpload = async (
        htmlString: string | null
    ): Promise<string | null> => {
        if (htmlString == null) return null;
        try {
            setIsUploading(true);
            setError(null);

            // Step 1: Convert HTML to PDF
            const pdfBlob = await convertHtmlToPdf(htmlString);

            // Step 2: Convert Blob to File
            const pdfFile = new File([pdfBlob], "document.pdf", {
                type: "application/pdf",
            });

            // Step 3: Upload the PDF file
            const uploadedFileId = await uploadFile({
                file: pdfFile,
                setIsUploading,
                userId: "your-user-id",
                source: "PDF",
                sourceId: "", // Optional
                publicUrl: true, // Set to true to get a public URL
            });

            if (uploadedFileId) {
                const publicUrl = await getPublicUrl(uploadedFileId);
                return publicUrl; // Return the public URL as a string
            }
        } catch (error) {
            console.error("Upload Failed:", error);
            setError("Failed to convert or upload document. Please try again.");
        } finally {
            setIsUploading(false);
        }
        return null; // Return null if the upload fails
    };

    const handleTimeUpdate = (currentTime: number) => {
        if (activeItem?.video_slide?.questions) {
            const question = activeItem.video_slide.questions.find((q: any) =>
                Math.abs((q.question_time_in_millis / 1000) - currentTime) < 1
            );
            if (question) {
                setCurrentVideoQuestion(question);
                setShowVideoQuestion(true);
            }
        }
    };

    const handleQuestionSubmit = async (
        selectedOption: string | string[]
    ) => {
        // If selectedOption is an array, pick the first option or handle as needed
        const optionToSubmit = Array.isArray(selectedOption)
            ? selectedOption[0]
            : selectedOption;

        if (showVideoQuestion && videoRef.current) {
            setShowVideoQuestion(false);
            setCurrentVideoQuestion(null);
            videoRef.current.play();
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
                return { success: true, fileId };
            }
            return { success: false, error: "Upload failed" };
        } catch (error) {
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
                                        onTimeUpdate={handleTimeUpdate}
                                        ref={videoRef}
                                    />
                                </div>
                            );
                            break;
                        }
                        default:
                            setContent(
                                <div key={`video-${activeItem.id}`} className="h-full w-full">
                                    <YouTubePlayer
                                        videoId={extractVideoId(
                                            activeItem.video_slide?.published_url ||
                                            activeItem.video_slide?.url ||
                                            ""
                                        )}
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
                        setContent(<PDFViewer pdfUrl={url} />);
                    } else if (activeItem.document_slide?.type === "DOC") {
                        console.log("Document slide data:", activeItem.document_slide);
                        // Check if the content is HTML
                        if (activeItem.document_slide.published_data?.includes("<html")) {
                            setContent(
                                <div 
                                    className="h-full w-full overflow-auto bg-white p-8"
                                    dangerouslySetInnerHTML={{ 
                                        __html: activeItem.document_slide.published_data 
                                    }} 
                                />
                            );
                        } else {
                            const url = await getPublicUrl(
                                activeItem.document_slide.published_data || ""
                            );
                            console.log("Generated DOC URL:", url);
                            if (!url) throw new Error("Failed to retrieve DOC URL");
                            setContent(<DocViewer docUrl={url} documentId={activeItem.id} />);
                        }
                    } else if (activeItem.document_slide?.type === "PRESENTATION") {
                        const url = await getPublicUrl(
                            activeItem.document_slide.published_data || ""
                        );
                        if (!url) throw new Error("Failed to retrieve presentation URL");
                        setContent(
                            <PresentationViewer
                                presentationUrl={url}
                                documentId={activeItem.id}
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
                    // Handle unknown source_type if needed
                    break;
            }
        } catch (err) {
            console.error("Error loading content:", err);
            if (generationId === loadGenerationRef.current) {
                setError(err instanceof Error ? err.message : "Failed to load content");
                setContent(
                    <div className="bg-blue-700 flex h-[300px] flex-col items-center justify-center">
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

        if (activeItem) {
            loadContent(currentGeneration);
        } else {
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
        <div className="flex-1 overflow-auto">
            {isUploading ? (
                <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                        <EmptySlideMaterial />
                        <p className="mt-4 text-gray-500">Loading content...</p>
                    </div>
                </div>
            ) : error ? (
                <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                        <EmptySlideMaterial />
                        <p className="mt-4 text-red-500">{error}</p>
                    </div>
                </div>
            ) : (
                content
            )}
            {activeItem?.source_type === "video" && (
                <div key={`video-${activeItem.id}`} className="h-full w-full">
                    <YouTubePlayer
                        videoId={extractVideoId(
                            activeItem.video_slide?.published_url ||
                            activeItem.video_slide?.url ||
                            ""
                        )}
                        onNext={handleNextSlide}
                        onPrevious={handlePreviousSlide}
                    />
                </div>
            )}
            {showVideoQuestion && currentVideoQuestion && (
                <VideoQuestionOverlay
                    question={currentVideoQuestion}
                    onSubmit={async (answer) => {
                        console.log("Answer:", answer);
                        setShowVideoQuestion(false);
                        return Promise.resolve();
                    }}
                    onClose={() => setShowVideoQuestion(false)}
                />
            )}
            <DoubtResolutionSidebar />
        </div>
    );
};