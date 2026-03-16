import { useEffect, useRef, useState } from "react";
import PDFViewer from "./pdf-viewer";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { EmptySlideMaterial } from "@/assets/svgs";
import YouTubePlayerWrapper from "./youtube-player";
import { useFileUpload } from "@/hooks/use-file-upload";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { extractVideoId } from "@/utils/study-library/tracking/extractVideoId";
// Removed SidebarTrigger and useSidebar - using doubt sidebar store instead
import { ChatText, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { DoubtResolutionSidebar } from "./doubt-resolution-sidebar/components/sidebar";
import CustomVideoPlayer from "./custom-video-player";
import QuestionSlide from "./question-slide";
import AssignmentSlide from "./assignment-slide";
import { isItemLocked } from "@/components/drip-conditions/helpers";

import { MyButton } from "@/components/design-system/button";
import { DocViewer } from "./doc-viewer";
import PresentationViewer from "./presentation-viewer";
import { CodeEditorSlide } from "./code-editor-slide";
import { JupyterNotebookSlide } from "./jupyter-notebook-slide";
import { ScratchProjectSlide } from "./scratch-project-slide";
import { SplitScreenVideoSlide } from "./split-screen-video-slide";
import { useDoubtSidebarStore } from "@/stores/study-library/doubt-sidebar-store";
import QuizViewer from "./quiz-viewer";
import { Slide, AIVideoData } from "@/hooks/study-library/use-slides";
import { AIVideoPlayer } from "@/components/ai-video-player";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import { ConcentrationSettings } from "@/types/student-display-settings";
import { fetchHtmlVideoUrls } from "@/utils/htmlVideoService";
import AudioPlayer from "./audio-player";
import ScormSlideComponent from "./scorm-slide";
import { SplitScreenHtmlVideoSlide } from "./split-screen-html-video-slide";

export const SlideMaterial = () => {
  const { activeItem, items, setActiveItem, slideEvaluations } =
    useContentStore();
  const selectionRef = useRef(null);
  const loadGenerationRef = useRef(0);
  const [heading, setHeading] = useState(activeItem?.title || "");
  const [content, setContent] = useState<JSX.Element | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { uploadFile, getPublicUrl } = useFileUpload();

  // Settings state
  const [concentrationSettings, setConcentrationSettings] = useState<ConcentrationSettings | undefined>(undefined);

  // Fetch settings
  useEffect(() => {
    getStudentDisplaySettings()
      .then((settings) => {
        if (settings?.concentration) {
          setConcentrationSettings(settings.concentration);
        }
      })
      .catch((err) => console.error("Failed to load display settings for concentration:", err));
  }, []);

  const playerRef = useRef<HTMLVideoElement | null>(null);

  // Slide navigation helpers
  const slidesList = Array.isArray(items) ? items : [];
  const currentIndex = slidesList.findIndex((s) => s.id === activeItem?.id);

  // Check if prev/next slides are locked
  const prevSlide = currentIndex > 0 ? slidesList[currentIndex - 1] : null;
  const nextSlide =
    currentIndex > -1 && currentIndex < slidesList.length - 1
      ? slidesList[currentIndex + 1]
      : null;

  const isPrevLocked = prevSlide
    ? slideEvaluations[prevSlide.id] &&
    isItemLocked(slideEvaluations[prevSlide.id])
    : false;
  const isNextLocked = nextSlide
    ? slideEvaluations[nextSlide.id] &&
    isItemLocked(slideEvaluations[nextSlide.id])
    : false;

  const canGoPrev = currentIndex > 0 && !isPrevLocked;
  const canGoNext =
    currentIndex > -1 && currentIndex < slidesList.length - 1 && !isNextLocked;

  const goToPrev = () => {
    if (!canGoPrev) return;
    setActiveItem(slidesList[currentIndex - 1]);
  };

  const goToNext = () => {
    if (!canGoNext) return;
    setActiveItem(slidesList[currentIndex + 1]);
  };

  // Video time update handler - simplified since questions are now handled internally by YouTube player
  const handleVideoTimeUpdate = () => {
    // Questions are now handled internally by the YouTube player component
    // This function can be used for other time-based functionality if needed
  };

  const handleQuestionSubmit = async (selectedOption: string | string[]) => {
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
    setIsLoading(true);

    if (!activeItem) {
      if (generationId !== loadGenerationRef.current) return;
      // Add slight delay for smooth transition
      await new Promise((resolve) => setTimeout(resolve, 200));
      setContent(
        <div className="flex h-[500px] flex-col items-center justify-center rounded-lg py-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="relative group">
            <div className="bg-neutral-50 rounded-full p-6 transition-transform duration-300 group-hover:scale-105">
              <EmptySlideMaterial />
            </div>
          </div>
          <p className="mt-6 text-neutral-500 animate-in fade-in duration-700 delay-200 text-center">
            No study material has been added yet
          </p>
        </div>
      );
      setIsLoading(false);
      return;
    }

    if (generationId !== loadGenerationRef.current) return;
    setContent(<DashboardLoader />);

    try {
      // Add artificial delay for smooth loading experience
      await new Promise((resolve) => setTimeout(resolve, 300));

      switch (activeItem.source_type?.toUpperCase()) {
        case "AI_VIDEO": {
          // AI_VIDEO slides from course generation - have aiVideoData already
          const aiVideoData = activeItem.aiVideoData || (activeItem as any).ai_video_data;

          // Transform snake_case to camelCase if needed
          let transformedData: AIVideoData | undefined;
          if (aiVideoData) {
            if (aiVideoData.status && aiVideoData.timeline_url && aiVideoData.audio_url) {
              transformedData = {
                status: aiVideoData.status,
                timelineUrl: aiVideoData.timeline_url,
                audioUrl: aiVideoData.audio_url,
                progress: aiVideoData.progress,
              };
            } else if (aiVideoData.status && aiVideoData.timelineUrl && aiVideoData.audioUrl) {
              transformedData = aiVideoData;
            }
          }

          if (transformedData?.status === "COMPLETED" &&
            transformedData.timelineUrl &&
            transformedData.audioUrl) {
            setContent(
              <div className="h-full w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="h-full w-full bg-white rounded-lg overflow-hidden border border-neutral-200">
                  <AIVideoPlayer
                    timelineUrl={transformedData.timelineUrl}
                    audioUrl={transformedData.audioUrl}
                    className="w-full"
                  />
                </div>
              </div>
            );
          } else if (transformedData?.status === "GENERATING") {
            setContent(
              <div className="h-full w-full flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-gray-600 font-medium">Generating video...</p>
                  {transformedData.progress !== undefined && (
                    <p className="text-gray-500 text-sm mt-2">
                      {transformedData.progress}% complete
                    </p>
                  )}
                  <p className="text-sm mt-2 text-gray-500">Video will be available in a few minutes.</p>
                </div>
              </div>
            );
          } else {
            setContent(
              <div className="h-full w-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <p>Video pending generation</p>
                  <p className="text-sm mt-2 text-gray-500">Video will be available in a few minutes.</p>
                </div>
              </div>
            );
          }
          break;
        }



        case "HTML_VIDEO": {
          // HTML_VIDEO slides from backend
          // Check multiple possible field names (snake_case, camelCase, etc.)
          const htmlVideoSlide =
            activeItem.html_video_slide ||
            (activeItem as any).htmlVideoSlide ||
            (activeItem as any).html_video ||
            (activeItem as any).htmlVideo;

          console.log("[SlideMaterial] HTML_VIDEO slide detected:", {
            source_type: activeItem.source_type,
            slide_id: activeItem.id,
            source_id: activeItem.source_id,
            html_video_slide: htmlVideoSlide,
            // Log all keys to see what's available
            allKeys: Object.keys(activeItem),
            // Log the entire slide object
            fullSlide: activeItem,
          });

          // Check for embedded content (Code, Scratch, Jupyter)
          // It might be in htmlVideoSlide or activeItem directly
          let embeddedType =
            htmlVideoSlide?.embedded_type ||
            (activeItem as any).embedded_type;

          let embeddedData =
            htmlVideoSlide?.embedded_data ||
            (activeItem as any).embedded_data ||
            htmlVideoSlide?.code_data ||
            (activeItem as any).code_data;

          // SPECIAL HANDLING: Check for code_editor_config (used in some HTML_VIDEO slides)
          const codeEditorConfig =
            htmlVideoSlide?.code_editor_config ||
            (activeItem as any).code_editor_config;

          if (codeEditorConfig && !embeddedData) {
            try {
              console.log("[SlideMaterial] Found code_editor_config, transforming to embedded data");
              const config = typeof codeEditorConfig === 'string'
                ? JSON.parse(codeEditorConfig)
                : codeEditorConfig;

              if (config.enabled) {
                embeddedType = "CODE";
                // Transform into CodeEditorData format expected by CodeEditorSlide
                const codeData = {
                  language: config.language || "python",
                  theme: config.theme || "dark",
                  code: config.initial_code || "",
                  viewMode: "edit",
                  readOnly: false
                };
                embeddedData = JSON.stringify(codeData);
              }
            } catch (e) {
              console.error("[SlideMaterial] Failed to parse code_editor_config", e);
            }
          }

          console.log("[SlideMaterial] Embedded content check:", {
            embeddedType,
            hasEmbeddedData: !!embeddedData
          });

          // First, check if URLs are already in the slide data (might be pre-populated)
          let existingHtmlUrl =
            htmlVideoSlide?.html_url ||
            htmlVideoSlide?.htmlUrl ||
            htmlVideoSlide?.timeline_url ||
            htmlVideoSlide?.timelineUrl ||
            (activeItem as any).html_url ||
            (activeItem as any).htmlUrl ||
            (activeItem as any).timeline_url ||
            (activeItem as any).timelineUrl;

          let existingAudioUrl =
            htmlVideoSlide?.audio_url ||
            htmlVideoSlide?.audioUrl ||
            (activeItem as any).audio_url ||
            (activeItem as any).audioUrl;

          // If validation fails (e.g. empty strings), treat as not found
          if (!existingHtmlUrl || existingHtmlUrl === "") existingHtmlUrl = null;
          if (!existingAudioUrl || existingAudioUrl === "") existingAudioUrl = null;

          // Helper to render content (Split or Full)
          const renderHtmlVideoContent = (htmlUrl: string, audioUrl: string) => {
            if (embeddedType && embeddedData) {
              return (
                <div className="h-full w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <SplitScreenHtmlVideoSlide
                    videoId={activeItem.source_id}
                    videoUrls={{ htmlUrl, audioUrl }}
                    documentId={activeItem.id}
                    embeddedContent={{
                      embedded_type: embeddedType,
                      embedded_data: embeddedData
                    }}
                  />
                </div>
              );
            } else {
              return (
                <div
                  key={`html-video-${activeItem.id}`}
                  className="h-full w-full animate-in fade-in slide-in-from-bottom-4 duration-700"
                >
                  <div className="h-full w-full bg-white rounded-lg overflow-hidden border border-neutral-200">
                    <AIVideoPlayer
                      timelineUrl={htmlUrl}
                      audioUrl={audioUrl}
                      className="w-full"
                    />
                  </div>
                </div>
              );
            }
          };

          // If URLs are already available, use them directly
          if (existingHtmlUrl && existingAudioUrl) {
            console.log("[SlideMaterial] Using URLs from slide data:", {
              htmlUrl: existingHtmlUrl,
              audioUrl: existingAudioUrl,
            });
            setContent(renderHtmlVideoContent(existingHtmlUrl, existingAudioUrl));
            break;
          }

          // If URLs not in slide data, try to fetch from API
          // Check for video ID
          const videoId =
            htmlVideoSlide?.ai_gen_video_id ||
            htmlVideoSlide?.aiGenVideoId ||
            (activeItem as any).ai_gen_video_id ||
            (activeItem as any).aiGenVideoId ||
            activeItem.source_id;

          if (!videoId) {
            console.error("[SlideMaterial] HTML_VIDEO slide missing video ID and URLs", {
              slide_id: activeItem.id,
              source_id: activeItem.source_id,
              html_video_slide: htmlVideoSlide,
              allKeys: Object.keys(activeItem),
            });
            setContent(
              <div className="h-full w-full flex items-center justify-center">
                <div className="text-center text-red-500">
                  <p>Video data not found</p>
                  <p className="text-xs mt-2">HTML_VIDEO slide is missing video ID and URLs</p>
                  <p className="text-xs mt-1">Source ID: {activeItem.source_id || "N/A"}</p>
                </div>
              </div>
            );
            break;
          }

          // Fetch video URLs from API (only if not already in slide data)
          try {
            console.log("[SlideMaterial] Fetching video URLs from API for videoId:", videoId);
            const videoUrls = await fetchHtmlVideoUrls(videoId);

            console.log("[SlideMaterial] Fetched HTML video URLs:", {
              videoId: videoId,
              hasHtmlUrl: !!videoUrls.htmlUrl,
              hasAudioUrl: !!videoUrls.audioUrl,
              htmlUrl: videoUrls.htmlUrl,
              audioUrl: videoUrls.audioUrl,
            });

            if (videoUrls.htmlUrl && videoUrls.audioUrl) {
              setContent(renderHtmlVideoContent(videoUrls.htmlUrl, videoUrls.audioUrl));
            } else {
              setContent(
                <div className="h-full w-full flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">Processing video...</p>
                    <p className="text-xs mt-2">Video URLs not available yet</p>
                    <p className="text-sm mt-2 text-gray-500">Video will be available in a few minutes.</p>
                  </div>
                </div>
              );
            }
          } catch (err: any) {
            console.error("[SlideMaterial] Error fetching HTML video URLs:", {
              error: err,
              videoId: videoId,
              status: err.response?.status,
              message: err.message,
              response: err.response?.data,
              // CORS error details
              isCorsError: err.code === 'ERR_NETWORK' || err.message === 'Network Error',
            });

            // Check if it's a CORS error
            const isCorsError = err.code === 'ERR_NETWORK' || err.message === 'Network Error';
            const errorMessage = isCorsError
              ? 'CORS Error: Backend proxy route may not be configured. Please check backend configuration for /ai-service/video/urls/ endpoint.'
              : err.response?.status === 404
                ? `Video ${videoId} not found`
                : 'Failed to load video URLs';

            setContent(
              <div className="h-full w-full flex items-center justify-center">
                <div className="text-center text-red-500 max-w-md">
                  <p className="font-medium">{errorMessage}</p>
                  <p className="text-xs mt-2">
                    {isCorsError
                      ? 'The backend needs to configure a proxy route for /ai-service/video/urls/'
                      : 'Please try again later'}
                  </p>
                  <p className="text-xs mt-1 text-gray-400">Video ID: {videoId}</p>
                </div>
              </div>
            );
          }
          break;
        }

        case "VIDEO": {
          if (generationId !== loadGenerationRef.current) return;
          const videoSlide = activeItem.video_slide;
          const videoStatus = activeItem.status;

          // Check if this is a split-screen video
          if (videoSlide?.embedded_type && videoSlide?.embedded_data) {
            setContent(
              <div
                key={`split-video-${activeItem.id}`}
                className="h-full w-full animate-in fade-in slide-in-from-bottom-4 duration-700"
              >
                <SplitScreenVideoSlide
                  videoSlide={videoSlide}
                  status={videoStatus}
                  onTimeUpdate={handleVideoTimeUpdate}
                  progressMarker={activeItem.progress_marker}
                />
              </div>
            );
            break;
          }

          // Regular video handling
          const videoSourceType = videoSlide?.source_type;
          const fileId =
            videoStatus === "PUBLISHED"
              ? videoSlide?.published_url
              : videoSlide?.url;

          switch (videoSourceType) {
            case "FILE_ID": {
              if (!fileId) throw new Error("Video file ID not available");
              const videoUrl = await getPublicUrl(fileId);
              if (!videoUrl) throw new Error("Failed to retrieve video URL");
              setContent(
                <div
                  key={`video-${activeItem.id}`}
                  className="h-full w-full overflow-hidden rounded-lg animate-in fade-in slide-in-from-bottom-4 duration-700"
                >
                  <div className="h-full w-full bg-black rounded-lg overflow-hidden border border-neutral-200">
                    <CustomVideoPlayer
                      videoUrl={videoUrl}
                      onTimeUpdate={handleVideoTimeUpdate}
                      ref={playerRef}
                      concentrationSettings={concentrationSettings}
                    />
                  </div>
                </div>
              );
              break;
            }
            default:
              setContent(
                <div
                  key={`video-${activeItem.id}`}
                  className="h-full w-full animate-in fade-in slide-in-from-bottom-4 duration-700"
                >
                  <div className="h-full w-full bg-black rounded-lg overflow-hidden border border-neutral-200">
                    <YouTubePlayerWrapper
                      videoId={extractVideoId(
                        videoSlide?.published_url || videoSlide?.url || ""
                      )}
                      onTimeUpdate={handleVideoTimeUpdate}
                      ref={playerRef}
                      ms={activeItem.progress_marker}
                      questions={videoSlide?.questions || []}
                      concentrationSettings={concentrationSettings}
                    />
                  </div>
                </div>
              );
              break;
          }
          break;
        }

        case "QUIZ": {
          // Support for new quiz slide structure
          const slideWithQuiz = activeItem as Slide & { quiz_slide?: unknown };
          const quizSlide = slideWithQuiz.quiz_slide as
            | {
                questions?: unknown[];
                time_limit_in_minutes?: number | null;
                marks_per_question?: number;
                negative_marking?: number;
              }
            | undefined;
          const questions = Array.isArray(quizSlide?.questions)
            ? quizSlide!.questions
            : [];

          // Map questions to QuizViewer format
          const mappedQuestions = questions.map((q: unknown) => {
            const question = q as {
              id: string;
              parent_rich_text?: {
                id?: string;
                type?: string;
                content?: string;
              };
              text?: { id?: string; type?: string; content?: string };
              options?: Array<{ id?: string; text?: { content?: string } }>;
              question_type?: string;
              auto_evaluation_json?: string;
              explanation_text?: {
                id?: string;
                type?: string;
                content?: string;
              };
              marks?: number | null;
              negative_marking?: number | null;
            };
            return {
              id: question.id,
              parent_rich_text: question.parent_rich_text,
              text: question.text,
              question_type: question.question_type,
              options:
                Array.isArray(question.options) && question.options.length > 0
                  ? question.options.map((opt, idx) => ({
                    id: opt.id || String(idx),
                    text: { content: opt.text?.content || "Option" },
                  }))
                  : [
                    // If no options, provide a default for numeric/text input
                    { id: "input", text: { content: "(Enter your answer)" } },
                  ],
              auto_evaluation_json: question.auto_evaluation_json,
              explanation_text: question.explanation_text,
              marks: question.marks ?? null,
              negative_marking: question.negative_marking ?? null,
            };
          });

          setContent(
            <QuizViewer
              questions={mappedQuestions}
              timeLimitMinutes={quizSlide?.time_limit_in_minutes ?? null}
              marksPerQuestion={quizSlide?.marks_per_question ?? 1}
              defaultNegativeMarking={quizSlide?.negative_marking ?? 0}
              onAnswer={async (_questionId, selectedOptionId) => {
                // Send/save answer data here if needed
                await handleQuestionSubmit(String(selectedOptionId));
              }}
              onComplete={() => {
                // Optionally handle quiz completion
              }}
            />
          );
          break;
        }

        case "QUESTION": {
          // Fallback: if quiz_slide is present, use it
          const slideWithQuiz = activeItem as Slide & { quiz_slide?: unknown };
          const quizSlide = slideWithQuiz.quiz_slide as
            | { questions?: unknown[] }
            | undefined;
          if (quizSlide && Array.isArray(quizSlide.questions)) {
            const questions = quizSlide.questions;
            const mappedQuestions = questions.map((q: unknown) => {
              const question = q as {
                id: string;
                parent_rich_text?: {
                  id?: string;
                  type?: string;
                  content?: string;
                };
                text?: { id?: string; type?: string; content?: string };
                options?: Array<{ id?: string; text?: { content?: string } }>;
                question_type?: string;
              };
              return {
                id: question.id,
                parent_rich_text: question.parent_rich_text,
                text: question.text,
                question_type: question.question_type,
                options:
                  Array.isArray(question.options) && question.options.length > 0
                    ? question.options.map((opt, idx) => ({
                      id: opt.id || String(idx),
                      text: { content: opt.text?.content || "Option" },
                    }))
                    : [
                      {
                        id: "input",
                        text: { content: "(Enter your answer)" },
                      },
                    ],
              };
            });
            setContent(
              <QuizViewer
                questions={mappedQuestions}
                onAnswer={async (_questionId, selectedOptionId) => {
                  await handleQuestionSubmit(String(selectedOptionId));
                }}
                onComplete={() => {
                  // Optionally handle quiz completion
                }}
              />
            );
            break;
          }
          // Legacy: single question slide
          if (activeItem.question_slide) {
            setContent(
              <div className="h-full w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="h-full w-full bg-white rounded-lg overflow-hidden border border-neutral-200">
                  <QuestionSlide
                    questionData={activeItem.question_slide}
                    onSubmit={handleQuestionSubmit}
                  />
                </div>
              </div>
            );
          } else {
            setContent(
              <div className="flex h-[500px] flex-col items-center justify-center rounded-lg py-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-red-50 rounded-full p-6 transition-transform duration-300">
                  <svg
                    className="w-8 h-8 text-red-500"
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
                <p className="text-red-500 mt-4 animate-in fade-in duration-700 delay-200 text-center">
                  Quiz data not available
                </p>
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
            setContent(
              <div className="h-full w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="h-full w-full bg-white rounded-lg overflow-hidden border border-neutral-200">
                  <PDFViewer pdfUrl={url} />
                </div>
              </div>
            );
          } else if (activeItem.document_slide?.type === "DOC") {
            const isHtml =
              activeItem.document_slide.published_data &&
              (activeItem.document_slide.published_data.includes("<html") ||
                activeItem.document_slide.published_data.includes("<body") ||
                activeItem.document_slide.published_data
                  .trim()
                  .startsWith("<"));
            if (isHtml) {
              setContent(
                <div className="h-full w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="h-full w-full bg-white rounded-lg overflow-hidden border border-neutral-200">
                    <DocViewer
                      docUrl={activeItem.document_slide.published_data || ""}
                      documentId={activeItem.id}
                      isHtml={true}
                    />
                  </div>
                </div>
              );
            } else {
              const url = await getPublicUrl(
                activeItem.document_slide.published_data || ""
              );
              setContent(
                <div className="h-full w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="h-full w-full bg-white rounded-lg overflow-hidden border border-neutral-200">
                    <DocViewer
                      docUrl={url || ""}
                      documentId={activeItem.id}
                      isHtml={false}
                    />
                  </div>
                </div>
              );
            }
          } else if (activeItem.document_slide?.type === "PRESENTATION") {
            const url = await getPublicUrl(
              activeItem.document_slide.published_data || ""
            );
            if (!url) throw new Error("Failed to retrieve presentation URL");
            setContent(
              <div className="h-full w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="h-full w-full bg-white rounded-lg overflow-hidden border border-neutral-200">
                  <PresentationViewer slide={activeItem} />
                </div>
              </div>
            );
          } else if (activeItem.document_slide?.type === "CODE") {
            const publishedData = activeItem.document_slide.published_data;

            if (publishedData) {
              console.log("[SlideMaterial] Creating CodeEditorSlide component");
              setContent(
                <div className="h-full w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <CodeEditorSlide
                    published_data={publishedData}
                    documentId={activeItem.id}
                  />
                </div>
              );
            } else {
              setContent(
                <div className="flex items-center justify-center h-full">
                  <div className="text-neutral-500">No code data available</div>
                </div>
              );
            }
          } else if (activeItem.document_slide?.type === "JUPYTER") {
            // Jupyter Notebook Slide
            const publishedData = activeItem.document_slide.published_data;
            if (publishedData) {
              setContent(
                <div className="h-full w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <JupyterNotebookSlide
                    published_data={publishedData}
                    documentId={activeItem.id}
                  />
                </div>
              );
            }
          } else if (activeItem.document_slide?.type === "SCRATCH") {
            // Scratch Project Slide
            const publishedData = activeItem.document_slide.published_data;
            if (publishedData) {
              setContent(
                <div className="h-full w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <ScratchProjectSlide
                    published_data={publishedData}
                    documentId={activeItem.id}
                  />
                </div>
              );
            }
          }
          break;

        case "ASSIGNMENT": {
          if (activeItem.assignment_slide) {
            setContent(
              <div className="h-full w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="h-full w-full bg-white rounded-lg overflow-hidden border border-neutral-200">
                  <AssignmentSlide
                    assignmentData={activeItem.assignment_slide}
                    onUpload={handleAssignmentUpload}
                    isUploading={isUploading}
                  />
                </div>
              </div>
            );
          }
          break;
        }

        case "AUDIO": {
          const audioSlide = activeItem.audio_slide || activeItem.audioSlide;

          if (audioSlide) {
            setContent(
              <div
                key={`audio-${activeItem.id}`}
                className="h-full w-full animate-in fade-in slide-in-from-bottom-4 duration-700"
              >
                <AudioPlayer audioSlide={audioSlide} />
              </div>
            );
          } else {
            setContent(
              <div className="flex h-[300px] flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <p className="text-red-500 font-medium">Audio slide data missing</p>
              </div>
            );
          }
          break;
        }

        case "SCORM": {
          setContent(
            <div
              key={`scorm-${activeItem.id}`}
              className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700"
            >
              <ScormSlideComponent
                slide={activeItem}
              />
            </div>
          );
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
          <div className="flex h-[300px] flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-red-50 rounded-full p-4 transition-transform duration-300">
              <svg
                className="w-8 h-8 text-red-500"
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
            <p className="text-red-500 mt-4 animate-in fade-in duration-700 delay-200 text-center">
              {error || "An error occurred while loading content"}
            </p>
          </div>
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const prevSlideIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Only reload content if the slide ID actually changed
    if (activeItem?.id !== prevSlideIdRef.current) {
      loadGenerationRef.current += 1;
      const currentGeneration = loadGenerationRef.current;

      if (activeItem) {
        setHeading(activeItem.title || "");
        loadContent(currentGeneration);
        prevSlideIdRef.current = activeItem.id;
      } else {
        setHeading("No content");
        prevSlideIdRef.current = null;
        if (currentGeneration === loadGenerationRef.current) {
          setContent(
            <div className="flex h-[500px] flex-col items-center justify-center rounded-lg py-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-neutral-50 rounded-full p-6 transition-transform duration-300 group-hover:scale-105">
                <EmptySlideMaterial />
              </div>
              <p className="mt-6 text-neutral-500 animate-in fade-in duration-700 delay-200 text-center">
                No study material has been added yet
              </p>
            </div>
          );
        }
      }
    } else if (activeItem) {
      // Slide ID is the same, just update heading (no content reload)
      setHeading(activeItem.title || "");
    }
  }, [activeItem]);

  return (
    <div className="flex h-full w-full flex-col bg-white" ref={selectionRef}>
      {/* Compact Professional Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-neutral-200 bg-white">
        <div className="flex items-center gap-3 px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-1 h-6 bg-primary-500 rounded-full"></div>
            <div className="flex flex-col min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-neutral-900 leading-tight animate-in fade-in slide-in-from-left-4 duration-500">
                {heading || "No content"}
              </h3>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide animate-in fade-in slide-in-from-left-4 duration-500 delay-75">
                Course Details
              </p>
            </div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 pr-3 sm:pr-4 flex-wrap">
          {/* Slide navigation */}
          <div className="flex items-center gap-2">
            <MyButton
              scale="medium"
              buttonType="secondary"
              onClick={goToPrev}
              disabled={!canGoPrev}
              aria-label="Previous slide"
              className="flex items-center justify-center gap-0 sm:gap-2 px-0 py-0 sm:px-3 sm:py-2 w-8 h-8 sm:w-auto sm:h-auto min-w-0 font-medium transition-all duration-300 bg-white border border-neutral-300 hover:border-primary-400 rounded-lg backdrop-blur-sm hover:bg-primary-50 disabled:opacity-50"
            >
              <CaretLeft size={16} />
              <span className="hidden sm:inline text-sm">Previous</span>
            </MyButton>
            <MyButton
              scale="medium"
              buttonType="secondary"
              onClick={goToNext}
              disabled={!canGoNext}
              aria-label="Next slide"
              className="flex items-center justify-center gap-0 sm:gap-2 px-0 py-0 sm:px-3 sm:py-2 w-8 h-8 sm:w-auto sm:h-auto min-w-0 font-medium transition-all duration-300 bg-white border border-neutral-300 hover:border-primary-400 rounded-lg backdrop-blur-sm hover:bg-primary-50 disabled:opacity-50"
            >
              <span className="hidden sm:inline text-sm">Next</span>
              <CaretRight size={16} />
            </MyButton>
          </div>
          <div className="hidden sm:block h-6 w-px bg-neutral-200"></div>
          <AskDoubtButton />
        </div>
      </div>

      <div className="w-full flex-1 min-h-0 relative pb-16 sm:pb-0">
        <div className="h-full w-full transition-all duration-500">
          {content}
        </div>

        {/* Loading overlay with professional animation */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
              <div
                className="absolute inset-0 w-12 h-12 border-4 border-transparent border-r-blue-400 rounded-full animate-spin"
                style={{
                  animationDelay: "0.1s",
                  animationDirection: "reverse",
                }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {isUploading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-xl border border-neutral-200 p-6 max-w-sm w-full mx-4 animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4">
                <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
                <div
                  className="absolute inset-0 w-12 h-12 border-4 border-transparent border-r-blue-400 rounded-full animate-spin"
                  style={{
                    animationDelay: "0.1s",
                    animationDirection: "reverse",
                  }}
                ></div>
              </div>
              <h3 className="text-base font-semibold text-neutral-900 mb-2">
                Uploading Content
              </h3>
              <p className="text-sm text-neutral-500">
                Please wait while we process your file...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom navigation */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40">
        <div className="pointer-events-none absolute -top-3 left-0 right-0 h-3 bg-gradient-to-t from-white to-transparent"></div>
        <div className="bg-white border-t border-neutral-200 shadow-[0_-8px_20px_-12px_rgba(0,0,0,0.25)] px-3 py-2 pb-[calc(env(safe-area-inset-bottom)+10px)]">
          <div className="flex items-center gap-2">
            <MyButton
              scale="large"
              layoutVariant="icon"
              buttonType="secondary"
              onClick={goToPrev}
              disabled={!canGoPrev}
              aria-label="Previous slide"
              className="flex items-center justify-center font-medium transition-all duration-300 bg-white border border-neutral-300 hover:border-primary-400 rounded-lg backdrop-blur-sm hover:bg-primary-50 disabled:opacity-50"
            >
              <span className="text-base">{"<"}</span>
            </MyButton>

            <div className="flex-1 flex justify-center">
              <AskDoubtButton />
            </div>

            <MyButton
              scale="large"
              layoutVariant="icon"
              buttonType="secondary"
              onClick={goToNext}
              disabled={!canGoNext}
              aria-label="Next slide"
              className="flex items-center justify-center font-medium transition-all duration-300 bg-white border border-neutral-300 hover:border-primary-400 rounded-lg backdrop-blur-sm hover:bg-primary-50 disabled:opacity-50"
            >
              <span className="text-base">{">"}</span>
            </MyButton>
          </div>
        </div>
      </div>

      <DoubtResolutionSidebar />
    </div>
  );
};

const AskDoubtButton = () => {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    getStudentDisplaySettings(false)
      .then((s) =>
        setEnabled(s?.courseDetails?.slidesView?.canAskDoubt !== false)
      )
      .catch(() => setEnabled(true));
  }, []);
  if (!enabled) return null;
  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 delay-100">
      <MyButton
        scale="medium"
        onClick={() => {
          const { openSidebar } = useDoubtSidebarStore.getState();
          openSidebar();
        }}
        className="flex items-center gap-2 px-3 py-2 font-medium transition-all duration-300 hover:scale-[1.02] bg-white border border-neutral-300 hover:border-primary-400 rounded-lg backdrop-blur-sm hover:bg-primary-50"
        buttonType="secondary"
      >
        <span className="text-neutral-700 font-medium text-sm">Doubts</span>
        <div className="relative">
          <ChatText
            size={16}
            className="text-neutral-600 transition-all duration-300 group-hover:text-primary-600"
          />
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary-500 rounded-full animate-pulse"></div>
        </div>
      </MyButton>
    </div>
  );
};
