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
import { useMediaRefsStore } from "@/stores/mediaRefsStore";
import { useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useSlides, Slide } from "@/hooks/study-library/use-slides";
import { VideoPlayer } from "./video-player";
import { v4 as uuidv4 } from "uuid";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { SUBMIT_SLIDE_ANSWERS } from "@/constants/urls";
import { getUserId } from "@/constants/getUserId";

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

    const loadContent = async () => {
        try {
            if (!activeItem) {
                console.log('No active item found');
                return;
            }

            console.log('Active item source type:', activeItem.source_type);
            console.log('Active item data:', JSON.stringify(activeItem, null, 2));

            // Handle MCQ content with different possible source types
            if ((activeItem.source_type === "MCQ" || 
                 activeItem.source_type === "MCQS" || 
                 activeItem.source_type === "mcq" || 
                 activeItem.source_type === "mcqs") && 
                activeItem.question_slide) {
                console.log('Loading MCQ content');
                console.log('Question slide data:', JSON.stringify(activeItem.question_slide, null, 2));
                
                // Ensure all required fields are present with default values
                const questionData = {
                    parent_rich_text: activeItem.question_slide.parent_rich_text || { content: '' },
                    text_data: activeItem.question_slide.text_data || { content: '' },
                    explanation_text_data: activeItem.question_slide.explanation_text_data || { content: '' },
                    options: activeItem.question_slide.options || [],
                    re_attempt_count: activeItem.question_slide.re_attempt_count || 1,
                    auto_evaluation_json: activeItem.question_slide.auto_evaluation_json || '',
                    question_type: activeItem.question_slide.question_type || 'MCQS'
                };
                
                console.log('Processed question data:', JSON.stringify(questionData, null, 2));
                
                setContent(
                    <QuestionSlide
                        questionData={questionData}
                        onSubmit={async (questionId, selectedOption) => {
                            try {
                                const userId = await getUserId();
                                if (!questionId || !userId) {
                                    throw new Error("Missing questionId or userId");
                                }

                                const payload = {
                                    id: uuidv4(),
                                    source_id: questionId,
                                    source_type: "QUESTION",
                                    user_id: userId,
                                    slide_id: questionId,
                                    start_time_in_millis: Date.now() - 60000,
                                    end_time_in_millis: Date.now(),
                                    percentage_watched: 100,
                                    videos: [],
                                    documents: [],
                                    question_slides: [
                                        {
                                            id: questionId,
                                            attempt_number: questionData.re_attempt_count || 1,
                                            response_json: JSON.stringify({
                                                selectedOption: selectedOption,
                                            }),
                                            response_status: "SUBMITTED",
                                            marks: 0,
                                        },
                                    ],
                                    assignment_slides: [],
                                    video_slides_questions: [],
                                    new_activity: true,
                                    concentration_score: {
                                        id: uuidv4(),
                                        concentration_score: 100,
                                        tab_switch_count: 0,
                                        pause_count: 0,
                                        answer_times_in_seconds: [],
                                    },
                                };

                                await authenticatedAxiosInstance.post(SUBMIT_SLIDE_ANSWERS, payload, {
                                    params: {
                                        slideId: questionId,
                                        userId,
                                    },
                                });

                                return {
                                    success: true,
                                    isCorrect: true,
                                    correctOption: typeof selectedOption === 'string' ? selectedOption : selectedOption[0],
                                    explanation: "Answer submitted successfully",
                                };
                            } catch (error) {
                                console.error("Error submitting answer:", error);
                                return {
                                    success: false,
                                    error: error instanceof Error ? error.message : "Failed to submit answer",
                                };
                            }
                        }}
                    />
                );
                return;
            } else {
                console.log('Not an MCQ or missing question_slide data');
                if (activeItem.question_slide) {
                    console.log('Has question_slide but source_type is:', activeItem.source_type);
                } else {
                    console.log('No question_slide data found');
                }
            }

            // Check if it's a document slide
            if (activeItem.document_slide) {
                console.log('Document slide type:', activeItem.document_slide.type);
                console.log('Document slide content:', activeItem.document_slide.published_data);
                console.log('Content type:', typeof activeItem.document_slide.published_data);
                console.log('Content length:', activeItem.document_slide.published_data?.length);
                console.log('Document slide title:', activeItem.document_slide.title);
                console.log('Document slide cover file ID:', activeItem.document_slide.cover_file_id);
                console.log('Document slide total pages:', activeItem.document_slide.total_pages);
                console.log('Document slide published total pages:', activeItem.document_slide.published_document_total_pages);

                if (activeItem.document_slide.type === "DOC") {
                    // Check if content is HTML
                    const isHtml = activeItem.document_slide.published_data && 
                                  activeItem.document_slide.published_data.includes("<html");
                    console.log('Is HTML content:', isHtml);
                    console.log('HTML content preview:', activeItem.document_slide.published_data?.substring(0, 100));

                    if (isHtml) {
                        console.log('Rendering HTML content directly');
                        setContent(
                            <DocViewer
                                docUrl={activeItem.document_slide.published_data}
                                documentId={activeItem.id}
                                isHtml={true}
                            />
                        );
                    } else {
                        // For non-HTML content, get public URL
                        console.log('Getting public URL for DOC content');
                        const url = await getPublicUrl(activeItem.document_slide.published_data);
                        console.log('Generated URL:', url);
                        setContent(
                            <DocViewer
                                docUrl={url}
                                documentId={activeItem.id}
                                isHtml={false}
                            />
                        );
                    }
                } else if (activeItem.document_slide.type === "PDF") {
                    const url = await getPublicUrl(activeItem.document_slide.published_data);
                    setContent(
                        <PDFViewer
                            pdfUrl={url}
                            documentId={activeItem.id}
                        />
                    );
                }
            } else if (activeItem.video_slide) {
                // Handle video content
                const videoUrl = activeItem.video_slide.published_url || activeItem.video_slide.url;
                console.log('Loading video:', videoUrl);
                
                if (!videoUrl) {
                    console.error('No video URL found in video_slide:', activeItem.video_slide);
                    setContent(
                        <div className="flex h-[500px] items-center justify-center">
                            <p className="text-red-500">Video URL not found</p>
                        </div>
                    );
                    return;
                }

                // Check if it's a YouTube URL
                const isYouTubeUrl = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
                console.log('Is YouTube URL:', isYouTubeUrl);

                if (isYouTubeUrl) {
                    const videoId = extractVideoId(videoUrl);
                    console.log('YouTube video ID:', videoId);
                    
                    if (!videoId) {
                        console.error('Could not extract YouTube video ID from URL:', videoUrl);
                        setContent(
                            <div className="flex h-[500px] items-center justify-center">
                                <p className="text-red-500">Invalid YouTube URL</p>
                            </div>
                        );
                        return;
                    }

                    setContent(
                        <YouTubePlayerWrapper
                            videoId={videoId}
                            onTimeUpdate={handleTimeUpdate}
                        />
                    );
                } else {
                    // Check if it's a file ID (UUID format)
                    const isFileId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoUrl);
                    console.log('Is File ID:', isFileId);
                    
                    // Handle regular video URL or file ID
                    setContent(
                        <CustomVideoPlayer
                            videoUrl={videoUrl}
                            sourceType={isFileId ? "FILE_ID" : "URL"}
                            questions={activeItem.video_slide.questions}
                            onTimeUpdate={handleTimeUpdate}
                        />
                    );
                }
            } else {
                console.log('Unknown content type:', activeItem);
                setContent(
                    <div className="flex h-[500px] items-center justify-center">
                        <p className="text-red-500">Unsupported content type</p>
                    </div>
                );
            }
        } catch (error) {
            console.error('Error loading content:', error);
            setContent(
                <div className="flex h-[500px] items-center justify-center">
                    <p className="text-red-500">Failed to load content: {error instanceof Error ? error.message : 'Unknown error'}</p>
                </div>
            );
        }
    };

    useEffect(() => {
        loadGenerationRef.current += 1;
        const currentGeneration = loadGenerationRef.current;

        if (activeItem) {
            loadContent();
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
                    <YouTubePlayerWrapper
                        videoId={extractVideoId(
                            activeItem.video_slide?.published_url ||
                            activeItem.video_slide?.url ||
                            ""
                        )}
                        onTimeUpdate={handleTimeUpdate}
                        questions={activeItem.video_slide?.questions}
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