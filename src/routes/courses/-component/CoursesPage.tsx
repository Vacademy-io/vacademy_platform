import React, { useState, useCallback } from 'react';
// import { useParams } from 'react-router-dom'; // Removed
import FilterPanel from './FilterPanel.tsx';
import SearchAndSortBar from './SearchAndSortBar.tsx';
import CourseCards from './CourseCards.tsx';
import Pagination from './Pagination.tsx';
import { useCatalogStore } from '../-store/catalogStore.ts'; // Uncommented store usage
// imort { fetchInstituteDataById, fetchCoursesByInstituteId } from '@/services/api.ts'; // Removed API imports

// Mock data - adjust as needed to match your pre-API integration static data structure
// const mockCourses = [
//   { id: '1', name: 'Introduction to Web Development', level: 'Beginner', description: 'Learn the basics of HTML, CSS, and JavaScript.', tags: ['Web Dev', 'HTML', 'CSS'], rating: 4.5, instructor: { name: 'Alice Wonderland' }, imageUrl: '/images/course-placeholder-1.jpg', studentCount: 150 },
//   { id: '2', name: 'Advanced React Patterns', level: 'Advanced', description: 'Deep dive into React design patterns and performance.', tags: ['React', 'JavaScript', 'Web Dev'], rating: 4.8, instructor: { name: 'Bob The Builder' }, imageUrl: '/images/course-placeholder-2.jpg', studentCount: 95 },
//   { id: '3', name: 'Data Science with Python', level: 'Intermediate', description: 'Explore data analysis and machine learning with Python.', tags: ['Python', 'Data Science', 'Machine Learning'], rating: 4.7, instructor: { name: 'Charlie Brown' }, imageUrl: '/images/course-placeholder-3.jpg', studentCount: 120 },
//   { id: '4', name: 'UI/UX Design Fundamentals', level: 'Beginner', description: 'Principles of user interface and user experience design.', tags: ['Design', 'UI', 'UX'], rating: 4.3, instructor: { name: 'Diana Prince' }, imageUrl: '/images/course-placeholder-4.jpg', studentCount: 110 },
//   { id: '5', name: 'Cloud Computing Essentials', level: 'Intermediate', description: 'Introduction to cloud platforms and services.', tags: ['Cloud', 'AWS', 'Azure'], rating: 4.6, instructor: { name: 'Edward Scissorhands' }, imageUrl: '/images/course-placeholder-5.jpg', studentCount: 80 },
//   { id: '6', name: 'Cybersecurity Basics', level: 'Beginner', description: 'Understanding fundamental cybersecurity concepts.', tags: ['Security', 'Cybersecurity'], rating: 4.4, instructor: { name: 'Fiona Gallagher' }, imageUrl: '/images/course-placeholder-6.jpg', studentCount: 130 },
// ];

// const mockLevels = [
//   { id: 'beginner', name: 'Beginner' },
//   { id: 'intermediate', name: 'Intermediate' },
//   { id: 'advanced', name: 'Advanced' },
// ];

// const mockTopics = [
//   { id: 'webdev', name: 'Web Dev' },
//   { id: 'datasci', name: 'Data Science' },
//   { id: 'design', name: 'Design' },
//   { id: 'cloud', name: 'Cloud' },
//   { id: 'security', name: 'Security' },
// ];

// const mockInstructors = [
//   { id: 'alice', name: 'Alice Wonderland' },
//   { id: 'bob', name: 'Bob The Builder' },
//   { id: 'charlie', name: 'Charlie Brown' },
//   { id: 'diana', name: 'Diana Prince' },
//   { id: 'edward', name: 'Edward Scissorhands' },
//   { id: 'fiona', name: 'Fiona Gallagher' },
// ];

// Define Props interface for CoursesPage
interface CoursesPageProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  
  // sortOption and onSortChange are still managed locally as they don't affect API calls directly yet
  // If sorting needs to be API-driven, these would also become props.

  availableLevels: { id: string; name: string }[];
  selectedLevelIds: string[];
  onLevelChange: (levelId: string) => void;

  availableTags: { id: string; name: string }[]; // Changed from topics
  selectedTagNames: string[]; // Changed from selectedTopicNames
  onTagChange: (tagName: string) => void; // Changed from onTopicChange

  availableInstructors: { id: string; name: string }[];
  selectedInstructorNames: string[];
  onInstructorChange: (instructorName: string) => void;

  clearAllFilters: () => void;
}

const CoursesPage: React.FC<CoursesPageProps> = ({
  searchTerm,
  onSearchChange,
  availableLevels,
  selectedLevelIds,
  onLevelChange,
  availableTags,
  selectedTagNames,
  onTagChange,
  availableInstructors,
  selectedInstructorNames,
  onInstructorChange,
  clearAllFilters
}) => {

  const {
    dynamicCourses, 
  } = useCatalogStore();

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1); 
  // const [searchTerm, setSearchTerm] = useState<string>(''); // Prop
  const [sortOption, setSortOption] = useState<string>('Newest'); // Kept local for now

  // const [selectedLevelIds, setSelectedLevelIds] = useState<string[]>([]); // Prop
  // const [selectedTopicNames, setSelectedTopicNames] = useState<string[]>([]); // Prop (renamed to selectedTagNames)
  // const [selectedInstructorNames, setSelectedInstructorNames] = useState<string[]>([]); // Prop


  const handlePageChange = useCallback((page: number) => {
    if (page > 0 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  const handleTotalPagesDetermined = useCallback((calculatedTotalPages: number) => {
    setTotalPages(calculatedTotalPages > 0 ? calculatedTotalPages : 1);
    if (currentPage > calculatedTotalPages && calculatedTotalPages > 0) {
      setCurrentPage(calculatedTotalPages);
    } else if (currentPage === 0 && calculatedTotalPages > 0) { 
      setCurrentPage(1);
    }
  }, [currentPage]);

  // onSearchChange is now a prop
  // const handleSearchChange = useCallback((term: string) => {
  //   onSearchChange(term); // Call prop
  //   setCurrentPage(1);
  // }, [onSearchChange]);

  const handleSortChange = useCallback((option: string) => {
    setSortOption(option);
    setCurrentPage(1); 
  }, []);

  // onLevelChange is now a prop
  // const handleLevelChange = useCallback((levelId: string) => {
  //   onLevelChange(levelId); // Call prop
  //   setCurrentPage(1);
  // }, [onLevelChange]);

  // onTagChange (previously onTopicChange) is now a prop
  // const handleTagChange = useCallback((tagName: string) => {
  //    onTagChange(tagName); // Call prop
  //    setCurrentPage(1);
  // }, [onTagChange]);
  
  // onInstructorChange is now a prop
  // const handleInstructorChange = useCallback((instructorName: string) => {
  //   onInstructorChange(instructorName); // Call prop
  //   setCurrentPage(1);
  // }, [onInstructorChange]);

  // clearAllFilters is now a prop
  // const clearAllFiltersInPage = useCallback(() => {
  //   clearAllFilters(); // Call prop
  //   setCurrentPage(1);
  // }, [clearAllFilters]);
  
  // The handlers passed as props (onSearchChange, onLevelChange, etc.) from CourseCataloguePage
  // already handle logic like resetting to page 1.
  // If not, then setCurrentPage(1) would be needed here after calling the prop handlers.
  // For now, assuming parent handlers manage page reset.

  // Mock courses for fallback if dynamicCourses is empty
  const mockCoursesFallback = [
    { id: '1', name: 'Introduction to Web Development', level: 'Beginner', description: 'Learn the basics of HTML, CSS, and JavaScript.', tags: ['Web Dev', 'HTML', 'CSS'], rating: 4.5, instructor: { name: 'Alice Wonderland' }, imageUrl: '/images/course-placeholder-1.jpg', studentCount: 150, package_name: 'Introduction to Web Development' },
    { id: '2', name: 'Advanced React Patterns', level: 'Advanced', description: 'Deep dive into React design patterns and performance.', tags: ['React', 'JavaScript', 'Web Dev'], rating: 4.8, instructor: { name: 'Bob The Builder' }, imageUrl: '/images/course-placeholder-2.jpg', studentCount: 95, package_name: 'Advanced React Patterns' },
  ];


  return (
    <div className="flex flex-col lg:flex-row p-4 lg:p-8 bg-gray-50 min-h-screen">
      <div className="w-full lg:w-1/4 lg:pr-8 mb-8 lg:mb-0">
        <div className="lg:sticky lg:top-8">
          <FilterPanel 
            levels={availableLevels}
            tags={availableTags} // Changed from topics
            instructors={availableInstructors}
            selectedLevels={selectedLevelIds}
            onLevelChange={onLevelChange} // Pass prop directly
            selectedTags={selectedTagNames} // Changed from selectedTopics
            onTagChange={onTagChange} // Pass prop directly, changed from onTopicChange
            selectedInstructors={selectedInstructorNames}
            onInstructorChange={onInstructorChange} // Pass prop directly
            clearAllFilters={clearAllFilters} // Pass prop directly
          />
        </div>
      </div>

      <div className="w-full lg:w-3/4">
        <SearchAndSortBar 
          searchTerm={searchTerm} 
          onSearchChange={onSearchChange} // Pass prop directly
          sortOption={sortOption}
          onSortChange={handleSortChange} // Local sort handler
        />
        <CourseCards 
          courses={dynamicCourses?.length ? dynamicCourses : mockCoursesFallback} // Use dynamicCourses or fallback
          currentPage={currentPage} 
          onTotalPagesDetermined={handleTotalPagesDetermined} 
          searchTerm={searchTerm} // Pass searchTerm for client-side highlighting/filtering if any
          sortOption={sortOption} // Pass sortOption for client-side sorting
        />
        <Pagination 
          currentPage={currentPage} 
          totalPages={totalPages}
          onPageChange={handlePageChange} 
        />
      </div>
    </div>
  );
};

export default CoursesPage; 