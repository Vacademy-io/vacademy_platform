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
            {/* Background Image or Gradient */}
            {!courseData.courseBannerMediaId ? (
                <div className="absolute inset-0 z-0 bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700" />
            ) : (
                <div className="absolute inset-0 z-0">
                    <img
                        src={courseData.courseBannerMediaId}
                        alt="Course Banner"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.currentTarget.style.display = "none";
                            e.currentTarget.parentElement?.classList.add(
                                "bg-gradient-to-br",
                                "from-primary-500",
                                "via-primary-600",
                                "to-primary-700"
                            );
                        }}
                    />
                </div>
            )}

            {/* Enhanced gradient overlay */}
            <div className="absolute inset-0 z-10 bg-gradient-to-br from-black/20 via-black/10 to-transparent dark:from-black/50 dark:via-black/40 dark:to-transparent" />

            {/* Floating orb effects */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-3xl opacity-70 -translate-y-2 translate-x-6"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary-300/20 rounded-full blur-3xl opacity-50 translate-y-6 -translate-x-6"></div>

            {/* Confetti overlay */}
            {showConfetti && (
                <div className="absolute inset-0 z-30 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 via-orange-400/20 to-red-400/20 animate-pulse"></div>
                </div>
            )}

            {/* Content Container */}
            <div className="relative z-20 h-full">
                <div className="max-w-7xl mx-auto px-2 sm:px-3 lg:px-4 h-full flex items-center">
                    {courseData.courseMediaId ? (
                        // Layout with video - 3/5 and 2/5 split
                        <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-3 lg:gap-4 items-center">
                            {/* Left side - Course Info (3/5) */}
                            <div className="lg:col-span-3 text-white animate-fade-in-up">
                                {!courseData.title ? (
                                    <div className="space-y-3">
                                        <div className="h-5 w-20 animate-pulse rounded bg-white/20" />
                                        <div className="h-6 sm:h-8 w-3/4 animate-pulse rounded bg-white/20" />
                                        <div className="h-3 w-full animate-pulse rounded bg-white/20" />
                                        <div className="h-3 w-2/3 animate-pulse rounded bg-white/20" />
                                    </div>
                                ) : (
                                    <>
                                        {/* Tags */}
                                        <div className="mb-1.5 sm:mb-2 flex flex-wrap gap-1.5">
                                            {courseData.tags.map((tag, index) => (
                                                <span
                                                    key={index}
                                                    className="bg-white/20 border border-white/30 text-white px-2.5 py-1 rounded-md text-xs font-medium hover:bg-white/30 transition-all duration-200"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Title */}
                                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1.5 sm:mb-2 leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                                            {toTitleCase(courseData.title)}
                                        </h1>

                                        {/* Description */}
                                        <div
                                            className="text-sm sm:text-base opacity-90 leading-relaxed line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                                            dangerouslySetInnerHTML={{
                                                __html: courseData.description || "",
                                            }}
                                        />
                                    </>
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
                        <div className="w-full text-center text-white animate-fade-in-up">
                            {!courseData.title ? (
                                <div className="space-y-3 max-w-3xl mx-auto">
                                    <div className="h-6 w-32 animate-pulse rounded bg-white/20 mx-auto" />
                                    <div className="h-8 sm:h-10 w-3/4 animate-pulse rounded bg-white/20 mx-auto" />
                                    <div className="h-4 w-full animate-pulse rounded bg-white/20" />
                                    <div className="h-4 w-2/3 animate-pulse rounded bg-white/20 mx-auto" />
                                </div>
                            ) : (
                                <div className="max-w-4xl mx-auto">
                                    {/* Tags */}
                                    <div className="mb-2 sm:mb-3 flex flex-wrap gap-2 justify-center">
                                        {courseData.tags.map((tag, index) => (
                                            <span
                                                key={index}
                                                className="bg-white/20 border border-white/30 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-white/30 transition-all duration-200"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Title */}
                                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 sm:mb-3 leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                                        {toTitleCase(courseData.title)}
                                    </h1>

                                    {/* Description */}
                                    <div
                                        className="text-base sm:text-lg opacity-90 leading-relaxed line-clamp-3 max-w-3xl mx-auto"
                                        dangerouslySetInnerHTML={{
                                            __html: courseData.description || "",
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};