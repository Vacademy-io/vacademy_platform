import React, { useEffect, useRef } from "react";
import FilterPanel from "./FilterPanel.tsx";
import SearchAndSortBar from "./SearchAndSortBar.tsx";
import CourseCard from "./CourseCards.tsx";
import { MyPagination } from "@/components/design-system/pagination.tsx";
import { CoursePackageResponse } from "@/types/course-catalog/course-catalog-list.ts";
import { Search } from "lucide-react";
import { toTitleCase } from "@/lib/utils";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils.ts";
import { ContentTerms, SystemTerms } from "@/types/naming-settings.ts";

interface CoursesPageProps {
    courseData: CoursePackageResponse;
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

    handlePageChange: (page: number) => void;
    showFilters?: boolean;
    selectedTab: string;
}

const CoursesPage: React.FC<CoursesPageProps> = ({
    courseData,
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
    handlePageChange,
    showFilters = true,
    selectedTab,
}) => {
    const fallbackDescription =
        "";
    const fallbackTags: string = "";

    const scrollRef = useRef<HTMLDivElement | null>(null);

    // Smooth scroll on page change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }
    }, []);

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
            //  console.log(`Starting image conversion for ${courseData.length} courses`);
            // Collect all valid file IDs
            const validFileIds = courseData.content
                .map((course, index) => ({
                    fileId: course.thumbnail_file_id,
                    index,
                }))
                .filter((item) => item.fileId && item.fileId.trim() !== "");

            if (validFileIds.length === 0) {
        
                return;
            }
        };

        if (courseData.content.length > 0) {
            convertThumbnailsToUrls();
        }
    }, [courseData]);

    return (
        <div
            ref={scrollRef}
            className="min-h-screen"
        >
            <div
                className={`flex flex-col lg:flex-row ${showFilters ? "gap-4 lg:gap-6" : ""} mx-auto`}
            >
                {/* Sidebar - Only show if showFilters is true */}
                {showFilters && (
                    <div className="w-full lg:w-80 lg:flex-shrink-0 order-1">
                        <FilterPanel
                            selectedLevels={selectedLevels}
                            onLevelChange={(id) =>
                                toggleItem(
                                    id,
                                    selectedLevels,
                                    setSelectedLevels
                                )
                            }
                            selectedTags={selectedTags}
                            onTagChange={(id) =>
                                toggleItem(id, selectedTags, setSelectedTags)
                            }
                            selectedInstructors={selectedInstructors}
                            onInstructorChange={(id) =>
                                toggleItem(
                                    id,
                                    selectedInstructors,
                                    setSelectedInstructors
                                )
                            }
                            clearAllFilters={clearAllFilters}
                            onApplyFilters={onApplyFilters}
                        />
                    </div>
                )}

                {/* Main Content Area */}
                <div className="flex-1 min-w-0 order-2">
                    <SearchAndSortBar
                        searchTerm={searchTerm}
                        onSearchChange={onSearchChange}
                        sortOption={sortOption}
                        onSortChange={onSortChange}
                    />

                    {courseData.content.length === 0 ? (
                        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-md shadow-sm p-5 sm:p-6 text-center">
                            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-md mx-auto mb-3 sm:mb-4 flex items-center justify-center">
                                <Search
                                    size={20}
                                    className="text-gray-400 sm:w-6 sm:h-6"
                                />
                            </div>
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-neutral-100 mb-2">
                                No{" "}
                                {getTerminology(
                                    ContentTerms.Course,
                                    SystemTerms.Course
                                ).toLocaleLowerCase()}
                                s found
                            </h3>
                            <p className="text-gray-600 dark:text-neutral-300 text-sm max-w-md mx-auto">
                                Try adjusting your search criteria or browse our
                                popular categories to discover learning
                                opportunities.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3 sm:space-y-4">
                            {/* Compact Results Summary */}
                            <div className="text-[11px] sm:text-xs text-gray-500 dark:text-neutral-400 mb-1">
                                {courseData.totalElements}{" "}
                                {getTerminology(
                                    ContentTerms.Course,
                                    SystemTerms.Course
                                ).toLocaleLowerCase()}
                                s • Page {courseData.number + 1}/{courseData.totalPages} • Showing {courseData.numberOfElements} of {courseData.totalElements}
                            </div>

                            {/* Course Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-3 sm:gap-4">
                                {courseData.content.map((course, index) => {
                                    return (
                                        <CourseCard
                                            key={course.id || index}
                                            courseId={course.id}
                                            package_name={toTitleCase(
                                                course.package_name ||
                                                    "Untitled Package"
                                            )}
                                            level_name={toTitleCase(
                                                course.level_name || "Beginner"
                                            )}
                                            instructors={
                                                course.instructors?.length > 0
                                                    ? course.instructors
                                                    : []
                                            }
                                            description={
                                                course.course_html_description_html ||
                                                fallbackDescription
                                            }
                                            tags={
                                                course.comma_separeted_tags
                                                    ? course.comma_separeted_tags
                                                          .split(",")
                                                          .map((tag: string) => tag.trim())
                                                    : fallbackTags && fallbackTags.trim() !== ""
                                                        ? fallbackTags
                                                              .split(",")
                                                              .map((tag: string) => tag.trim())
                                                        : []
                                            }
                                            previewImageUrl={
                                                course.course_preview_image_media_id ||
                                                ""
                                            }
                                            rating={course.rating || 0}
                                            studentCount={0}
                                            percentageCompleted={
                                                course.percentage_completed || 0
                                            }
                                            selectedTab={selectedTab}
                                            readTimeInMinutes={
                                                course.read_time_in_minutes || 0
                                            }
                                        />
                                    );
                                })}
                            </div>

                            {/* Pagination */}
                            {courseData.totalPages > 1 && (
                                <div className="flex justify-center mt-4 sm:mt-6">
                                    <MyPagination
                                        currentPage={courseData.number + 1}
                                        totalPages={courseData.totalPages}
                                        onPageChange={handlePageChange}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CoursesPage;
