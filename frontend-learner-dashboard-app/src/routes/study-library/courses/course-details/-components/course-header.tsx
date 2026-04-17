import { useEffect, useRef, useState } from "react";
import { cn, toTitleCase } from "@/lib/utils";
import { VideoPlayer } from "../components/media/video-player";
import { Badge } from "@/components/ui/badge";
import { playIllustrations } from "@/assets/play-illustrations";

interface CourseHeaderProps {
  courseData: {
    title: string;
    description: string;
    tags: string[];
    courseBannerMediaId: string;
    courseMediaId: string;
  };
  showConfetti?: boolean;
}

export const CourseHeader = ({
  courseData,
  showConfetti = false,
}: CourseHeaderProps) => {
  const isImageUrl = (url: string) =>
    /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?.*)?$/i.test(url);
  const hasVideo =
    !!courseData.courseMediaId && !isImageUrl(courseData.courseMediaId);
  const hasBanner =
    !!courseData.courseBannerMediaId ||
    (!!courseData.courseMediaId && isImageUrl(courseData.courseMediaId));
  const bannerSrc = courseData.courseBannerMediaId ||
    (isImageUrl(courseData.courseMediaId) ? courseData.courseMediaId : "");
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [isDescClamped, setIsDescClamped] = useState(false);
  const descRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    setIsDescClamped(el.scrollHeight > el.clientHeight);
  }, [courseData.description]);

  return (
    <div className="relative w-full bg-background">
      {/* Optional celebratory overlay */}
      {showConfetti && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <div className="absolute inset-0 animate-pulse bg-primary-100/10" />
        </div>
      )}

      <div className="px-2 py-3 sm:px-0 lg:py-4">
        {!courseData.title ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-center">
            <div className="space-y-3 animate-fade-in-up">
              <div className="h-5 w-24 animate-pulse rounded bg-muted" />
              <div className="h-10 w-4/5 animate-pulse rounded bg-muted" />
              <div className="space-y-2">
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              </div>
            </div>
            <div className="hidden lg:block h-48 w-full rounded-xl bg-muted animate-pulse" />
          </div>
        ) : (
          <div
            className={cn(
              "grid grid-cols-1 gap-6 items-center",
              (hasVideo || hasBanner) && "lg:grid-cols-2 lg:gap-10",
            )}
          >
            {/* Text Content */}
            <div className="animate-fade-in-up space-y-3 sm:space-y-4">
              {/* Tags */}
              {courseData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {courseData.tags.map((tag, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className={cn(
                        "uppercase tracking-wide text-[10px] sm:text-xs font-semibold px-2.5 py-1",
                        // Vibrant Styles - Flat Pastel
                        "[.ui-vibrant_&]:bg-sky-100/50 [.ui-vibrant_&]:text-sky-700 dark:[.ui-vibrant_&]:bg-sky-900/30 dark:[.ui-vibrant_&]:text-sky-300",
                        "[.ui-vibrant_&]:border-sky-200/50 dark:[.ui-vibrant_&]:border-sky-800/30 [.ui-vibrant_&]:border",
                        // Play Styles
                        "[.ui-play_&]:rounded-full [.ui-play_&]:font-bold [.ui-play_&]:border-2",
                      )}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Title */}
              <h1
                className={cn(
                  "text-xl sm:text-2xl lg:text-3xl font-bold leading-tight tracking-tight text-foreground",
                  "[.ui-vibrant_&]:text-slate-900 dark:[.ui-vibrant_&]:text-slate-50",
                )}
              >
                {courseData.title}
              </h1>

              {/* Description */}
              {courseData.description && (
                <div>
                  <div
                    ref={descRef}
                    className={cn(
                      "text-sm sm:text-base text-muted-foreground leading-relaxed",
                      !isDescExpanded && "line-clamp-4"
                    )}
                    dangerouslySetInnerHTML={{ __html: courseData.description }}
                  />
                  {(isDescClamped || isDescExpanded) && (
                    <button
                      onClick={() => setIsDescExpanded((prev) => !prev)}
                      className="mt-1 text-sm font-medium text-primary hover:underline focus:outline-none"
                    >
                      {isDescExpanded ? "View less" : "View more"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Media Section — Video or Banner on right */}
            {hasVideo ? (
              <div
                className="w-full animate-fade-in-up"
                style={{ animationDelay: "0.15s" }}
              >
                <div className="w-full overflow-hidden rounded-2xl bg-black shadow-sm ring-1 ring-black/10 aspect-video">
                  <VideoPlayer src={courseData.courseMediaId} />
                </div>
              </div>
            ) : hasBanner ? (
              <div
                className="w-full animate-fade-in-up"
                style={{ animationDelay: "0.15s" }}
              >
                <div className="relative w-full overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5 border border-border/50">
                  <img
                    src={bannerSrc}
                    alt={toTitleCase(courseData.title || "Course Banner")}
                    className="w-full h-[180px] sm:h-[220px] lg:h-[260px] object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <playIllustrations.Learning className="pointer-events-none absolute bottom-2 right-2 z-20 hidden h-28 w-auto text-primary-300 opacity-30 [.ui-play_&]:!block" />
    </div>
  );
};
