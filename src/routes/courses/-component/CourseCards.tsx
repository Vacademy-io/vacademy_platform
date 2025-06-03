import React, { useEffect, useState, useMemo } from 'react';
import { StarIcon } from 'lucide-react';
import axios, { AxiosResponse } from 'axios'; // Import AxiosResponse for typing

const ITEMS_PER_PAGE = 4;

// Interface for the raw data fetched from Picsum API
interface FetchedCourseItem {
  id: string;
  author: string;
  width: number;
  height: number;
  url: string;
  download_url: string;
}

// Interface for the processed course data used in the component
interface ProcessedCourse extends FetchedCourseItem {
  title: string;
  instructor: string;
  level: string;
  rating: string; // Rating is string due to .toFixed(1)
  tags: string[];
  instructorImage: string;
}

interface CourseCardsProps {
  currentPage: number;
  onTotalPagesDetermined: (totalPages: number) => void;
  searchTerm?: string; // Optional searchTerm
}

const CourseCards: React.FC<CourseCardsProps> = ({ currentPage, onTotalPagesDetermined, searchTerm }) => {
  const [allFetchedCourses, setAllFetchedCourses] = useState<ProcessedCourse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
 
  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      setError(null);
      try {
        const response: AxiosResponse<FetchedCourseItem[]> = await axios.get(
          `https://picsum.photos/v2/list?page=${currentPage}&limit=${ITEMS_PER_PAGE}`
        );
        const data = response.data;
        // console.log(data);

        const linkHeader = response.headers['link'] as string | undefined;
        let calculatedTotalPages = 10; 

        if (linkHeader) {
          const links = linkHeader.split(',');
          const lastLink = links.find(link => link.includes('rel="last"'));
          if (lastLink) {
            const match = lastLink.match(/page=(\d+)/);
            if (match && match[1]) {
              calculatedTotalPages = parseInt(match[1], 10);
            }
          } else {
            if (data.length === ITEMS_PER_PAGE && !links.find(link => link.includes('rel="next"'))) {
                 calculatedTotalPages = currentPage;
            } else if (links.find(link => link.includes('rel="next"'))){
                calculatedTotalPages = Math.max(10, currentPage +1); 
            } else {
                calculatedTotalPages = currentPage; 
            }
          }
        }
        onTotalPagesDetermined(calculatedTotalPages > 0 ? calculatedTotalPages : 1);

        const processedData: ProcessedCourse[] = data.map((course, index) => ({
          ...course,
          id: `${course.id}-${currentPage}-${index}`,
          title: `Course by ${course.author}`,
          instructor: course.author,
          level: ['Beginner', 'Intermediate', 'Advanced'][(parseInt(course.id,10) % 3)],
          rating: ( (parseInt(course.id,10) % 21 + 30) / 10 ).toFixed(1),
          tags: [['AI', 'Development'], ['LLMs', 'GRPO'], ['Data Science', 'Python'], ['AI Agents', 'Voice']][parseInt(course.id,10) % 4],
          instructorImage: `https://i.pravatar.cc/40?u=${course.author.replace(/\s+/g, '')}`,
        }));
        setAllFetchedCourses(processedData);
      } catch (e: any) { // Catch any error type
        setError(e.message || "An unknown error occurred");
        onTotalPagesDetermined(1);
        setAllFetchedCourses([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [currentPage, onTotalPagesDetermined]);

  const coursesToDisplay = useMemo(() => {
    const trimmedSearchTerm = searchTerm ? searchTerm.trim().toLowerCase() : '';
    if (!trimmedSearchTerm) {
      return allFetchedCourses;
    }
    return allFetchedCourses.filter(course => 
      course.title.toLowerCase().includes(trimmedSearchTerm) ||
      course.instructor.toLowerCase().includes(trimmedSearchTerm)
    );
  }, [allFetchedCourses, searchTerm]);

  if (loading) {
    return <div className="text-center p-10">Loading courses...</div>;
  }

  if (error) {
    return <div className="text-center p-10 text-red-500">Error loading courses: {error}</div>;
  }

  if (coursesToDisplay.length === 0 && !loading) {
    return <div className="text-center p-10">No courses found{searchTerm ? ` for "${searchTerm}"` : ''}.</div>;
  }

  const getLevelColor = (level: string): string => {
    switch (level) {
      case 'Beginner': return 'bg-blue-100 text-blue-700';
      case 'Intermediate': return 'bg-yellow-100 text-yellow-700';
      case 'Advanced': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      {coursesToDisplay.map((course) => (
        <div key={course.id} className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
          <img src={course.download_url} alt={course.title} className="w-full h-48 object-cover" />
          <div className="p-4 flex flex-col flex-grow">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold text-gray-800">{course.title}</h3>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getLevelColor(course.level)}`}>
                {course.level}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-3 flex-grow">Improve LLM reasoning with reinforcement fine-tuning and reward functions. (Placeholder description)</p>
            
            <div className="flex items-center mb-3">
              <img src={course.instructorImage} alt={course.author} className="w-8 h-8 rounded-full mr-2" />
              <span className="text-sm text-gray-700">{course.instructor}</span>
            </div>

            <div className="mb-3">
              {course.tags.map(tag => (
                <span key={tag} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full mr-1 mb-1 inline-block">
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex items-center text-sm text-gray-600 mb-4">
              {[...Array(5)].map((_, i) => (
                <StarIcon 
                  key={i} 
                  className={`w-5 h-5 ${i < Math.floor(parseFloat(course.rating)) ? 'text-yellow-400' : 'text-gray-300'}`} 
                />
              ))}
              <span className="ml-1">{course.rating}</span>
            </div>

            <button className="mt-auto w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
              View Course
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CourseCards; 