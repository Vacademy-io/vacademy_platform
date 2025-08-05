import React, { useEffect, useState, useRef } from "react";
import FilterPanel from "./FilterPanel.tsx";
import SearchAndSortBar from "./SearchAndSortBar.tsx";
import CourseCard from "./CourseCards.tsx";
import Pagination from "./Pagination.tsx";
import { useCatalogStore } from "../-store/catalogStore.ts";
import { toTitleCase } from "@/lib/utils";

interface CoursesPageProps {
  searchTerm: string;
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
  const fallbackDescription =
    "build responsive scalable and human-like AI application";
  const fallbackTags = "LLMs,Reinforcement Learning";

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  const paginatedCourses = courseData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(courseData.length / itemsPerPage);

  // Smooth scroll on page change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
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

  return (
    <div ref={scrollRef}>
      <div className="flex flex-col lg:flex-row p-4 lg:p-8 bg-gray-50 min-h-screen">
        <div className="w-full lg:w-1/4 lg:pr-8 mb-8 lg:mb-0">
          <div className="lg:sticky lg:top-8">
            <FilterPanel
              selectedLevels={selectedLevels}
              onLevelChange={(id) =>
                toggleItem(id, selectedLevels, setSelectedLevels)
              }
              selectedTags={selectedTags}
              onTagChange={(id) =>
                toggleItem(id, selectedTags, setSelectedTags)
              }
              selectedInstructors={selectedInstructors}
              onInstructorChange={(id) =>
                toggleItem(id, selectedInstructors, setSelectedInstructors)
              }
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
            <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 gap-6 h-fit">
              {paginatedCourses.map((course, index) => {
                return (
                  <CourseCard
                    courseId={course.id}
                    key={index}
                    package_name={toTitleCase(
                      course.package_name || "Untitled Package"
                    )}
                    level_name={toTitleCase(course.level_name || "Beginner")}
                    instructors={
                      course.instructors?.length
                        ? course.instructors.map((instructor) => ({
                            id: instructor.id,
                            full_name:
                              instructor.full_name || "Unknown Instructor",
                            image_url: undefined,
                          }))
                        : []
                    }
                    rating={course.rating || 4}
                    description={
                      course.course_html_description_html || fallbackDescription
                    }
                    tags={
                      course.comma_separeted_tags
                        ? course.comma_separeted_tags
                            .split(",")
                            .map((tag: string) => tag.trim())
                        : fallbackTags
                            .split(",")
                            .map((tag: string) => tag.trim())
                    }
                    previewImageUrl={course.course_preview_image_media_id}
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
