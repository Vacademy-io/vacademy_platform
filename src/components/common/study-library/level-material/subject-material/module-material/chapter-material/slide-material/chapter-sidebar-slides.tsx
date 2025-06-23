import { useSidebar } from "@/components/ui/sidebar";
import { truncateString } from "@/lib/reusable/truncateString";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";
import { PlayCircle, BookOpenText, FilePdf, FileDoc } from "@phosphor-icons/react";
import { useRouter } from "@tanstack/react-router";
import { Slide, useSlides } from "@/hooks/study-library/use-slides";
import { DashboardLoader } from "@/components/core/dashboard-loader";

export const getIcon = (slide: Slide, size?: string): React.ReactNode => {
  const sizeClass = `size-${size ? size : "6"}`;
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
    <div className="flex w-full flex-col items-center gap-6 text-neutral-600">
      {slides?.map((slide: Slide) => (
        <div
          key={slide.id}
          onClick={() => setActiveItem(slide)} // Pass the entire item
          className={`flex w-full cursor-pointer justify-between items-center gap-3 rounded-xl px-4 py-2 ${
            slide.id === activeItem?.id
              ? "border border-neutral-200 bg-white text-primary-500"
              : "hover:border hover:border-neutral-200 hover:bg-white hover:text-primary-500"
          }`}
          title={slide.title || ""}
        >
          <div className="flex items-center gap-3">
            <p className={`${slide.percentage_completed>=80 && "text-success-600"}`}>{getIcon(slide)}</p>
            <p
              className={`flex-1 text-subtitle ${open ? "visible" : "hidden"} text-body`}
            >
              {truncateString(slide.title || "", 18)}
            </p>
          </div>
          {slide.percentage_completed != null && (
            <p className="text-body">{slide.percentage_completed>100 ? 100: slide.percentage_completed.toFixed(2)}%</p>
          )}
        </div>
      ))}
    </div>
  );
};
