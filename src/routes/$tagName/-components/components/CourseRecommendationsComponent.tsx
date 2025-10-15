import React, { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CourseRecommendationsProps } from "../../-types/course-catalogue-types";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import { urlCourseDetails } from "@/constants/urls";
import axios from "axios";

interface CourseRecommendationsComponentProps extends CourseRecommendationsProps {
  instituteId: string;
  tagName: string;
  globalSettings?: any;
}

export const CourseRecommendationsComponent: React.FC<CourseRecommendationsComponentProps> = ({
  title,
  limit = 3,
  instituteId,
  tagName,
  globalSettings,
}) => {
  const navigate = useNavigate();
  const [recommendedCourses, setRecommendedCourses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch recommended courses from API
  useEffect(() => {
    const fetchRecommendedCourses = async () => {
      setIsLoading(true);
      try {
        
        const response = await axios.post(urlCourseDetails, {
          status: [],
          level_ids: [],
          faculty_ids: [],
          search_by_name: "",
          tag: [],
          min_percentage_completed: 0,
          max_percentage_completed: 0,
        }, {
          params: {
            instituteId: instituteId,
            page: 0,
            size: limit,
            sort: "createdAt,desc"
          },
          headers: {
            "Content-Type": "application/json",
          },
        });

        
        // Transform API response
        const apiCourses = response.data?.content || response.data || [];
        const transformedCourses = await Promise.all(
          apiCourses.slice(0, limit).map(async (course: any) => {
            let thumbnailUrl = "/api/placeholder/300/200";
            
            // Get public URL for thumbnail if it exists and is not a placeholder
            if (course.thumbnailFileId && !course.thumbnailFileId.includes('/api/placeholder/')) {
              try {
                thumbnailUrl = await getPublicUrlWithoutLogin(course.thumbnailFileId);
              } catch (error) {
                thumbnailUrl = "/api/placeholder/300/200";
              }
            }

            return {
              id: course.id || course.packageId,
              title: course.package_name || course.title || "Untitled Course",
              description: course.short_description || course.description || "No description available",
              thumbnail: thumbnailUrl,
              price: course.package_price || course.price || 0,
              instructor: course.instructors?.[0]?.full_name || course.instructorName || "Unknown Instructor",
            };
          })
        );

        setRecommendedCourses(transformedCourses);
      } catch (error) {
        setRecommendedCourses([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (instituteId) {
      fetchRecommendedCourses();
    }
  }, [instituteId, limit]);

  const handleCourseClick = (courseId: string) => {
    navigate({ to: `/${tagName}/${courseId}` });
  };

  if (isLoading) {
    return (
      <div className="py-12 bg-gray-50 w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">{title}</h2>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 bg-gray-50 w-full">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">{title}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendedCourses.map((course) => (
            <div
              key={course.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleCourseClick(course.id)}
            >
              <div className="aspect-w-16 aspect-h-9">
                <img
                  src={course.thumbnail}
                  alt={course.title}
                  className="w-full h-48 object-cover"
                  onError={async (e) => {
                    try {
                      // Try to get public URL for the thumbnail
                      const publicUrl = await getPublicUrlWithoutLogin(course.thumbnail);
                      if (publicUrl) {
                        e.currentTarget.src = publicUrl;
                      } else {
                        e.currentTarget.src = "/api/placeholder/300/200";
                      }
                    } catch {
                      e.currentTarget.src = "/api/placeholder/300/200";
                    }
                  }}
                />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                  {course.title}
                </h3>
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                  {course.description}
                </p>
                <div className="flex justify-between items-center">
                  {/* Price - Only show if payment is enabled */}
                  {globalSettings?.payment?.enabled !== false && (
                    <span className="text-lg font-bold text-primary-600">
                      {course.price === 0 ? "Free" : `$${course.price}`}
                    </span>
                  )}
                  <span className="text-sm text-gray-500">
                    by {course.instructor}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
