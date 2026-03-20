import { cn, toTitleCase } from "@/lib/utils";
import { VideoPlayer } from "../components/media/video-player";
import { Badge } from "@/components/ui/badge";

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

export const CourseHeader = ({ courseData, showConfetti = false }: CourseHeaderProps) => {
    return (
        <div className="relative w-full min-h-[220px] sm:min-h-[260px] lg:min-h-[340px] overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5 bg-background">
            {/* Background Image or Neutral Fallback */}
            {!courseData.courseBannerMediaId ? (
                <div className="absolute inset-0 z-0 bg-muted" />
            ) : (
                <div className="absolute inset-0 z-0">
                    <img
                        src={courseData.courseBannerMediaId}
                        alt="Course Banner"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.currentTarget.style.display = "none";
                            e.currentTarget.parentElement?.classList.add(
                                "bg-muted"
                            );
                        }}
                    />
                </div>
            )}

            {/* Neutral overlay for readability */}
            <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/60 via-black/40 to-black/30 backdrop-blur-[1px]" />

            {/* Optional celebratory overlay */}
            {showConfetti && (
                <div className="absolute inset-0 z-30 pointer-events-none">
                    <div className="absolute inset-0 bg-white/10 animate-pulse" />
                </div>
            )}

            {/* Content Container */}
            <div className="relative z-20 h-full">
                <div className="h-full flex items-center py-6 sm:py-8">
                    {courseData.courseMediaId ? (
                        // Layout with video - 3/5 and 2/5 split
                        <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8 items-center container mx-auto px-4 sm:px-6 lg:px-8">
                            {/* Left side - Course Info (3/5) */}
                            <div className="lg:col-span-3 animate-fade-in-up">
                                {!courseData.title ? (
                                    <div className="space-y-4">
                                        <div className="h-6 w-24 animate-pulse rounded bg-white/20" />
                                        <div className="h-10 w-4/5 animate-pulse rounded bg-white/20" />
                                        <div className="space-y-2">
                                            <div className="h-4 w-full animate-pulse rounded bg-white/20" />
                                            <div className="h-4 w-3/4 animate-pulse rounded bg-white/20" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className={cn(
                                        "bg-background/95 backdrop-blur-md rounded-xl p-6 shadow-sm border border-border/50 text-foreground text-left ring-1 ring-black/5",
                                        // Vibrant Styles - Flat Pastel
                                        "[.ui-vibrant_&]:bg-slate-50/95 dark:[.ui-vibrant_&]:bg-slate-900/95",
                                        "[.ui-vibrant_&]:border-slate-200/50 dark:[.ui-vibrant_&]:border-slate-800/30",
                                        "[.ui-vibrant_&]:shadow-md"
                                    )}>
                                        {/* Tags */}
                                        <div className="mb-4 flex flex-wrap gap-2">
                                            {courseData.tags.map((tag, index) => (
                                                <Badge
                                                    key={index}
                                                    variant="secondary"
                                                    className={cn(
                                                        "uppercase tracking-wide text-[10px] sm:text-xs font-semibold px-2.5 py-1",
                                                        // Vibrant Styles - Flat Pastel
                                                        "[.ui-vibrant_&]:bg-sky-100/50 [.ui-vibrant_&]:text-sky-700 dark:[.ui-vibrant_&]:bg-sky-900/30 dark:[.ui-vibrant_&]:text-sky-300",
                                                        "[.ui-vibrant_&]:border-sky-200/50 dark:[.ui-vibrant_&]:border-sky-800/30 [.ui-vibrant_&]:border"
                                                    )}
                                                >
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>

                                        {/* Title */}
                                        <h1 className={cn(
                                            "text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 leading-tight tracking-tight",
                                            // Vibrant Styles - Flat Pastel
                                            "[.ui-vibrant_&]:text-slate-900 dark:[.ui-vibrant_&]:text-slate-50"
                                        )}>
                                            {toTitleCase(courseData.title)}
                                        </h1>

                                        {/* Description */}
                                        <div
                                            className="text-sm sm:text-base text-muted-foreground leading-relaxed line-clamp-3"
                                            dangerouslySetInnerHTML={{
                                                __html: courseData.description || "",
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Right side - Video Player (2/5) */}
                            <div
                                className="lg:col-span-2 animate-fade-in-up"
                                style={{ animationDelay: "0.2s" }}
                            >
                                <div className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-black/50 aspect-video">
                                    <VideoPlayer src={courseData.courseMediaId} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Layout without video - full width
                        <div className="w-full animate-fade-in-up container mx-auto px-4 sm:px-6 lg:px-8">
                            {!courseData.title ? (
                                <div className="space-y-4 max-w-3xl">
                                    <div className="h-6 w-32 animate-pulse rounded bg-white/20" />
                                    <div className="h-12 w-3/4 animate-pulse rounded bg-white/20" />
                                    <div className="space-y-2">
                                        <div className="h-4 w-full animate-pulse rounded bg-white/20" />
                                        <div className="h-4 w-2/3 animate-pulse rounded bg-white/20" />
                                    </div>
                                </div>
                            ) : (
                                <div className="max-w-5xl">
                                    <div className="bg-background/95 backdrop-blur-md rounded-xl p-6 sm:p-8 shadow-sm border border-border/50 text-foreground text-left ring-1 ring-black/5">
                                        {/* Tags */}
                                        <div className="mb-4 flex flex-wrap gap-2">
                                            {courseData.tags.map((tag, index) => (
                                                <Badge
                                                    key={index}
                                                    variant="secondary"
                                                    className="uppercase tracking-wide text-[10px] sm:text-xs font-semibold px-2.5 py-1"
                                                >
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>

                                        {/* Title */}
                                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 leading-tight tracking-tight">
                                            {toTitleCase(courseData.title)}
                                        </h1>

                                        {/* Description */}
                                        <div
                                            className="text-base sm:text-lg text-muted-foreground leading-relaxed line-clamp-4 max-w-3xl"
                                            dangerouslySetInnerHTML={{
                                                __html: courseData.description || "",
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};