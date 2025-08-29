import React, { useEffect, useState } from "react";
import { ChevronRight, Play, BookOpen, Users, Clock } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import LocalStorageUtils from "@/utils/localstorage";
import { Star } from "phosphor-react";
import { ProgressBar } from "@/components/ui/custom-progress-bar";
import { toTitleCase } from "@/lib/utils";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils.ts";
import { ContentTerms, RoleTerms, SystemTerms } from "@/types/naming-settings";

interface Instructor {
    id: string;
    full_name: string;
    image_url?: string;
}

interface CourseCardProps {
    courseId: string;
    package_name: string;
    level_name: string;

    instructors: Instructor[];
    rating: number;
    description: string;
    percentageCompleted: number;
    tags: string[];
    studentCount?: number;
    previewImageUrl: string;
    selectedTab: string;
    readTimeInMinutes: number;
}

const fallbackInstructorImage =
    "https://api.dicebear.com/7.x/thumbs/svg?seed=anon";

const CourseCard: React.FC<CourseCardProps> = ({
    courseId,
    package_name,
    level_name,
    instructors,
    rating,
    description,
    percentageCompleted,
    tags,
    studentCount,
    previewImageUrl,
    selectedTab,
    readTimeInMinutes,
}) => {
    const [courseImageUrl, setCourseImageUrl] = useState<string | null>(null);
    const [loadingImage, setLoadingImage] = useState(true);

    const instructor = instructors[0];
    const instructorName = instructor?.full_name || "Unknown Instructor";
    const instructorImage = instructor?.image_url || fallbackInstructorImage;

    const ratingValue = rating || 0;

    const router = useRouter();
    const handleViewCoureseDetails = (id: string) => {

        try {
            // Persist percentage locally as a fallback for details page
            const key = `COURSE_PCT_${id}`;
            LocalStorageUtils.set(key, { value: percentageCompleted, ts: Date.now() });
        } catch (e) {
            // Failed to save percentage to localStorage
        }
        router.navigate({
            to: "/study-library/courses/course-details",
            search: { courseId: id, selectedTab: selectedTab, percentageCompleted },
        });
    };

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            if (!previewImageUrl) {
                if (isMounted) {
                    setLoadingImage(false);
                    setCourseImageUrl((prev) => (prev === null ? prev : null));
                }
                return;
            }

            setLoadingImage(true);
            try {
                const url = await getPublicUrlWithoutLogin(previewImageUrl);
                if (isMounted) {
                    const next = url || null;
                    setCourseImageUrl((prev) => (prev === next ? prev : next));
                }
            } catch (error) {
                if (isMounted) {
                    setCourseImageUrl((prev) => (prev === null ? prev : null));
                }
            } finally {
                if (isMounted) {
                    setLoadingImage(false);
                }
            }
        };

        load();
        return () => {
            isMounted = false;
        };
    }, [previewImageUrl]);

    const getLevelColor = () => {
        switch (level_name.toLowerCase()) {
            case "beginner":
                return "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200";
            case "intermediate":
                return "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200";
            case "advanced":
                return "bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200";
            default:
                return "bg-primary-100 text-primary-700 border-primary-200 hover:bg-primary-200";
        }
    };

    return (
        <div className="group relative overflow-hidden bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-md sm:rounded-lg shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col w-full max-w-full animate-fade-in-up">
            {/* Background gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md sm:rounded-lg"></div>

            {/* Floating orb effects */}
            <div className="absolute top-0 right-0 w-12 h-12 sm:w-16 sm:h-16 bg-primary-100/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-y-2 translate-x-4"></div>

            {/* Image Container - Only show if there's an image or loading */}
            {(loadingImage || courseImageUrl) && (
                <div className="relative w-full h-40 sm:h-48 lg:h-52 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-neutral-800 dark:to-neutral-700 flex items-center justify-center overflow-hidden rounded-t-md sm:rounded-t-lg">
                    {/* Play overlay on hover */}
                    {courseImageUrl && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                            <div className="bg-white dark:bg-neutral-800 rounded-full p-2 sm:p-3 transform scale-0 group-hover:scale-100 transition-transform duration-200">
                                <Play
                                    size={20}
                                    className="text-primary-600 ml-0.5 sm:ml-1"
                                />
                            </div>
                        </div>
                    )}

                    {loadingImage ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                            <div className="flex flex-col items-center space-y-2 sm:space-y-3">
                                <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                                <div className="text-xs text-gray-500 dark:text-neutral-400 font-medium">
                                    Loading content...
                                </div>
                            </div>
                        </div>
                    ) : courseImageUrl ? (
                        <img
                            src={courseImageUrl}
                            alt={package_name}
                            loading="lazy"
                            className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                        />
                    ) : null}
                </div>
            )}

            <div className="relative p-3 sm:p-4 lg:p-5 flex flex-col flex-grow">
                {/* Header with title and level badge */}
                <div className="flex justify-between items-start mb-2 sm:mb-3 lg:mb-4 gap-2">
                    <h3
                        className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 dark:text-neutral-100 leading-tight group-hover:text-primary-600 dark:group-hover:text-neutral-100 transition-colors duration-300 line-clamp-2 flex-1 min-w-0"
                        title={toTitleCase(package_name)}
                    >
                        {toTitleCase(package_name)}
                    </h3>
                    <span
                        className={`text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-md shadow-sm border ${getLevelColor()} flex-shrink-0 transition-all duration-200`}
                    >
                        {toTitleCase(level_name)}
                    </span>
                </div>

                {/* Description */}
                <div
                    className="text-sm text-gray-600 dark:text-neutral-300 mb-3 sm:mb-4 lg:mb-5 flex-grow line-clamp-3 leading-relaxed"
                    dangerouslySetInnerHTML={{
                        __html: description || "",
                    }}
                />

                {/* Instructor section */}
                {instructors.length > 0 && (
                    <div className="flex items-center mb-3 sm:mb-4 lg:mb-5 p-2 sm:p-3 bg-gray-50/80 dark:bg-neutral-800/60 rounded-md sm:rounded-lg border border-gray-100 dark:border-neutral-700 group-hover:bg-primary-50/50 transition-colors duration-200">
                        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                            <div className="relative flex-shrink-0">
                                <img
                                    src={instructorImage}
                                    alt={instructorName}
                                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-white shadow-sm"
                                />
                                <div className="absolute -bottom-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-success-500 rounded-full border-2 border-white"></div>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">
                                    {getTerminology(
                                        RoleTerms.Teacher,
                                        SystemTerms.Teacher
                                    )}
                                </p>
                                <div className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-neutral-200 truncate">
                                    {instructors.map((instructor, index) => (
                                        <span key={instructor.id}>
                                            {instructor.full_name}
                                            {index !== instructors.length - 1
                                                ? ", "
                                                : ""}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <Users
                            size={14}
                            className="text-primary-500 flex-shrink-0 sm:w-4 sm:h-4"
                        />
                    </div>
                )}

                {/* Tags section */}
                <div className="mb-3 sm:mb-4 lg:mb-5 min-h-[28px] sm:min-h-[32px]">
                    {tags && tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {tags.slice(0, 3).map((tag) => (
                                <span
                                    key={tag}
                                    className="text-xs bg-primary-100 text-primary-700 border border-primary-200 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md font-medium"
                                >
                                    {tag}
                                </span>
                            ))}
                            {tags && tags.length > 3 && (
                                <span className="text-xs bg-neutral-100 text-neutral-700 border border-neutral-200 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md font-medium">
                                    +{tags.length - 3} more
                                </span>
                            )}
                        </div>
                    ) : (
                        <span className="text-xs text-gray-400 italic">
                            No tags available
                        </span>
                    )}
                </div>

                {/* Rating and stats section */}
                <div className="flex items-center justify-between mb-3 sm:mb-4 lg:mb-5 p-2 sm:p-3 bg-gradient-to-r from-gray-50/80 to-primary-50/30 rounded-md sm:rounded-lg border border-gray-100 group-hover:from-primary-50/80 group-hover:to-primary-100/50 transition-all duration-200">
                    <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                            {[...Array(5)].map((_, i) => (
                                <Star
                                    key={i}
                                    size={14}
                                    weight="fill"
                                    className={`${
                                        i < Math.floor(ratingValue)
                                            ? "text-yellow-400"
                                            : "text-gray-300"
                                    } transition-colors duration-300 sm:w-4 sm:h-4`}
                                />
                            ))}
                        </div>
                        <span className="text-sm font-bold text-gray-900">
                            {ratingValue.toFixed(1)}
                        </span>
                    </div>

                    <div className="flex items-center space-x-2 sm:space-x-4 text-xs text-gray-600 dark:text-neutral-300">
                        {studentCount !== undefined && (
                            <div className="flex items-center space-x-1">
                                <Users
                                    size={12}
                                    className="sm:w-3.5 sm:h-3.5"
                                />
                                <span className="font-medium">
                                    {studentCount}
                                </span>
                            </div>
                        )}
                        {readTimeInMinutes && (
                            <div className="flex items-center space-x-1">
                                <Clock
                                    size={12}
                                    className="sm:w-3.5 sm:h-3.5"
                                />
                                <span className="font-medium">
                                    {readTimeInMinutes >= 60
                                        ? `${Math.floor(readTimeInMinutes / 60)}h ${readTimeInMinutes % 60}m`
                                        : `${readTimeInMinutes % 60}m`}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {selectedTab === "PROGRESS" && (
                    <div className="mb-3 sm:mb-4 -mt-1 flex items-center gap-2">
                        <ProgressBar value={percentageCompleted} />
                        <span className="text-sm">
                            {percentageCompleted
                                ? percentageCompleted.toFixed(2)
                                : 0}
                            %
                        </span>
                    </div>
                )}

                {/* Action button */}
                <button
                    className="relative mt-auto w-full overflow-hidden bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white py-2.5 sm:py-3 px-3 sm:px-4 rounded-md sm:rounded-lg font-semibold text-sm transition-all duration-200 group/btn flex items-center justify-center space-x-2 shadow-md"
                    onClick={() => handleViewCoureseDetails(courseId)}
                >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 -skew-x-12 -translate-x-full group-hover/btn:translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700"></div>

                    <BookOpen
                        size={14}
                        className="transition-transform duration-300 group-hover/btn:scale-110 sm:w-4 sm:h-4"
                    />
                    <span>
                        View{" "}
                        {getTerminology(
                            ContentTerms.Course,
                            SystemTerms.Course
                        )}
                    </span>
                    <ChevronRight
                        size={14}
                        className="transition-transform duration-300 group-hover/btn:translate-x-1 sm:w-4 sm:h-4"
                    />
                </button>

                {/* Progress indicator */}
                <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-primary-400 to-primary-600 w-0 group-hover:w-full transition-all duration-500 ease-out rounded-b-md sm:rounded-b-lg"></div>
            </div>
        </div>
    );
};

export default CourseCard;
