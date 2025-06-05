import React, { useEffect, useMemo, useState } from 'react';
import { StarIcon } from 'lucide-react';
import { getPublicUrl } from '@/services/upload_file';

// Define a basic course type
interface BasicCourse {
  id: string;
  packageName: string;
  thumbnail_file_id?: string;
  level?: string;
  description?: string;
  tags?: string[];
  rating?: number;
  instructor?: { name: string; avatarUrl?: string };
  studentCount?: number;
}

interface CourseCardsProps {
  courses: BasicCourse[];
  currentPage: number;
  onTotalPagesDetermined: (totalPages: number) => void;
  searchTerm?: string;
  sortOption?: string;
}

const ITEMS_PER_PAGE = 4;

// Individual Card Component
const CourseCardItem: React.FC<{ course: BasicCourse }> = ({ course }) => {
  const [courseImageUrl, setCourseImageUrl] = useState<string>('/images/placeholder-course.jpg');
  const [loadingImage, setLoadingImage] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (course.thumbnail_file_id) {
      setLoadingImage(true);
      (async () => {
        try {
          const url = await getPublicUrl(course.thumbnail_file_id);
          if (isMounted) {
            if (url) {
              setCourseImageUrl(url);
            } else {
              setCourseImageUrl('/images/placeholder-course.jpg');
            }
          }
        } catch (error) {
          console.error("Error fetching image URL for course:", course.id, error);
          if (isMounted) setCourseImageUrl('/images/placeholder-course.jpg');
        } finally {
          if (isMounted) {
            setLoadingImage(false);
          }
        }
      })();
    } else {
      setCourseImageUrl('/images/placeholder-course.jpg');
      setLoadingImage(false);
    }
    return () => { isMounted = false; };
  }, [course.thumbnail_file_id, course.id]);

  const getLevelName = (c: BasicCourse): string => c.level || 'General';
  const getLevelColor = (c: BasicCourse): string => {
    const levelName = getLevelName(c);
    switch (levelName.toLowerCase()) {
      case 'beginner': return 'bg-blue-100 text-blue-700';
      case 'intermediate': return 'bg-yellow-100 text-yellow-700';
      case 'advanced': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };
  const ratingValue = course.rating || 3.0;
  const instructorName = course.instructor?.name || 'Valued Instructor';
  const currentInstructorImageUrl = course.instructor?.avatarUrl || `https://i.pravatar.cc/40?u=${encodeURIComponent(instructorName)}`;
  const description = course.description || `An excellent course on ${course.packageName}. This course covers all the essential topics to get you started.`;
  const courseLevelName = getLevelName(course);

  return (
    <div key={course.id} className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
      <div className="w-full h-48 bg-gray-200 flex items-center justify-center relative">
        {loadingImage && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200 bg-opacity-75">
            <div className="text-gray-500">Loading...</div>
          </div>
        )}
        <img 
          src={courseImageUrl} 
          alt={course.packageName} 
          className={`w-full h-full object-cover ${loadingImage ? 'opacity-0' : 'opacity-100'}`}
          onError={() => {
            if (courseImageUrl !== '/images/placeholder-course.jpg') {
              setCourseImageUrl('/images/placeholder-course.jpg');
            }
            setLoadingImage(false);
          }}
        />
      </div>
      <div className="p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-gray-800 truncate" title={course.packageName}>{course.packageName}</h3>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getLevelColor(course)}`}>
            {courseLevelName}
          </span>
        </div>
        
        <p className="text-sm text-gray-600 mb-3 flex-grow line-clamp-3" title={description}>
          {description}
        </p>
        
        <div className="flex items-center mb-3">
          <img src={currentInstructorImageUrl} alt={instructorName} className="w-8 h-8 rounded-full mr-2 object-cover" />
          <span className="text-sm text-gray-700 truncate" title={instructorName}>{instructorName}</span>
        </div>

        <div className="mb-3 min-h-[24px]">
          {course.tags && course.tags.length > 0 ? (
            course.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full mr-1 mb-1 inline-block">
                {tag}
              </span>
            ))
          ) : (
            <span className="text-xs text-gray-400 italic">No tags available</span>
          )}
          {course.tags && course.tags.length > 3 && (
            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full mr-1 mb-1 inline-block">
              + {course.tags.length - 3} more
            </span>
          )}
        </div>

        <div className="flex items-center text-sm text-gray-600 mb-4">
          {[...Array(5)].map((_, i) => (
            <StarIcon
              key={i}
              className={`w-5 h-5 ${i < Math.floor(ratingValue) ? 'text-yellow-400' : 'text-gray-300'}`}
            />
          ))}
          <span className="ml-1">{ratingValue.toFixed(1)}</span>
          {course.studentCount !== undefined && (
              <span className="ml-2 text-gray-500">({course.studentCount} students)</span>
          )}
        </div>

        <button className="mt-auto w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
          View Course
        </button>
      </div>
    </div>
  );
};

const CourseCards: React.FC<CourseCardsProps> = ({
  courses,
  currentPage,
  onTotalPagesDetermined,
  searchTerm,
  sortOption,
}) => {
  const hardcodedInstructors: Record<string, { name: string }> = {
    default: { name: 'Valued Instructor' },
  };

  const coursesToDisplay = useMemo(() => {
    let filteredCourses = courses;
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filteredCourses = filteredCourses.filter(course =>
        course.packageName.toLowerCase().includes(lowerSearchTerm) ||
        (course.instructor?.name || hardcodedInstructors.default.name).toLowerCase().includes(lowerSearchTerm)
      );
    }

    if (sortOption === 'name_asc') {
      filteredCourses = [...filteredCourses].sort((a, b) => a.packageName.localeCompare(b.packageName));
    } else if (sortOption === 'name_desc') {
      filteredCourses = [...filteredCourses].sort((a, b) => b.packageName.localeCompare(a.packageName));
    }
    
    return filteredCourses;
  }, [courses, searchTerm, sortOption, hardcodedInstructors]);

  useEffect(() => {
    const totalPages = Math.ceil(coursesToDisplay.length / ITEMS_PER_PAGE);
    onTotalPagesDetermined(totalPages > 0 ? totalPages : 1);
  }, [coursesToDisplay, onTotalPagesDetermined]);

  const paginatedCourses = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return coursesToDisplay.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [coursesToDisplay, currentPage]);

  if (!courses || courses.length === 0) {
    return <div className="text-center p-10">No courses available.</div>;
  }
  if (paginatedCourses.length === 0 && courses.length > 0) {
    return <div className="text-center p-10">No courses found{searchTerm ? ` for "${searchTerm}"` : ''}.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      {paginatedCourses.map((course) => (
        <CourseCardItem key={course.id} course={course} />
      ))}
    </div>
  );
};

export default CourseCards; 