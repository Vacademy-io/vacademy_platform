import React, { useEffect, useState } from "react";
import { StarIcon, ChevronRight, Play, BookOpen, Users, Clock } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { Star, Trophy, Medal } from 'phosphor-react';

interface Instructor {
    id: string;
    full_name: string;
    image_url?: string;
}

interface CourseCardProps {
    courseId: string;
    package_name: string;
    level_name: string;
    thumbnailUrl: string | null;
    instructors: Instructor[];
    rating: number;
    description: string;
    tags: string[];
    studentCount?: number;
    previewImageUrl: string;
}

const fallbackInstructorImage =
    "https://api.dicebear.com/7.x/thumbs/svg?seed=anon";

const CourseCard: React.FC<CourseCardProps> = ({
    courseId,
    package_name,
    level_name,
    thumbnailUrl,
    instructors,
    rating,
    description,
    tags,
    studentCount,
    previewImageUrl,
}) => {
    const [courseImageUrl, setCourseImageUrl] = useState<string | null>(null);
    const [loadingImage, setLoadingImage] = useState(true);

    const instructor = instructors[0];
    const instructorName = instructor?.full_name || "Unknown Instructor";
    const instructorImage = instructor?.image_url || fallbackInstructorImage;

    const ratingValue = rating || 0;

    const router = useRouter();
    const handleViewCoureseDetails = (id: string) => {
        // console.log("course-detailsIdis",id);
        router.navigate({
            to: "/study-library/courses/course-details",
            search: { courseId: id },
        });
    };

    const loadImage = async () => {
        if (!previewImageUrl) {
            setLoadingImage(false);
            setCourseImageUrl(null);
            return;
        }
        
        setLoadingImage(true);
        try {
            const url = await getPublicUrlWithoutLogin(previewImageUrl);
            setCourseImageUrl(url || null);
        } catch (error) {
            console.error("Error fetching course image:", error);
            setCourseImageUrl(null);
        } finally {
            setLoadingImage(false);
        }
    };

    useEffect(() => {
        loadImage();
    }, [previewImageUrl]);

    const getLevelColor = () => {
        switch (level_name.toLowerCase()) {
            case "beginner":
                return "bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200 hover:from-emerald-100 hover:to-emerald-200";
            case "intermediate":
                return "bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 border-amber-200 hover:from-amber-100 hover:to-amber-200";
            case "advanced":
                return "bg-gradient-to-r from-rose-50 to-rose-100 text-rose-700 border-rose-200 hover:from-rose-100 hover:to-rose-200";
            default:
                return "bg-gradient-to-r from-primary-50 to-primary-100 text-primary-700 border-primary-200 hover:from-primary-100 hover:to-primary-200";
        }
    };

    return (
        <div className="group relative overflow-hidden bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-2xl shadow-sm hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] flex flex-col w-full max-w-full animate-fade-in-up">
            {/* Background gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"></div>
            
            {/* Floating orb effects */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary-100/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-y-2 translate-x-4"></div>
            
            {/* Image Container - Only show if there's an image or loading */}
            {(loadingImage || courseImageUrl) && (
                <div className="relative w-full h-48 sm:h-52 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden rounded-t-2xl">
                    {/* Play overlay on hover */}
                    {courseImageUrl && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <div className="bg-white/90 backdrop-blur-sm rounded-full p-3 transform scale-0 group-hover:scale-100 transition-transform duration-300">
                                <Play size={24} className="text-primary-600 ml-1" />
                            </div>
                        </div>
                    )}

                    {loadingImage ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                            <div className="flex flex-col items-center space-y-3">
                                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                                <div className="text-xs text-gray-500 font-medium">Loading content...</div>
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

            <div className="relative p-4 sm:p-6 flex flex-col flex-grow">
                {/* Header with title and level badge */}
                <div className="flex justify-between items-start mb-3 sm:mb-4">
                    <h3
                        className="text-lg sm:text-xl font-bold text-gray-900 leading-tight group-hover:text-primary-600 transition-colors duration-300 line-clamp-2 flex-1 mr-3"
                        title={package_name}
                    >
                        {package_name}
                    </h3>
                    <span
                        className={`text-xs font-bold px-3 py-1.5 rounded-full shadow-sm border ${getLevelColor()} flex-shrink-0 transition-all duration-300 group-hover:scale-105`}
                    >
                        {level_name}
                    </span>
                </div>

                {/* Description */}
                <div
                    className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-5 flex-grow line-clamp-3 leading-relaxed"
                    dangerouslySetInnerHTML={{
                        __html: description || "",
                    }}
                />

                {/* Instructor section */}
                {instructors.length > 0 && (
                    <div className="flex items-center mb-4 sm:mb-5 p-3 bg-gray-50/80 rounded-xl border border-gray-100 group-hover:bg-primary-50/50 transition-colors duration-300">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div className="relative flex-shrink-0">
                                <img
                                    src={instructorImage}
                                    alt={instructorName}
                                    className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                                />
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success-500 rounded-full border-2 border-white"></div>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Instructor</p>
                                <div className="text-sm font-semibold text-gray-800 truncate">
                                    {instructors.map((instructor, index) => (
                                        <span key={instructor.id}>
                                            {instructor.full_name}
                                            {index !== instructors.length - 1 ? ", " : ""}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <Users size={16} className="text-primary-500 flex-shrink-0" />
                    </div>
                )}

                {/* Tags section */}
                <div className="mb-4 sm:mb-5 min-h-[32px]">
                    {tags && tags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {tags.slice(0, 3).map((tag) => (
                                <span
                                    key={tag}
                                    className="text-xs bg-gradient-to-r from-primary-50 to-primary-100 text-primary-700 border border-primary-200 px-3 py-1.5 rounded-full font-medium hover:from-primary-100 hover:to-primary-200 transition-all duration-300 transform hover:scale-105"
                                >
                                    {tag}
                                </span>
                            ))}
                            {tags && tags.length > 3 && (
                                <span className="text-xs bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-full font-medium">
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
                <div className="flex items-center justify-between mb-4 sm:mb-6 p-3 bg-gradient-to-r from-gray-50/80 to-primary-50/30 rounded-xl border border-gray-100 group-hover:from-primary-50/80 group-hover:to-primary-100/50 transition-all duration-300">
                    <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                            {[...Array(5)].map((_, i) => (
                                <Star
                                    key={i}
                                    size={16}
                                    weight="fill"
                                    className={`${i < Math.floor(ratingValue) ? "text-yellow-400" : "text-gray-300"} transition-colors duration-300`}
                                />
                            ))}
                        </div>
                        <span className="text-sm font-bold text-gray-900">{ratingValue.toFixed(1)}</span>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-600">
                        {studentCount !== undefined && (
                            <div className="flex items-center space-x-1">
                                <Users size={14} />
                                <span className="font-medium">{studentCount}</span>
                            </div>
                        )}
                        <div className="flex items-center space-x-1">
                            <Clock size={14} />
                            <span className="font-medium">2h 30m</span>
                        </div>
                    </div>
                </div>

                {/* Action button */}
                <button
                    className="relative mt-auto w-full overflow-hidden bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg group/btn flex items-center justify-center space-x-2"
                    onClick={() => handleViewCoureseDetails(courseId)}
                >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 -skew-x-12 -translate-x-full group-hover/btn:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700"></div>
                    
                    <BookOpen size={16} className="transition-transform duration-300 group-hover/btn:scale-110" />
                    <span>View Course</span>
                    <ChevronRight size={16} className="transition-transform duration-300 group-hover/btn:translate-x-1" />
                </button>
                
                {/* Progress indicator */}
                <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-primary-400 to-primary-600 w-0 group-hover:w-full transition-all duration-700 ease-out rounded-b-2xl"></div>
            </div>
        </div>
    );
};

export default CourseCard;
