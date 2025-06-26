import React, { useEffect, useState, useRef } from 'react';
import FilterPanel from './FilterPanel.tsx';
import SearchAndSortBar from './SearchAndSortBar.tsx';
import CourseCard from './CourseCards.tsx';
import Pagination from './Pagination.tsx';
import { useCatalogStore } from '../-store/catalogStore.ts';
import { getPublicUrl } from "@/services/upload_file";

interface CoursesPageProps {
  searchTerm:string;
  onSearchChange: (value: string) => void;
  sortOption: string;
  onSortChange: (value: string) => void;

  selectedLevels: string[];
  setSelectedLevels: (levels: string[]) => void;

  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;

  selectedInstructors: string[];
  setSelectedInstructors: (instructors: string[]) => void;

  clearAllFilters: () => void;
  onApplyFilters: () => void;
}

const CoursesPage: React.FC<CoursesPageProps> = ({
  searchTerm,
  onSearchChange,
  sortOption,
  onSortChange,
  selectedLevels,
  setSelectedLevels,
  selectedTags,
  setSelectedTags,
  selectedInstructors,
  setSelectedInstructors,
  clearAllFilters,
  onApplyFilters,
}) => {
  const { courseData } = useCatalogStore();
  const [thumbnailUrls, setThumbnailUrls] = useState<string[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  
  const fallbackInstructor = [
    { id: "373jeue38", full_name: "shyam" },
    { id: "9ek393932", full_name: "rajkumar" },
  ];
  const fallbackDescription = "build responsive scalable and human-like AI application";
  const fallbackTags = "LLMs,Reinforcement Learning";
  const fallbackImageUrl =
    'https://images.unsplash.com/photo-1750059397834-5b359a05dba0?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage =4;

  const paginatedCourses = courseData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(courseData.length / itemsPerPage);

  // Smooth scroll on page change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentPage]);

  // Reset page to 1 on course data change
  useEffect(() => {
    setCurrentPage(1);
  }, [courseData]);

  // Helper function to toggle item in array
  const toggleItem = (
    itemId: string,
    list: string[],
    setter: (newList: string[]) => void
  ) => {
    if (list.includes(itemId)) {
      setter(list.filter((i) => i !== itemId));
    } else {
      setter([...list, itemId]);
    }
  };

  // Convert thumbnail_file_id to URLs with individual loading (more reliable)
  useEffect(() => {
    const convertThumbnailsToUrls = async () => {
      console.log(`Starting image conversion for ${courseData.length} courses`);

      // Initialize with fallback images to show immediately
      const initialUrls = new Array(courseData.length).fill(fallbackImageUrl);
      setThumbnailUrls(initialUrls);

      // Collect all valid file IDs
      const validFileIds = courseData
        .map((course, index) => ({
          fileId: course.thumbnail_file_id,
          index
        }))
        .filter(item => item.fileId && item.fileId.trim() !== '');

      if (validFileIds.length === 0) {
        console.log('No valid file IDs to process');
        return;
      }

      console.log('Using individual image loading...');

      const imageUrlPromises = validFileIds.map(async (item) => {
        try {
          console.log(`Loading image for fileId: ${item.fileId}`);
          const url = await getPublicUrl(item.fileId);
          if (url && typeof url === 'string' && url.trim() !== '' && url !== 'null' && url !== 'undefined') {
            console.log(`Individual load success for index ${item.index}: ${url}`);
            return { index: item.index, url };
          } else {
            console.log(`Individual load failed for index ${item.index}: ${url}`);
            return { index: item.index, url: fallbackImageUrl };
          }
        } catch (error) {
          console.error(`Failed to load image ${item.index}:`, error);
          return { index: item.index, url: fallbackImageUrl };
        }
      });

      const results = await Promise.allSettled(imageUrlPromises);

      setThumbnailUrls(prevUrls => {
        const newUrls = [...prevUrls];
        results.forEach((result, i) => {
          if (result.status === 'fulfilled') {
            console.log(`Setting URL for index ${result.value.index}: ${result.value.url}`);
            newUrls[result.value.index] = result.value.url;
          } else {
            console.log(`Failed result for index ${i}:`, result.reason);
          }
        });
        return newUrls;
      });
    };

    if (courseData.length > 0) {
      convertThumbnailsToUrls();
    }
  }, [courseData]);

  return (
    <div ref={scrollRef}>
      <div className="flex flex-col lg:flex-row p-4 lg:p-8 bg-gray-50 min-h-screen">
        <div className="w-full lg:w-1/4 lg:pr-8 mb-8 lg:mb-0">
          <div className="lg:sticky lg:top-8">
            <FilterPanel
              selectedLevels={selectedLevels}
              onLevelChange={(id) => toggleItem(id, selectedLevels, setSelectedLevels)}
              selectedTags={selectedTags}
              onTagChange={(id) => toggleItem(id, selectedTags, setSelectedTags)}
              selectedInstructors={selectedInstructors}
              onInstructorChange={(id) => toggleItem(id, selectedInstructors, setSelectedInstructors)}
              clearAllFilters={clearAllFilters}
              onApplyFilters={onApplyFilters}
            />
          </div>
        </div>

        <div className="w-full lg:w-3/4">
          <SearchAndSortBar
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
            sortOption={sortOption}
            onSortChange={onSortChange}
          />

          {courseData.length === 0 ? (
            <p className="text-gray-500 text-center">No courses available</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 gap-6">
              {paginatedCourses.map((course, index) => {
                const originalIndex = (currentPage - 1) * itemsPerPage + index;
                const currentUrl = thumbnailUrls[originalIndex] || fallbackImageUrl;

                return (
                  <CourseCard
                  
                    key={index}
                    package_session_id={course.package_session_id}
                    package_name={course.package_name || 'Untitled Package'}
                    level_name={course.level_name || 'Beginner'}
                    thumbnailUrl={currentUrl}
                    instructors={course.instructors?.length ? course.instructors : fallbackInstructor}
                    rating={course.rating || 4}
                    description={course.course_html_description_html || fallbackDescription}
                    tags={
                      course.comma_separeted_tags
                        ? course.comma_separeted_tags.split(',').map((tag: string) => tag.trim())
                        : fallbackTags.split(',').map((tag: string) => tag.trim())
                    }
                  />
                );
              })}
            </div>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </div>
      </div>
    </div>
  );
};

export default CoursesPage;
