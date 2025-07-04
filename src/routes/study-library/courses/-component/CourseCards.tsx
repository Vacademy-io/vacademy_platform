import React, { useEffect, useState } from "react";
import { StarIcon } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";

interface Instructor {
    id: string;
    full_name: string;
    image_url?: string;
}

interface CourseCardProps {
    courseId: string;
    package_name: string;
    level_name: string;
    thumbnailUrl: string;
    instructors: Instructor[];
    rating: number;
    description: string;
    tags: string[];
    studentCount?: number;
    previewImageUrl: string;
}

const fallbackImage = "/images/placeholder-course.jpg";
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
    const [courseImageUrl, setCourseImageUrl] = useState(thumbnailUrl);
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
        setLoadingImage(true);
        try {
            const url = await getPublicUrlWithoutLogin(previewImageUrl);
            setCourseImageUrl(url);
        } catch (error) {
            console.error("Error fetching institute details:", error);
        } finally {
            setLoadingImage(false);
        }
    };

    useEffect(() => {
        loadImage();
    }, [courseImageUrl]);

    const getLevelColor = () => {
        switch (level_name.toLowerCase()) {
            case "beginner":
                return "bg-green-100 text-green-700";
            case "intermediate":
                return "bg-yellow-100 text-yellow-700";
            case "advanced":
                return "bg-red-100 text-red-700";
            default:
                return "bg-blue-100 text-blue-600";
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
            <div className="w-full h-48 bg-gray-200 flex items-center justify-center relative">
                {loadingImage ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-200 bg-opacity-75">
                        <div className="text-gray-500">Loading...</div>
                    </div>
                ) : courseImageUrl ? (
                    <img
                        src={courseImageUrl}
                        alt={package_name}
                        loading="lazy"
                        className={`w-full h-full object-cover transition-opacity duration-300 ${
                            loadingImage ? "opacity-0" : "opacity-100"
                        }`}
                    />
                ) : (
                    <img
                        src={fallbackImage}
                        alt={package_name}
                        loading="lazy"
                        className={`w-full h-full object-cover transition-opacity duration-300 ${
                            loadingImage ? "opacity-0" : "opacity-100"
                        }`}
                    />
                )}
            </div>

            <div className="p-4 flex flex-col flex-grow">
                <div className="flex justify-between items-start mb-2">
                    <h3
                        className="text-lg font-semibold text-gray-800 truncate"
                        title={package_name}
                    >
                        {package_name}
                    </h3>
                    <span
                        className={`text-xs font-semibold px-2 py-1 rounded-sm ${getLevelColor()}`}
                    >
                        {level_name}
                    </span>
                </div>
                <p
                    className="text-sm text-gray-600 mb-3 flex-grow line-clamp-3"
                    dangerouslySetInnerHTML={{
                        __html: description || "",
                    }}
                />
                {instructors.length > 0 && (
                    <div className="flex items-center mb-3">
                        <img
                            src={instructorImage}
                            alt={instructorName}
                            className="w-8 h-8 rounded-full mr-2 object-cover"
                        />
                        {instructors.map((instructor, index) => (
                            <span key={instructor.id}>
                                {instructor.full_name}
                                {index !== instructors.length - 1 ? ", " : ""}
                            </span>
                        ))}
                    </div>
                )}

                <div className="mb-3 min-h-[24px]">
                    {tags && tags.length > 0 ? (
                        tags.slice(0, 3).map((tag) => (
                            <span
                                key={tag}
                                className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full mr-1 mb-1 inline-block"
                            >
                                {tag}
                            </span>
                        ))
                    ) : (
                        <span className="text-xs text-gray-400 italic">
                            No tags available
                        </span>
                    )}
                    {tags && tags.length > 3 && (
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full mr-1 mb-1 inline-block">
                            + {tags.length - 3} more
                        </span>
                    )}
                </div>

                <div className="flex items-center text-sm text-gray-600 mb-4">
                    {[...Array(5)].map((_, i) => (
                        <StarIcon
                            key={i}
                            className={`w-5 h-5 ${i < Math.floor(ratingValue) ? "text-yellow-400" : "text-gray-300"}`}
                        />
                    ))}
                    <span className="ml-1">{ratingValue.toFixed(1)}</span>
                    {studentCount !== undefined && (
                        <span className="ml-2 text-gray-500">
                            ({studentCount} students)
                        </span>
                    )}
                </div>

                <button
                    className="mt-auto w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                    onClick={() => handleViewCoureseDetails(courseId)}
                >
                    View Course
                </button>
            </div>
        </div>
    );
};

export default CourseCard;
