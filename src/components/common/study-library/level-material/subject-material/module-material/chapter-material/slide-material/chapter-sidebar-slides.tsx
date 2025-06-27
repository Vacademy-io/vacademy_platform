import { useSidebar } from "@/components/ui/sidebar";
import { truncateString } from "@/lib/reusable/truncateString";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { PlayCircle, BookOpenText, FilePdf, FileDoc, Circle, ClockCounterClockwise, CheckCircle } from "@phosphor-icons/react";
import { useRouter } from "@tanstack/react-router";
import { Slide, useSlides } from "@/hooks/study-library/use-slides";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Helper function to get slide status
export const getSlideStatus = (percentage: number | null | undefined) => {
  if (percentage === null || percentage === undefined) {
    return 'not-started';
  }
  if (percentage >= 80) {
    return 'completed';
  }
  return 'in-progress';
};

// Helper function to get status details
export const getStatusDetails = (percentage: number | null | undefined) => {
  const status = getSlideStatus(percentage);
  switch (status) {
    case 'not-started':
      return {
        label: 'Not Started',
        description: 'This slide has not been viewed yet',
        icon: Circle,
        color: 'text-gray-400'
      };
    case 'in-progress':
      return {
        label: 'In Progress',
        description: percentage === 0 
          ? 'Just started - Continue learning'
          : `${percentage?.toFixed(0)}% completed - Continue where you left off`,
        icon: ClockCounterClockwise,
        color: 'text-blue-500'
      };
    case 'completed':
      return {
        label: 'Completed',
        description: `${percentage?.toFixed(0)}% completed - Well done!`,
        icon: CheckCircle,
        color: 'text-green-600'
      };
    default:
      return {
        label: 'Unknown',
        description: 'Status unknown',
        icon: Circle,
        color: 'text-gray-400'
      };
  }
};

export const getIcon = (slide: Slide, size?: string): React.ReactNode => {
  const sizeClass = `size-${size ? size : "5"}`;
  // For debugging
  console.log("slide object:", slide);

  if (slide.source_type === "VIDEO") {
    return <PlayCircle className={sizeClass} />;
  }
  if (slide.source_type === "DOCUMENT") {
    // Check the document type
    const docType = slide.document_slide?.type;
    if (docType === "PDF") {
      return <FilePdf className={sizeClass} />;
    }
    if (docType === "DOC") {
      return <FileDoc className={sizeClass} />;
    }
    // Default for other document types
    return <BookOpenText className={sizeClass} />;
  }
  // Default icon for other types (e.g., assignment, question, etc.)
  return <BookOpenText className={sizeClass} />;
};

export const ChapterSidebarSlides = () => {
  const { open } = useSidebar();
  const { activeItem, setActiveItem } = useContentStore();
  const router = useRouter();
  const { chapterId } = router.state.location.search;
  const { slides, isLoading } = useSlides(chapterId || "");
  console.log(slides);

  if (isLoading) {
    return <DashboardLoader />;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex w-full flex-col gap-1.5">
        {slides?.map((slide: Slide, index: number) => {
          const statusDetails = getStatusDetails(slide.percentage_completed);
          const StatusIcon = statusDetails.icon;
          
          return (
            <div
              key={slide.id}
              onClick={() => setActiveItem(slide)}
              className={`group flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 transition-all duration-200 ease-in-out animate-slide-in-left ${
                slide.id === activeItem?.id
                  ? "bg-primary-50 border border-primary-200 text-primary-700 shadow-sm scale-[1.02]"
                  : "hover:bg-gray-50 hover:border hover:border-gray-200 hover:shadow-sm hover:scale-[1.01] text-gray-600"
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
              title={slide.title || ""}
            >
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className={`flex-shrink-0 transition-all duration-200 ${
              slide.percentage_completed >= 80 
                ? "text-green-600" 
                : slide.id === activeItem?.id 
                  ? "text-primary-600" 
                  : "text-gray-500 group-hover:text-gray-700"
            }`}>
              {getIcon(slide, "4")}
            </div>
            
            {open && (
              <p className="flex-1 text-xs font-medium truncate transition-colors duration-200">
                {truncateString(slide.title || "", 20)}
              </p>
            )}
          </div>
          
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Status icon with tooltip */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`flex-shrink-0 transition-all duration-200 ${statusDetails.color}`}>
                      <StatusIcon className="w-4 h-4" weight="fill" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-48">
                    <div className="text-center">
                      <p className="font-medium text-sm">{statusDetails.label}</p>
                      <p className="text-xs text-gray-600 mt-1">{statusDetails.description}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>

                {/* Progress indicator */}
                {slide.percentage_completed != null && (
                  <>
                    <div className="relative w-6 h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`absolute left-0 top-0 h-full rounded-full transition-all duration-300 ${
                          slide.percentage_completed >= 80 
                            ? "bg-green-500" 
                            : slide.id === activeItem?.id 
                              ? "bg-primary-500" 
                              : "bg-blue-400"
                        }`}
                        style={{ 
                          width: `${Math.min(slide.percentage_completed > 100 ? 100 : slide.percentage_completed, 100)}%` 
                        }}
                      />
                    </div>
                    
                    {/* Percentage text */}
                    <span className={`text-xs font-semibold min-w-[30px] text-right transition-colors duration-200 ${
                      slide.percentage_completed >= 80 
                        ? "text-green-600" 
                        : slide.id === activeItem?.id 
                          ? "text-primary-600" 
                          : "text-blue-500"
                    }`}>
                      {slide.percentage_completed > 100 ? 100 : slide.percentage_completed.toFixed(0)}%
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
};
