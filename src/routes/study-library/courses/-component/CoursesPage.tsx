import React, { useEffect, useRef } from "react";
import FilterPanel from "./FilterPanel.tsx";
import SearchAndSortBar from "./SearchAndSortBar.tsx";
import CourseCard from "./CourseCards.tsx";
import { MyPagination } from "@/components/design-system/pagination.tsx";
import { CoursePackageResponse } from "@/types/course-catalog/course-catalog-list.ts";
import { Search, BookOpen, Grid } from "lucide-react";

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
    page: number;
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
    page,
    handlePageChange,
    showFilters = true,
    selectedTab,
}) => {
    const fallbackDescription =
        "build responsive scalable and human-like AI application";
    const fallbackTags = "LLMs,Reinforcement Learning";

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
                console.log("No valid file IDs to process");
                return;
            }
        };

        if (courseData.content.length > 0) {
            convertThumbnailsToUrls();
        }
    }, [courseData]);

    return (
        <div ref={scrollRef} className="bg-gray-50 min-h-screen">
            <div className={`flex ${showFilters ? "gap-6" : ""} p-4 max-w-7xl mx-auto`}>
                {/* Sidebar - Only show if showFilters is true */}
                {showFilters && (
                    <div className="w-80 flex-shrink-0">
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
                                toggleItem(
                                    id,
                                    selectedTags,
                                    setSelectedTags
                                )
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
                <div className="flex-1 min-w-0">
                    <SearchAndSortBar
                        searchTerm={searchTerm}
                        onSearchChange={onSearchChange}
                        sortOption={sortOption}
                        onSortChange={onSortChange}
                    />

                    {courseData.content.length === 0 ? (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8 text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
                                <Search size={24} className="text-gray-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                No courses found
                            </h3>
                            <p className="text-gray-600 text-sm max-w-md mx-auto">
                                Try adjusting your search criteria or browse our popular categories to discover learning opportunities.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Results Summary */}
                            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-2 bg-primary-100 rounded-lg">
                                            <Grid size={16} className="text-primary-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">
                                                {courseData.totalElements} courses found
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Page {courseData.number + 1} of {courseData.totalPages}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        Showing {courseData.numberOfElements} of {courseData.totalElements} results
                                    </div>
                                </div>
                            </div>

                            {/* Course Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {courseData.content.map((course, index) => {
                                    return (
                                        <CourseCard
                                            key={course.id || index}
                                            courseId={course.id}
                                            package_name={
                                                course.package_name ||
                                                "Untitled Package"
                                            }
                                            level_name={
                                                course.level_name ||
                                                "Beginner"
                                            }
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
                                                    ? course.comma_separeted_tags.split(",").map(tag => tag.trim())
                                                    : fallbackTags.split(",").map(tag => tag.trim())
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
                                        />
                                    );
                                })}
                            </div>

                            {/* Pagination */}
                            {courseData.totalPages > 1 && (
                                <div className="flex justify-center mt-6">
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
