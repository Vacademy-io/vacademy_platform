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
        <div className="relative w-full h-[200px] sm:h-[250px] lg:h-[300px] overflow-hidden rounded-lg shadow-lg">
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
            <div className="absolute inset-0 z-10 bg-black/35 dark:bg-black/45" />

            {/* Optional celebratory overlay (kept subtle, no gradients) */}
            {showConfetti && (
                <div className="absolute inset-0 z-30 pointer-events-none">
                    <div className="absolute inset-0 bg-white/10 animate-pulse" />
                </div>
            )}

            {/* Content Container */}
            <div className="relative z-20 h-full">
                <div className="h-full flex items-center">
                    {courseData.courseMediaId ? (
                        // Layout with video - 3/5 and 2/5 split
                        <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-3 lg:gap-4 items-center">
                            {/* Left side - Course Info (3/5) */}
                            <div className="lg:col-span-3 animate-fade-in-up">
                                {!courseData.title ? (
                                    <div className="space-y-3">
                                        <div className="h-5 w-20 animate-pulse rounded bg-white/30 dark:bg-neutral-700/50" />
                                        <div className="h-6 sm:h-8 w-3/4 animate-pulse rounded bg-white/30 dark:bg-neutral-700/50" />
                                        <div className="h-3 w-full animate-pulse rounded bg-white/30 dark:bg-neutral-700/50" />
                                        <div className="h-3 w-2/3 animate-pulse rounded bg-white/30 dark:bg-neutral-700/50" />
                                    </div>
                                ) : (
                                    <div className="bg-white/80 dark:bg-neutral-900/70 backdrop-blur-sm rounded-lg p-3 sm:p-4 shadow-sm text-neutral-900 dark:text-neutral-100 text-left">
                                        {/* Tags */}
                                        <div className="mb-1.5 sm:mb-2 flex flex-wrap gap-1.5">
                                            {courseData.tags.map((tag, index) => (
                                                <span
                                                    key={index}
                                                    className="bg-white/60 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 px-2.5 py-1 rounded-md text-xs font-medium"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Title */}
                                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1.5 sm:mb-2 leading-tight">
                                            {toTitleCase(courseData.title)}
                                        </h1>

                                        {/* Description */}
                                        <div
                                            className="text-sm sm:text-base opacity-90 leading-relaxed line-clamp-2"
                                            dangerouslySetInnerHTML={{
                                                __html: courseData.description || "",
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Right side - Video Player (2/5) */}
                            <div
                                className="hidden lg:block lg:col-span-2 animate-fade-in-up"
                                style={{ animationDelay: "0.2s" }}
                            >
                                <VideoPlayer src={courseData.courseMediaId} />
                            </div>
                        </div>
                    ) : (
                        // Layout without video - full width
                        <div className="w-full animate-fade-in-up">
                            {!courseData.title ? (
                                <div className="space-y-3 max-w-3xl">
                                    <div className="h-6 w-32 animate-pulse rounded bg-white/30 dark:bg-neutral-700/50" />
                                    <div className="h-8 sm:h-10 w-3/4 animate-pulse rounded bg-white/30 dark:bg-neutral-700/50" />
                                    <div className="h-4 w-full animate-pulse rounded bg-white/30 dark:bg-neutral-700/50" />
                                    <div className="h-4 w-2/3 animate-pulse rounded bg-white/30 dark:bg-neutral-700/50" />
                                </div>
                            ) : (
                                <div className="max-w-4xl">
                                    <div className="bg-white/85 dark:bg-neutral-900/70 backdrop-blur-sm rounded-lg px-4 py-3 sm:px-6 sm:py-4 shadow-sm text-neutral-900 dark:text-neutral-100 text-left">
                                        {/* Tags */}
                                        <div className="mb-2 sm:mb-3 flex flex-wrap gap-2">
                                            {courseData.tags.map((tag, index) => (
                                                <span
                                                    key={index}
                                                    className="bg-white/60 dark:bg-neutral-800/60 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 px-3 py-1.5 rounded-md text-sm font-medium"
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
                                            className="text-base sm:text-lg opacity-90 leading-relaxed line-clamp-3 max-w-3xl"
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