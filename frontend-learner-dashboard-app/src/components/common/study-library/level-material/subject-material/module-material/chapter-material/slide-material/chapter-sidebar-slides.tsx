// import { truncateString } from "@/lib/reusable/truncateString"; // Not needed since we show full titles now
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import {
  PlayCircle,
  BookOpenText,
  FilePdf,
  FileDoc,
  Circle,
  CheckCircle,
  Question,
  FileText,
  PresentationChart,
  Lightning,
  File,
  ChatText,
  Globe,
} from "@phosphor-icons/react";
import { useRouter } from "@tanstack/react-router";
import { Slide, useSlides } from "@/hooks/study-library/use-slides";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BookOpen, Code, Gamepad2 } from "lucide-react";
import { useDoubtSidebarStore } from "@/stores/study-library/doubt-sidebar-store";
import { useEffect, useState } from "react";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import { getPublicUrl } from "@/services/upload_file";
import { getPackageSessionId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";
import { isItemLocked } from "@/components/drip-conditions/helpers";
import { LockedBadge } from "@/components/drip-conditions";

// Helper function to get responsive truncation length - kept for tooltip usage
// const getResponsiveTruncationLength = () => {
//     if (typeof window !== 'undefined') {
//         const width = window.innerWidth;
//         if (width < 640) return 30; // Mobile - more text
//         if (width < 1024) return 25; // Tablet - moderate
//         return 20; // Desktop - less truncation
//     }
//     return 20; // Fallback
// };

// Helper function to calculate overall completion percentage
export const calculateOverallCompletion = (slides: Slide[]): number => {
  if (!slides || slides.length === 0) return 0;

  const totalSlides = slides.length;
  const totalCompletion = slides.reduce((sum, slide) => {
    // Treat null/undefined percentage_completed as 0, and cap each slide at 100%
    const percentage = Math.min(slide.percentage_completed ?? 0, 100);
    return sum + percentage;
  }, 0);

  // Cap the overall result at 100%
  return Math.min(Math.round(totalCompletion / totalSlides), 100);
};

// Helper function to get slide status
export const getSlideStatus = (percentage: number | null | undefined) => {
  if (percentage === null || percentage === undefined || percentage === 0) {
    return "not-started";
  }
  if (percentage >= 90) {
    return "completed";
  }
  return "in-progress";
};

// Map slide type to enterprise color palette for details display
const getTypeColorClasses = (slide: Slide, mediaKind?: "audio" | "video") => {
  switch (slide.source_type) {
    case "VIDEO":
      if (mediaKind === "audio") {
        return {
          text: "text-sky-700",
          bg: "bg-sky-50",
          dot: "bg-sky-500",
          detailText: "text-sky-600",
        };
      }
      return {
        text: "text-blue-700",
        bg: "bg-blue-50",
        dot: "bg-blue-500",
        detailText: "text-blue-600",
      };
    case "DOCUMENT":
      return {
        text: "text-amber-700",
        bg: "bg-amber-50",
        dot: "bg-amber-500",
        detailText: "text-amber-600",
      };
    case "QUESTION":
      return {
        text: "text-purple-700",
        bg: "bg-purple-50",
        dot: "bg-purple-500",
        detailText: "text-purple-600",
      };
    case "QUIZ":
      return {
        text: "text-teal-700",
        bg: "bg-teal-50",
        dot: "bg-teal-500",
        detailText: "text-teal-600",
      };
    case "ASSIGNMENT":
      return {
        text: "text-emerald-700",
        bg: "bg-emerald-50",
        dot: "bg-emerald-500",
        detailText: "text-emerald-600",
      };
    case "SCORM":
      return {
        text: "text-teal-700",
        bg: "bg-teal-50",
        dot: "bg-teal-500",
        detailText: "text-teal-600",
      };
    default:
      return {
        text: "text-gray-700",
        bg: "bg-gray-100",
        dot: "bg-gray-400",
        detailText: "text-gray-600",
      };
  }
};

// Helper function to get status details with modern design
export const getStatusDetails = (percentage: number | null | undefined) => {
  const status = getSlideStatus(percentage);
  switch (status) {
    case "not-started":
      return {
        label: "Not Started",
        description: "Start learning",
        icon: Circle,
        color: "text-gray-400",
        bgColor: "bg-gray-100",
        badge: null,
      };
    case "in-progress":
      return {
        label: "In Progress",
        description: `${percentage?.toFixed(0)}% done`,
        icon: Lightning,
        color: "text-primary-500",
        bgColor: "bg-primary-100",
        badge: "active",
      };
    case "completed":
      return {
        label: "Done",
        description: "Completed",
        icon: CheckCircle,
        color: "text-success-500",
        bgColor: "bg-success-100",
        badge: "done",
      };
    default:
      return {
        label: "Unknown",
        description: "Status unknown",
        icon: Circle,
        color: "text-gray-400",
        bgColor: "bg-gray-100",
        badge: null,
      };
  }
};

// Enhanced icon mapping with modern design matching admin theme
export const getIcon = (slide: Slide, size?: string): React.ReactNode => {
  const sizeClass = `w-${size || "4"} h-${size || "4"}`;
  const iconClass = `${sizeClass} transition-all duration-200 ease-in-out`;

  switch (slide.source_type) {
    case "VIDEO":
      return (
        <PlayCircle
          className={`${iconClass} text-success-500`}
          weight="duotone"
        />
      );
    case "QUESTION":
      return (
        <Question className={`${iconClass} text-purple-500`} weight="duotone" />
      );
    case "ASSIGNMENT":
      return <File className={`${iconClass} text-blue-500`} weight="duotone" />;
    case "DOCUMENT":
      switch (slide.document_slide?.type) {
        case "PDF":
          return (
            <FilePdf className={`${iconClass} text-red-500`} weight="duotone" />
          );
        case "DOC":
        case "DOCX":
          return (
            <FileDoc
              className={`${iconClass} text-blue-600`}
              weight="duotone"
            />
          );
        case "PRESENTATION":
          return (
            <PresentationChart
              className={`${iconClass} text-orange-500`}
              weight="duotone"
            />
          );
        case "CODE":
          return <Code className={`${iconClass} text-success-500`} />;
        case "JUPYTER":
          return <BookOpen className={`${iconClass} text-purple-500`} />;
        case "SCRATCH":
          return <Gamepad2 className={`${iconClass} text-orange-500`} />;
        default:
          return (
            <FileText
              className={`${iconClass} text-gray-500`}
              weight="duotone"
            />
          );
      }
    case "SCORM":
      return (
        <Globe
          className={`${iconClass} text-teal-500`}
          weight="duotone"
        />
      );
    default:
      return (
        <BookOpenText
          className={`${iconClass} text-gray-500`}
          weight="duotone"
        />
      );
  }
};

// Helper function to get slide type display text
export const getSlideTypeDisplay = (slide: Slide): string => {
  let baseType = "";
  let embeddedInfo = "";

  // Handle different source types with better English
  switch (slide.source_type) {
    case "VIDEO":
      baseType = "Video";
      if (slide.video_slide?.embedded_type) {
        switch (slide.video_slide.embedded_type) {
          case "CODE":
            embeddedInfo = " with Coding Exercise";
            break;
          case "SCRATCH":
            embeddedInfo = " with Scratch Problem";
            break;
          case "JUPYTER":
            embeddedInfo = " with Jupyter Notebook";
            break;
          default:
            if (slide.video_slide.embedded_type) {
              const embeddedType = String(slide.video_slide.embedded_type);
              embeddedInfo = ` with ${
                embeddedType.charAt(0).toUpperCase() +
                embeddedType.slice(1).toLowerCase()
              }`;
            }
        }
      }
      break;
    case "DOCUMENT":
      if (slide.document_slide?.type) {
        switch (slide.document_slide.type.toUpperCase()) {
          case "PDF":
            baseType = "PDF Document";
            break;
          case "DOC":
          case "DOCX":
            baseType = "Reading Note";
            break;
          case "PPT":
          case "PPTX":
            baseType = "Presentation";
            break;
          default:
            baseType = "Document";
        }
      } else {
        baseType = "Document";
      }
      break;
    case "QUESTION":
      baseType = "Question";
      break;
    case "QUIZ":
      baseType = "Quiz";
      break;
    case "ASSIGNMENT":
      baseType = "Assignment";
      break;
    case "SCORM":
      baseType = "SCORM Module";
      break;
    default:
      if (slide.source_type && typeof slide.source_type === "string") {
        baseType =
          slide.source_type.charAt(0).toUpperCase() +
          slide.source_type.slice(1).toLowerCase().replace("_", " ");
      } else {
        baseType = "Content";
      }
  }

  return baseType + embeddedInfo;
};

// Enhanced Slide Item Component matching admin theme
const SlideItem = ({
  slide,
  index,
  isActive,
  onClick,
  isLocked,
  unlockMessage,
}: {
  slide: Slide;
  index: number;
  isActive: boolean;
  onClick: () => void;
  isLocked?: boolean;
  unlockMessage?: string;
}) => {
  const [mediaKind, setMediaKind] = useState<"audio" | "video" | null>(null);

  useEffect(() => {
    let cancelled = false;
    const detectMediaKind = async () => {
      if (slide.source_type !== "VIDEO") return;
      const publishedId = slide.video_slide?.published_url;
      if (!publishedId) return;
      try {
        const url = await getPublicUrl(publishedId);
        if (!url) return;
        // Try HEAD request to detect content-type
        try {
          const res = await fetch(url, { method: "HEAD" });
          const contentType = res.headers.get("content-type") || "";
          if (!cancelled) {
            if (contentType.startsWith("audio")) {
              setMediaKind("audio");
              return;
            }
            if (contentType.startsWith("video")) {
              setMediaKind("video");
              return;
            }
          }
        } catch {
          // Ignore network/CORS errors and fall back to extension check
        }

        // Fallback: infer from file extension in URL
        try {
          const pathname = new URL(url).pathname.toLowerCase();
          if (/(\.mp3|\.wav|\.m4a|\.aac|\.ogg)$/.test(pathname)) {
            if (!cancelled) setMediaKind("audio");
            return;
          }
          if (/(\.mp4|\.webm|\.mov|\.mkv)$/.test(pathname)) {
            if (!cancelled) setMediaKind("video");
            return;
          }
        } catch {
          // If URL parsing fails, do nothing
        }
      } catch {
        // Ignore getPublicUrl errors
      }
    };
    detectMediaKind();
    return () => {
      cancelled = true;
    };
  }, [slide.id, slide.source_type, slide.video_slide?.published_url]);

  const typeColors = getTypeColorClasses(slide, mediaKind || undefined);
  const statusDetails = getStatusDetails(slide.percentage_completed);
  const StatusIcon = statusDetails.icon;
  const isCompleted = slide.percentage_completed >= 80;

  const getSlideTitle = () => {
    return (
      (slide.source_type === "DOCUMENT" && slide.document_slide?.title) ||
      (slide.source_type === "VIDEO" && slide.video_slide?.title) ||
      (slide.source_type === "QUESTION" && slide?.title) ||
      (slide.source_type === "ASSIGNMENT" && slide?.title) ||
      slide.title ||
      "Untitled"
    );
  };

  const getStatusBadge = () => {
    if (!statusDetails.badge) return null;
    return (
      <div
        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium transition-all duration-200 ${
          statusDetails.badge === "done"
            ? "bg-success-50 border border-success-200 text-success-600"
            : "bg-primary-50 border border-primary-200 text-primary-600"
        }`}
      >
        {statusDetails.badge === "done" ? "✓" : "•"}
      </div>
    );
  };

  // Helper function to format duration from milliseconds to readable format
  const formatDuration = (millis: number): string => {
    const minutes = Math.floor(millis / 60000);
    const seconds = Math.floor((millis % 60000) / 1000);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0
        ? `${hours}h ${remainingMinutes}m`
        : `${hours}h`;
    }
    return seconds > 0 && minutes < 5
      ? `${minutes}m ${seconds}s`
      : `${minutes}m`;
  };

  // Helper function to get content details (duration for videos, pages for documents, questions for quizzes)
  const getContentDetails = (slide: Slide): string => {
    // Video duration
    if (
      slide.source_type === "VIDEO" &&
      slide.video_slide?.video_length_in_millis
    ) {
      return formatDuration(slide.video_slide.video_length_in_millis);
    }
    if (
      slide.source_type === "VIDEO" &&
      slide.video_slide?.published_video_length_in_millis
    ) {
      return formatDuration(slide.video_slide.published_video_length_in_millis);
    }

    // Document pages
    if (slide.source_type === "DOCUMENT" && slide.document_slide?.total_pages) {
      const pages = slide.document_slide.total_pages;
      return `${pages} page${pages !== 1 ? "s" : ""}`;
    }
    if (
      slide.source_type === "DOCUMENT" &&
      slide.document_slide?.published_document_total_pages
    ) {
      const pages = slide.document_slide.published_document_total_pages;
      return `${pages} page${pages !== 1 ? "s" : ""}`;
    }

    // Question count for question slides
    if (slide.source_type === "QUESTION" && slide.question_slide?.options) {
      const optionCount = slide.question_slide.options.length;
      if (optionCount > 0) {
        return `${optionCount} option${optionCount !== 1 ? "s" : ""}`;
      } else {
        return "1 question";
      }
    }

    // For single question slides without options (like text input)
    if (slide.source_type === "QUESTION") {
      return "1 question";
    }

    // Assignment questions - check if there are questions in assignment data
    if (slide.source_type === "ASSIGNMENT") {
      // For assignments, we'll show "Assignment" as the type handles the complexity
      // but we can try to extract question count if available in the slide data
      const assignmentSlide = slide as Slide & {
        assignment_slide?: { questions?: unknown[] };
      };
      if (
        assignmentSlide.assignment_slide?.questions &&
        Array.isArray(assignmentSlide.assignment_slide.questions)
      ) {
        const questionCount = assignmentSlide.assignment_slide.questions.length;
        if (questionCount > 0) {
          return `${questionCount} question${questionCount !== 1 ? "s" : ""}`;
        }
      }
      return "Assignment";
    }

    // Quiz slides - check for quiz questions
    if (slide.source_type === "QUIZ") {
      const quizSlide = slide as Slide & {
        quiz_slide?: { questions?: unknown[] };
      };
      if (
        quizSlide.quiz_slide?.questions &&
        Array.isArray(quizSlide.quiz_slide.questions)
      ) {
        const questionCount = quizSlide.quiz_slide.questions.length;
        if (questionCount > 0) {
          return `${questionCount} question${questionCount !== 1 ? "s" : ""}`;
        }
      }
      return "Quiz";
    }

    return "";
  };

  const handleDoubtClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
    setTimeout(() => {
      const { openSidebar } = useDoubtSidebarStore.getState();
      openSidebar();
    }, 100);
  };
  const [canAskDoubt, setCanAskDoubt] = useState<boolean>(true);
  useEffect(() => {
    getStudentDisplaySettings(false)
      .then((s) => {
        const val = s?.courseDetails?.slidesView?.canAskDoubt !== false;
        setCanAskDoubt(val);
      })
      .catch(() => setCanAskDoubt(true));
  }, []);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            role="listitem"
            aria-current={isActive ? "true" : undefined}
            className={`w-full transition-all duration-200 ease-in-out animate-fade-in-up group/slide ${
              isLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            }`}
            onClick={isLocked ? undefined : onClick}
            style={{
              animationDelay: `${index * 50}ms`,
            }}
          >
            <div
              className={`
                flex w-full items-center gap-2 rounded-md px-2 py-2
                transition-all duration-150
                ${
                  isActive
                    ? "text-primary-700 bg-primary-50 border border-primary-200/60"
                    : "bg-white text-gray-700 hover:bg-gray-50 border border-transparent"
                }
              `}
            >
              {/* Slide Number */}
              <div
                className={`
                  flex w-5 h-5 shrink-0 items-center justify-center rounded text-[11px] font-bold
                  ${
                    isActive
                      ? "bg-primary-500 text-white"
                      : "bg-gray-100 text-gray-400"
                  }
                `}
              >
                {index + 1}
              </div>

              {/* Icon */}
              <div className="shrink-0">{getIcon(slide, "3.5")}</div>

              {/* Title + type on one compact block */}
              <div className="min-w-0 flex-1">
                <h4 className="text-[13px] font-medium leading-tight truncate">
                  {getSlideTitle()}
                </h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${typeColors.text}`}>
                    <span className={`w-1 h-1 rounded-full ${typeColors.dot}`}></span>
                    {slide.source_type === "VIDEO" && mediaKind === "audio"
                      ? "Audio"
                      : getSlideTypeDisplay(slide)}
                  </span>
                  {getContentDetails(slide) && (
                    <span className="text-[10px] text-gray-400">
                      {getContentDetails(slide)}
                    </span>
                  )}
                </div>
              </div>

              {/* Right side: progress or status */}
              <div className="shrink-0 flex items-center gap-1">
                {isLocked ? (
                  <LockedBadge size="sm" unlockMessage={unlockMessage} />
                ) : slide.percentage_completed != null ? (
                  <span
                    className={`text-[10px] font-semibold ${
                      isCompleted
                        ? "text-success-600"
                        : isActive
                        ? "text-primary-600"
                        : "text-gray-400"
                    }`}
                  >
                    {Math.min(slide.percentage_completed > 100 ? 100 : Math.round(slide.percentage_completed), 100)}%
                  </span>
                ) : null}
                {!isLocked && (
                  <StatusIcon
                    className={`w-3.5 h-3.5 ${statusDetails.color}`}
                    weight="duotone"
                  />
                )}
              </div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className="max-w-[220px] border border-gray-200 bg-white text-gray-700 shadow-sm z-[9999] px-2.5 py-1.5"
          sideOffset={4}
        >
          <p className="font-medium text-xs leading-snug">{getSlideTitle()}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {getSlideTypeDisplay(slide)}
            {getContentDetails(slide) && ` · ${getContentDetails(slide)}`}
            {slide.percentage_completed != null && ` · ${slide.percentage_completed.toFixed(0)}%`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const ChapterSidebarSlides = () => {
  const { activeItem, setActiveItem, items, slideEvaluations } =
    useContentStore();
  const router = useRouter();
  const { chapterId } = router.state.location.search;
  const { slides: rawSlides, isLoading } = useSlides(chapterId || "");

  // Use items from store if available (filtered by drip conditions), otherwise use raw slides
  const slides =
    items.length > 0
      ? items.filter((s) => s.id !== "feedback-slide")
      : rawSlides;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 animate-fade-in-up">
        <div className="relative">
          <DashboardLoader />
          <div className="absolute inset-0 bg-gradient-to-r from-primary-100/20 to-primary-200/20 rounded-full blur-xl animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!slides || slides.length === 0) {
    return (
      <div className="relative overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50/30 via-transparent to-primary-50/20 pointer-events-none rounded-xl"></div>

        <div className="relative flex flex-col items-center justify-center px-3 py-6 text-center animate-fade-in-up">
          <div className="mb-3 flex w-10 h-10 animate-gentle-pulse items-center justify-center rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 shadow-sm">
            <File className="w-5 h-5 text-gray-400" weight="duotone" />
          </div>
          <h3 className="mb-1 text-sm font-bold text-gray-900">
            No slides available
          </h3>
          <p className="max-w-xs text-xs leading-relaxed text-gray-500">
            Slides will appear here when content is added
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full max-w-full overflow-hidden animate-fade-in-up"
      role="list"
      aria-label="Chapter slides list"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-50/30 pointer-events-none rounded-xl"></div>
      <div className="relative flex w-full flex-col gap-1 text-gray-600">
        {slides?.map((slide: Slide, index: number) => {
          const evaluation = slideEvaluations[slide.id];
          const locked = evaluation ? isItemLocked(evaluation) : false;
          const unlockMessage = evaluation?.unlockMessage ?? undefined;

          return (
            <SlideItem
              key={slide.id}
              slide={slide}
              index={index}
              isActive={slide.id === activeItem?.id}
              isLocked={locked}
              unlockMessage={unlockMessage}
              onClick={async () => {
                // Don't navigate if slide is locked
                if (locked) {
                  return;
                }

                // ✅ Immediate UI update for smooth transition
                setActiveItem(slide);

                // ✅ Get sessionId (required for quiz functionality)
                const currentSearch = router.state.location.search as Record<
                  string,
                  string
                >;
                const sessionId =
                  currentSearch.sessionId || (await getPackageSessionId());

                // ✅ Navigate with all required parameters
                router.navigate({
                  to: router.state.location.pathname,
                  search: {
                    ...currentSearch,
                    slideId: slide.id,
                    sessionId: sessionId || "",
                  },
                  replace: true,
                });
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
