import React, { useEffect, useState } from "react";
import { StarIcon } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { toTitleCase } from "@/lib/utils";
import { ContentTerms, RoleTerms, SystemTerms } from "@/types/naming-settings";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { Button } from "@/components/ui/button";

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
  instructors,
  rating,
  description,
  tags,
  studentCount,
  previewImageUrl,
}) => {
  const router = useRouter();
  const searchParams = router.state.location.search;
  const [courseImageUrl, setCourseImageUrl] = useState("");
  const [loadingImage, setLoadingImage] = useState(true);

  const instructor = instructors[0];
  const instructorName = instructor?.full_name || "Unknown Instructor";
  const instructorImage = instructor?.image_url || fallbackInstructorImage;

  const ratingValue = rating || 0;

  const handleViewCoureseDetails = () => {
    router.navigate({
      to: "/courses/course-details",
      search: {
        courseId: courseId,
        instituteId: searchParams.instituteId || "",
      },
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
        return "bg-green-100 text-green-600";
      case "intermediate":
        return "bg-yellow-100 text-yellow-600";
      case "advanced":
        return "bg-red-100 text-red-600";
      default:
        return "bg-blue-100 text-blue-600";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col h-fit hover:shadow-xl transition-shadow duration-300">
      {courseImageUrl && (
        <div className="w-full h-40 sm:h-48 bg-gray-200 flex items-center justify-center relative">
          <img
            src={courseImageUrl}
            alt={toTitleCase(package_name)}
            loading="lazy"
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              loadingImage ? "opacity-0" : "opacity-100"
            }`}
          />
        </div>
      )}

      <div className="p-3 sm:p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2 sm:mb-3 gap-2">
          <h3
            className="text-base sm:text-lg font-semibold text-gray-800 line-clamp-2 flex-1 min-w-0"
            title={toTitleCase(package_name)}
          >
            {toTitleCase(package_name)}
          </h3>
          <span
            className={`text-xs sm:text-sm font-semibold px-2 py-1 rounded-sm ${getLevelColor()} flex-shrink-0`}
          >
            {toTitleCase(level_name)}
          </span>
        </div>

        <p
          className="text-sm text-gray-600 mb-3 flex-grow line-clamp-3"
          dangerouslySetInnerHTML={{
            __html: description || "",
          }}
        />

        {instructors.length > 0 && (
          <div className="flex items-center mb-3 p-2 sm:p-3 bg-gray-50 rounded-lg">
            <img
              src={instructorImage}
              alt={instructorName}
              className="w-6 h-6 sm:w-8 sm:h-8 rounded-full mr-2 object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">
                {getTerminology(RoleTerms.Teacher, SystemTerms.Teacher)}
              </p>
              <div className="text-xs sm:text-sm font-semibold text-gray-800 truncate">
                {instructors.map((instructor, index) => (
                  <span key={instructor.id}>
                    {instructor.full_name}
                    {index !== instructors.length - 1 ? ", " : ""}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mb-3 min-h-[24px]">
          {tags && tags.length > 0 ? (
            <div className="flex flex-wrap gap-1 sm:gap-2">
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-violet-200 text-violet-700 px-2 py-1 rounded-sm inline-block"
                >
                  {tag}
                </span>
              ))}
              {tags && tags.length > 3 && (
                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full inline-block">
                  + {tags.length - 3} more
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400 italic">
              No tags available
            </span>
          )}
        </div>

        <div className="flex items-center text-sm text-gray-600 mb-4">
          <div className="flex items-center space-x-1">
            {[...Array(5)].map((_, i) => (
              <StarIcon
                key={i}
                className={`w-4 h-4 sm:w-5 sm:h-5 ${
                  i < Math.floor(ratingValue)
                    ? "text-yellow-400"
                    : "text-gray-300"
                }`}
              />
            ))}
            <span className="ml-1 font-medium">{ratingValue.toFixed(1)}</span>
          </div>
          {studentCount !== undefined && (
            <span className="ml-2 text-gray-500 text-xs sm:text-sm">
              ({studentCount}{" "}
              {getTerminology(
                RoleTerms.Learner,
                SystemTerms.Learner
              ).toLocaleLowerCase()}
              s)
            </span>
          )}
        </div>

        <Button 
          onClick={handleViewCoureseDetails}
          className="w-full py-2 sm:py-2.5 text-sm sm:text-base"
        >
          View {getTerminology(ContentTerms.Course, SystemTerms.Course)}
        </Button>
      </div>
    </div>
  );
};

export default CourseCard;
