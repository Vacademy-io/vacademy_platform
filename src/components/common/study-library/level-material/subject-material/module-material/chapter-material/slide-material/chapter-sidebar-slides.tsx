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
        // Treat null/undefined percentage_completed as 0
        const percentage = slide.percentage_completed ?? 0;
        return sum + percentage;
    }, 0);

    return Math.round(totalCompletion / totalSlides);
};

// Helper function to get slide status
export const getSlideStatus = (percentage: number | null | undefined) => {
    if (percentage === null || percentage === undefined) {
        return "not-started";
    }
    if (percentage >= 80) {
        return "completed";
    }
    return "in-progress";
};

// Helper function to get status details with modern design
export const getStatusDetails = (percentage: number | null | undefined) => {
    const status = getSlideStatus(percentage);
    switch (status) {
        case "not-started":
            return {
                label: "Ready",
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
                <Question
                    className={`${iconClass} text-purple-500`}
                    weight="duotone"
                />
            );
        case "ASSIGNMENT":
            return (
                <File
                    className={`${iconClass} text-blue-500`}
                    weight="duotone"
                />
            );
        case "DOCUMENT":
            switch (slide.document_slide?.type) {
                case "PDF":
                    return (
                        <FilePdf
                            className={`${iconClass} text-red-500`}
                            weight="duotone"
                        />
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
                    return (
                        <BookOpen className={`${iconClass} text-purple-500`} />
                    );
                case "SCRATCH":
                    return (
                        <Gamepad2 className={`${iconClass} text-orange-500`} />
                    );
                default:
                    return (
                        <FileText
                            className={`${iconClass} text-gray-500`}
                            weight="duotone"
                        />
                    );
            }
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
                            embeddedInfo = ` with ${embeddedType.charAt(0).toUpperCase() + embeddedType.slice(1).toLowerCase()}`;
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
                        baseType = "Word Document";
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
        default:
            if (slide.source_type && typeof slide.source_type === 'string') {
                baseType = slide.source_type.charAt(0).toUpperCase() + slide.source_type.slice(1).toLowerCase().replace("_", " ");
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
}: {
    slide: Slide;
    index: number;
    isActive: boolean;
    onClick: () => void;
}) => {
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
            return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
        }
        return seconds > 0 && minutes < 5 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    };

    // Helper function to get content details (duration for videos, pages for documents, questions for quizzes)
    const getContentDetails = (slide: Slide): string => {
        // Video duration
        if (slide.source_type === "VIDEO" && slide.video_slide?.video_length_in_millis) {
            return formatDuration(slide.video_slide.video_length_in_millis);
        }
        if (slide.source_type === "VIDEO" && slide.video_slide?.published_video_length_in_millis) {
            return formatDuration(slide.video_slide.published_video_length_in_millis);
        }
        
        // Document pages
        if (slide.source_type === "DOCUMENT" && slide.document_slide?.total_pages) {
            const pages = slide.document_slide.total_pages;
            return `${pages} page${pages !== 1 ? 's' : ''}`;
        }
        if (slide.source_type === "DOCUMENT" && slide.document_slide?.published_document_total_pages) {
            const pages = slide.document_slide.published_document_total_pages;
            return `${pages} page${pages !== 1 ? 's' : ''}`;
        }
        
        // Question count for question slides
        if (slide.source_type === "QUESTION" && slide.question_slide?.options) {
            const optionCount = slide.question_slide.options.length;
            if (optionCount > 0) {
                return `${optionCount} option${optionCount !== 1 ? 's' : ''}`;
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
            const assignmentSlide = slide as Slide & { assignment_slide?: { questions?: unknown[] } };
            if (assignmentSlide.assignment_slide?.questions && Array.isArray(assignmentSlide.assignment_slide.questions)) {
                const questionCount = assignmentSlide.assignment_slide.questions.length;
                if (questionCount > 0) {
                    return `${questionCount} question${questionCount !== 1 ? 's' : ''}`;
                }
            }
            return "Assignment";
        }
        
        // Quiz slides - check for quiz questions
        if (slide.source_type === "QUIZ") {
            const quizSlide = slide as Slide & { quiz_slide?: { questions?: unknown[] } };
            if (quizSlide.quiz_slide?.questions && Array.isArray(quizSlide.quiz_slide.questions)) {
                const questionCount = quizSlide.quiz_slide.questions.length;
                if (questionCount > 0) {
                    return `${questionCount} question${questionCount !== 1 ? 's' : ''}`;
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
                        className="w-full transition-all duration-200 ease-in-out animate-fade-in-up cursor-pointer group/slide"
                        onClick={onClick}
                        style={{
                            animationDelay: `${index * 50}ms`,
                        }}
                    >
                        <div
                            className={`
                flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 
                backdrop-blur-sm transition-all duration-200 ease-in-out
                ${
                    isActive
                        ? "text-primary-600 border-primary-300 bg-primary-50/80 shadow-md"
                        : "border-gray-200/60 bg-white/60 text-gray-600 hover:bg-white hover:border-gray-300 hover:shadow-sm"
                }
              `}
                        >
                            <div className="flex flex-1 items-center gap-2 min-w-0">
                                {/* Slide Number */}
                                <div
                                    className={`
                    flex w-5 h-5 items-center justify-center rounded-md text-xs font-bold transition-all duration-200
                    ${
                        isActive
                            ? "bg-primary-500 text-white"
                            : "bg-gray-100 text-gray-500 group-hover/slide:bg-gray-200"
                    }
                  `}
                                >
                                    {index + 1}
                                </div>

                                {/* Icon */}
                                <div className="shrink-0">
                                    {getIcon(slide, "3.5")}
                                </div>

                                {/* Content area - more compact layout */}
                                <div className="min-w-0 flex-1 space-y-1">
                                    {/* Title - show full title without truncation */}
                                    <div className="flex items-start gap-1.5">
                                        <h4 className="flex-1 text-xs font-semibold leading-tight">
                                            {getSlideTitle()}
                                        </h4>
                                        {getStatusBadge()}
                                    </div>

                                    {/* Type and content details */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs leading-tight text-gray-500 truncate">
                                                {getSlideTypeDisplay(slide)}
                                            </p>
                                            {/* Content details (duration/pages) */}
                                            {getContentDetails(slide) && (
                                                <p className="text-xs leading-tight text-gray-400 font-medium">
                                                    {getContentDetails(slide)}
                                                </p>
                                            )}
                                        </div>

                                        {/* Progress section - more compact */}
                                        {slide.percentage_completed != null && (
                                            <div className="flex items-center gap-1">
                                                <div className="relative w-6 h-1 bg-gray-200 rounded-full overflow-hidden">
                                                    <div
                                                        className={`absolute left-0 top-0 h-full rounded-full transition-all duration-300 ${
                                                            isCompleted
                                                                ? "bg-gradient-to-r from-success-400 to-success-500"
                                                                : isActive
                                                                  ? "bg-gradient-to-r from-primary-400 to-primary-600"
                                                                  : "bg-gradient-to-r from-blue-400 to-blue-500"
                                                        }`}
                                                        style={{
                                                            width: `${Math.min(
                                                                slide.percentage_completed >
                                                                    100
                                                                    ? 100
                                                                    : slide.percentage_completed,
                                                                100
                                                            )}%`,
                                                        }}
                                                    />
                                                </div>

                                                <span
                                                    className={`text-xs font-bold min-w-[20px] text-right transition-colors duration-200 ${
                                                        isCompleted
                                                            ? "text-success-600"
                                                            : isActive
                                                              ? "text-primary-600"
                                                              : "text-blue-500"
                                                    }`}
                                                >
                                                    {slide.percentage_completed >
                                                    100
                                                        ? 100
                                                        : slide.percentage_completed.toFixed(
                                                              0
                                                          )}
                                                    %
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Ask Doubt Button - appears on hover */}
                                {canAskDoubt && (
                                <div className="flex items-center justify-center w-6 h-6 opacity-0 group-hover/slide:opacity-100 transition-opacity duration-200">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={handleDoubtClick}
                                                    className="flex items-center justify-center w-5 h-5 rounded-md bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 transition-all duration-200"
                                                >
                                                    <ChatText
                                                        className="w-2.5 h-2.5 text-gray-600"
                                                        weight="duotone"
                                                    />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent
                                                side="left"
                                                className="bg-gray-900 text-white text-xs px-2 py-1"
                                            >
                                                Ask Doubt
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                )}

                                {/* Status indicator */}
                                <div className="shrink-0">
                                    <div
                                        className={`p-0.5 rounded-md transition-all duration-200 ${
                                            isActive
                                                ? statusDetails.bgColor
                                                : "hover:bg-gray-50"
                                        }`}
                                    >
                                        <StatusIcon
                                            className={`w-3 h-3 transition-colors duration-200 ${statusDetails.color}`}
                                            weight="duotone"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </TooltipTrigger>
                <TooltipContent
                    side="right"
                    className="max-w-xs border border-gray-300 bg-white/95 text-gray-700 shadow-lg backdrop-blur-sm z-[9999]"
                    sideOffset={8}
                >
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <StatusIcon
                                className={`w-3.5 h-3.5 ${statusDetails.color}`}
                                weight="duotone"
                            />
                            <p className="font-semibold text-xs">
                                {statusDetails.label}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="font-medium text-xs">
                                {getSlideTitle()}
                            </p>
                            <p className="text-xs text-gray-500">
                                {getSlideTypeDisplay(slide)}
                            </p>
                            {getContentDetails(slide) && (
                                <p className="text-xs text-gray-400 font-medium">
                                    {getContentDetails(slide)}
                                </p>
                            )}
                            <p className="text-xs text-gray-400 leading-relaxed">
                                {statusDetails.description}
                            </p>
                            {slide.percentage_completed != null && (
                                <div className="pt-1 border-t border-gray-200">
                                    <p className="text-xs text-gray-500">
                                        Progress:{" "}
                                        {slide.percentage_completed.toFixed(0)}%
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

export const ChapterSidebarSlides = () => {
    const { activeItem, setActiveItem } = useContentStore();
    const router = useRouter();
    const { chapterId } = router.state.location.search;
    const { slides, isLoading } = useSlides(chapterId || "");

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
                        <File
                            className="w-5 h-5 text-gray-400"
                            weight="duotone"
                        />
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
        <div className="relative w-full max-w-full overflow-hidden animate-fade-in-up">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-50/30 pointer-events-none rounded-xl"></div>
            <div className="relative flex w-full flex-col gap-1 text-gray-600">
                {slides?.map((slide: Slide, index: number) => (
                    <SlideItem
                        key={slide.id}
                        slide={slide}
                        index={index}
                        isActive={slide.id === activeItem?.id}
                        onClick={() => {
                            setActiveItem(slide);
                            router.navigate({
                                to: router.state.location.pathname,
                                search: {
                                    ...router.state.location.search,
                                    slideId: slide.id,
                                },
                            });
                        }}
                    />
                ))}
            </div>
        </div>
    );
};
