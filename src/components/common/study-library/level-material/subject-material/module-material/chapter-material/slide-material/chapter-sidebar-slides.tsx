import { truncateString } from "@/lib/reusable/truncateString";
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
        label: "Ready to Start",
        description: "Begin your learning journey",
        icon: Circle,
        color: "text-neutral-400",
        bgColor: "bg-neutral-100",
        badge: null,
      };
    case "in-progress":
      return {
        label: "In Progress",
        description:
          percentage === 0
            ? "Just started - Keep going!"
            : `${percentage?.toFixed(0)}% completed - You're doing great!`,
        icon: Lightning,
        color: "text-primary-500",
        bgColor: "bg-primary-100",
        badge: "learning",
      };
    case "completed":
      return {
        label: "Completed",
        description: `Perfect! 100% mastered`,
        icon: CheckCircle,
        color: "text-green-500",
        bgColor: "bg-green-100",
        badge: "mastered",
      };
    default:
      return {
        label: "Unknown",
        description: "Status unknown",
        icon: Circle,
        color: "text-neutral-400",
        bgColor: "bg-neutral-100",
        badge: null,
      };
  }
};

// Enhanced icon mapping with modern design matching admin theme
export const getIcon = (slide: Slide, size?: string): React.ReactNode => {
  const sizeClass = `size-${size || "4"}`;
  const iconClass = `${sizeClass} transition-all duration-200 ease-in-out`;

  switch (slide.source_type) {
    case "VIDEO":
      return (
        <PlayCircle
          className={`${iconClass} text-green-500`}
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
          return <Code className={`${iconClass} text-green-500`} />;
        case "JUPYTER":
          return <BookOpen className={`${iconClass} text-purple-500`} />;
        case "SCRATCH":
          return <Gamepad2 className={`${iconClass} text-orange-500`} />;
        default:
          return (
            <FileText
              className={`${iconClass} text-neutral-500`}
              weight="duotone"
            />
          );
      }
    default:
      return (
        <BookOpenText
          className={`${iconClass} text-neutral-500`}
          weight="duotone"
        />
      );
  }
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
  // Doubt sidebar is now managed via direct store access in handleDoubtClick

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
          statusDetails.badge === "mastered"
            ? "bg-green-50 border border-green-200 text-green-600"
            : "bg-primary-50 border border-primary-200 text-primary-600"
        }`}
      >
        {statusDetails.badge === "mastered" ? "Done" : "Active"}
      </div>
    );
  };

  const getSlideTypeDisplay = (slide: Slide): string => {
    // For DOCUMENT slides with specific sub-types (not DOC), show just the sub-type
    if (
      slide.source_type === "DOCUMENT" &&
      slide.document_slide?.type &&
      slide.document_slide.type !== "DOC"
    ) {
      return slide.document_slide.type.toLowerCase().replace("_", " ");
    }

    // For VIDEO slides with embedded_type, show the embedded_type
    if (slide.source_type === "VIDEO" && slide.video_slide?.embedded_type) {
      return `${slide.source_type
        .toLowerCase()
        .replace("_", " ")} - ${slide.video_slide.embedded_type
        .toLowerCase()
        .replace("_", " ")}`;
    }

    // For all other cases, show the main source_type
    return slide.source_type.toLowerCase().replace("_", " ");
  };

  const handleDoubtClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the slide click
    // First set this slide as active
    onClick();
    // Then open the doubt sidebar after a short delay to ensure the slide is active
    setTimeout(() => {
      const { openSidebar } = useDoubtSidebarStore.getState();
      openSidebar();
    }, 100);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="w-full transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-left-2 hover:scale-[1.01] cursor-pointer group/slide"
            onClick={onClick}
            style={{
              animationDelay: `${index * 80}ms`,
              animation: `slideInUp 0.5s ease-out ${index * 80}ms both`,
            }}
          >
            <div
              className={`
                flex w-full items-center gap-2.5 rounded-lg border px-3
                py-2 backdrop-blur-sm transition-all
                duration-300 ease-in-out relative
                ${
                  isActive
                    ? "text-primary-600 border-primary-300 bg-primary-50/80 shadow-md shadow-primary-100/50"
                    : "hover:bg-primary-25 border-neutral-100 bg-white/60 text-neutral-600 hover:border-primary-200 hover:text-primary-500 hover:shadow-sm"
                }
                group hover:shadow-md
              `}
            >
              <div className="flex flex-1 items-center gap-2.5 min-w-0">
                {/* Slide Number with enhanced styling */}
                <div
                  className={`
                    flex size-6 items-center justify-center rounded-md text-xs font-bold transition-all
                    duration-200 ease-in-out group-hover:scale-105
                    ${
                      isActive
                        ? "bg-primary-500 text-white shadow-sm"
                        : "group-hover:text-primary-600 bg-neutral-100 text-neutral-500 group-hover:bg-primary-100"
                    }
                  `}
                >
                  {index + 1}
                </div>

                {/* Icon with enhanced styling */}
                <div className="shrink-0">{getIcon(slide, "4")}</div>

                {/* Content area */}
                <div className="min-w-0 flex-1 space-y-1">
                  {/* Title and badge */}
                  <div className="flex items-start gap-2">
                    <h4 className="flex-1 text-sm font-medium leading-tight truncate">
                      {truncateString(getSlideTitle(), 18)}
                    </h4>

                    {/* Status badge */}
                    {getStatusBadge()}
                  </div>

                  {/* Source type */}
                  <p className="text-xs capitalize leading-tight text-neutral-400">
                    {getSlideTypeDisplay(slide)}
                  </p>

                  {/* Progress section */}
                  {slide.percentage_completed != null && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                        <div
                          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ease-out ${
                            isCompleted
                              ? "bg-gradient-to-r from-green-400 to-green-500"
                              : isActive
                              ? "bg-gradient-to-r from-primary-400 to-primary-600"
                              : "bg-gradient-to-r from-blue-400 to-blue-500"
                          }`}
                          style={{
                            width: `${Math.min(
                              slide.percentage_completed > 100
                                ? 100
                                : slide.percentage_completed,
                              100
                            )}%`,
                            boxShadow: isCompleted
                              ? "0 0 8px rgba(34, 197, 94, 0.4)"
                              : undefined,
                          }}
                        />
                      </div>

                      <span
                        className={`text-xs font-bold min-w-[35px] text-right transition-colors duration-200 ${
                          isCompleted
                            ? "text-green-600"
                            : isActive
                            ? "text-primary-600"
                            : "text-blue-500"
                        }`}
                      >
                        {slide.percentage_completed > 100
                          ? 100
                          : slide.percentage_completed.toFixed(0)}
                        %
                      </span>
                    </div>
                  )}
                </div>

                {/* Completion indicator for completed slides */}
                {isCompleted && (
                  <div className="shrink-0 relative">
                    <CheckCircle
                      className="size-3 text-green-400 animate-pulse"
                      weight="fill"
                    />
                    <div className="absolute inset-0 animate-ping">
                      <CheckCircle
                        className="size-3 text-green-400 opacity-75"
                        weight="fill"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Ask Doubt Button - appears on hover */}
              <div className="flex items-center justify-center w-7 h-7 opacity-0 group-hover/slide:opacity-100 transition-all duration-200 ease-in-out">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleDoubtClick}
                        className="flex items-center justify-center w-6 h-6 rounded-md bg-white/90 hover:bg-white border border-primary-200/60 hover:border-primary-300 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-110 group/doubt"
                      >
                        <ChatText 
                          className="w-3 h-3 text-primary-600 group-hover/doubt:text-primary-700" 
                          weight="duotone" 
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="bg-slate-900 text-white text-xs px-2 py-1">
                      Ask Doubt
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Status indicator */}
              <div className="shrink-0">
                <div
                  className={`p-1 rounded-md transition-all duration-300 ${
                    isActive ? statusDetails.bgColor : "hover:bg-neutral-50"
                  }`}
                >
                  <StatusIcon
                    className={`size-3.5 transition-all duration-300 ${statusDetails.color}`}
                    weight="duotone"
                  />
                </div>
              </div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className="max-w-xs border border-neutral-300 bg-white/95 text-neutral-700 shadow-lg backdrop-blur-sm z-[9999]"
          sideOffset={8}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <StatusIcon
                className={`size-4 ${statusDetails.color}`}
                weight="duotone"
              />
              <p className="font-semibold text-sm">{statusDetails.label}</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">{getSlideTitle()}</p>
              <p className="text-xs capitalize text-neutral-500">
                {slide.source_type.toLowerCase().replace("_", " ")}
              </p>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {statusDetails.description}
              </p>
              {slide.percentage_completed != null && (
                <div className="pt-1 border-t border-neutral-200">
                  <p className="text-xs text-neutral-500">
                    Progress: {slide.percentage_completed.toFixed(0)}%
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
      <div className="flex items-center justify-center py-6 duration-500 animate-in fade-in">
        <DashboardLoader />
      </div>
    );
  }

  if (!slides || slides.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-3 py-8 text-center duration-700 animate-in fade-in slide-in-from-bottom-4">
        <div className="mb-3 flex size-12 animate-pulse items-center justify-center rounded-full bg-neutral-100">
          <File className="size-6 text-neutral-400" />
        </div>
        <h3 className="mb-1 text-base font-medium text-neutral-600">
          No slides yet
        </h3>
        <p className="max-w-xs text-xs leading-relaxed text-neutral-400">
          Slides will appear here when available
        </p>
      </div>
    );
  }

  return (
    <div className="duration-500 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex w-full flex-col gap-1.5 px-1 text-neutral-600">
        {slides?.map((slide: Slide, index: number) => (
          <SlideItem
            key={slide.id}
            slide={slide}
            index={index}
            isActive={slide.id === activeItem?.id}
            onClick={() => setActiveItem(slide)}
          />
        ))}
      </div>

      {/* Custom animation styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes slideInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `,
        }}
      />
    </div>
  );
};