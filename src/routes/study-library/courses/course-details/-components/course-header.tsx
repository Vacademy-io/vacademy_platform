import { toTitleCase } from "@/lib/utils";
import { VideoPlayer } from "../components/media/video-player";

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
        <div className="relative w-full min-h-[220px] sm:min-h-[260px] lg:min-h-[340px] overflow-hidden rounded-xl shadow-lg ring-1 ring-black/5">
            {/* Background Image or Neutral Fallback */}
            {!courseData.courseBannerMediaId ? (
                <div className="absolute inset-0 z-0 bg-neutral-200 dark:bg-neutral-800" />
            ) : (
                <div className="absolute inset-0 z-0">
                    <img
                        src={courseData.courseBannerMediaId}
                        alt="Course Banner"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.currentTarget.style.display = "none";
                            e.currentTarget.parentElement?.classList.add(
                                "bg-neutral-200",
                                "dark:bg-neutral-800"
                            );
                        }}
                    />
                </div>
            )}

            {/* Neutral overlay for readability */}
            <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/55 via-black/35 to-black/25 dark:from-black/65 dark:via-black/45 dark:to-black/35 backdrop-blur-[1px]" />

            {/* Optional celebratory overlay (kept subtle, no gradients) */}
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
                                    <div className="space-y-3">
                                        <div className="h-5 w-24 animate-pulse rounded bg-white/30 dark:bg-neutral-700/50" />
                                        <div className="h-7 sm:h-9 w-4/5 animate-pulse rounded bg-white/30 dark:bg-neutral-700/50" />
                                        <div className="h-3.5 w-full animate-pulse rounded bg-white/30 dark:bg-neutral-700/50" />
                                        <div className="h-3.5 w-3/4 animate-pulse rounded bg-white/30 dark:bg-neutral-700/50" />
                                    </div>
                                ) : (
                                    <div className="bg-white/85 dark:bg-neutral-900/70 backdrop-blur-sm rounded-xl p-4 sm:p-6 shadow-sm text-neutral-900 dark:text-neutral-100 text-left ring-1 ring-black/5">
                                        {/* Tags */}
                                        <div className="mb-2 sm:mb-3 flex flex-wrap gap-2">
                                            {courseData.tags.map((tag, index) => (
                                                <span
                                                    key={index}
                                                    className="bg-white/70 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-medium tracking-wide uppercase"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Title */}
                                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 sm:mb-3 leading-tight">
                                            {toTitleCase(courseData.title)}
                                        </h1>

                                        {/* Description */}
                                        <div
                                            className="text-sm sm:text-base opacity-90 leading-relaxed line-clamp-3"
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
                                <div className="rounded-xl overflow-hidden ring-1 ring-white/10 bg-black/30 aspect-video">
                                    <VideoPlayer src={courseData.courseMediaId} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Layout without video - full width
                        <div className="w-full animate-fade-in-up container mx-auto px-4 sm:px-6 lg:px-8">
                            {!courseData.title ? (
                                <div className="space-y-3 max-w-3xl">
                                    <div className="h-6 w-32 animate-pulse rounded bg-white/30 dark:bg-neutral-700/50" />
                                    <div className="h-8 sm:h-10 w-3/4 animate-pulse rounded bg-white/30 dark:bg-neutral-700/50" />
                                    <div className="h-4 w-full animate-pulse rounded bg-white/30 dark:bg-neutral-700/50" />
                                    <div className="h-4 w-2/3 animate-pulse rounded bg-white/30 dark:bg-neutral-700/50" />
                                </div>
                            ) : (
                                <div className="max-w-5xl">
                                    <div className="bg-white/85 dark:bg-neutral-900/70 backdrop-blur-sm rounded-xl px-5 py-4 sm:px-8 sm:py-6 shadow-sm text-neutral-900 dark:text-neutral-100 text-left ring-1 ring-black/5">
                                        {/* Tags */}
                                        <div className="mb-2 sm:mb-4 flex flex-wrap gap-2">
                                            {courseData.tags.map((tag, index) => (
                                                <span
                                                    key={index}
                                                    className="bg-white/70 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium tracking-wide uppercase"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Title */}
                                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2 sm:mb-4 leading-tight">
                                            {toTitleCase(courseData.title)}
                                        </h1>

                                        {/* Description */}
                                        <div
                                            className="text-base sm:text-lg opacity-90 leading-relaxed line-clamp-4 max-w-3xl"
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