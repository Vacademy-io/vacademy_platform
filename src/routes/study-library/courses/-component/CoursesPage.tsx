import React, { useEffect, useState, useRef } from "react";
import FilterPanel from "./FilterPanel.tsx";
import SearchAndSortBar from "./SearchAndSortBar.tsx";
import CourseCard from "./CourseCards.tsx";
import { getPublicUrl } from "@/services/upload_file";
import { MyPagination } from "@/components/design-system/pagination.tsx";
import { CoursePackageResponse } from "@/types/course-catalog/course-catalog-list.ts";
import { Search, BookOpen } from 'lucide-react';

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
}) => {
    const [thumbnailUrls, setThumbnailUrls] = useState<(string | null)[]>([]);

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

            // Initialize with empty array
            const initialUrls = new Array(courseData.content.length).fill(null);
            setThumbnailUrls(initialUrls);

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

            console.log("Using individual image loading...");

            const imageUrlPromises = validFileIds.map(async (item) => {
                try {
                    console.log(`Loading image for fileId: ${item.fileId}`);
                    const url = await getPublicUrl(item.fileId);
                    if (
                        url &&
                        typeof url === "string" &&
                        url.trim() !== "" &&
                        url !== "null" &&
                        url !== "undefined"
                    ) {
                        return { index: item.index, url };
                    } else {
                        return { index: item.index, url: null };
                    }
                } catch (error) {
                    console.log(error);
                    return { index: item.index, url: null };
                }
            });

            const results = await Promise.allSettled(imageUrlPromises);

            setThumbnailUrls((prevUrls) => {
                const newUrls = [...prevUrls];
                results.forEach((result) => {
                    if (result.status === "fulfilled" && result.value) {
                        newUrls[result.value.index] = result.value.url;
                    }
                });
                return newUrls;
            });
        };

        if (courseData.content.length > 0) {
            convertThumbnailsToUrls();
        }
    }, [courseData]);

    return (
        <div ref={scrollRef} className="min-h-screen bg-gradient-to-br from-gray-50/80 via-white to-primary-50/20 relative overflow-hidden w-full max-w-full">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-32 md:w-64 h-32 md:h-64 bg-gradient-to-br from-primary-100/20 to-transparent rounded-full blur-3xl animate-gentle-pulse"></div>
                <div className="absolute bottom-1/3 right-1/3 w-40 md:w-80 h-40 md:h-80 bg-gradient-to-br from-primary-50/30 to-transparent rounded-full blur-3xl animate-gentle-pulse" style={{ animationDelay: '2s' }}></div>
            </div>

            <div className={`relative z-10 flex flex-col ${showFilters ? 'xl:flex-row' : ''} gap-3 lg:gap-4 p-2 sm:p-3 lg:p-4 max-w-7xl mx-auto w-full`}>
                {/* Sidebar - Only show if showFilters is true */}
                {showFilters && (
                    <div className="w-full xl:w-1/4 xl:max-w-sm flex-shrink-0">
                        <div className="xl:sticky xl:top-8 animate-fade-in-up">
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
                    </div>
                )}

                {/* Main Content Area */}
                <div className="flex-1 min-w-0 w-full">
                    <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                        <SearchAndSortBar
                            searchTerm={searchTerm}
                            onSearchChange={onSearchChange}
                            sortOption={sortOption}
                            onSortChange={onSortChange}
                        />
                    </div>

                    {courseData.content.length === 0 ? (
                        <div className="relative bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-2xl shadow-sm p-6 sm:p-8 text-center animate-fade-in-up overflow-hidden" style={{ animationDelay: '0.4s' }}>
                            {/* Background pattern */}
                            <div className="absolute inset-0 bg-gradient-to-br from-gray-50/30 via-transparent to-primary-50/20 pointer-events-none"></div>
                            
                            <div className="relative">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-primary-100 to-primary-200 rounded-2xl mx-auto mb-4 sm:mb-6 flex items-center justify-center">
                                    <Search size={32} className="text-primary-600" />
                                </div>
                                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">No courses found</h3>
                                <p className="text-gray-600 text-sm sm:text-base leading-relaxed max-w-md mx-auto">
                                    Try adjusting your search criteria or browse our popular categories to discover amazing learning opportunities.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 sm:space-y-4">
                            {/* Results Summary */}
                            <div className="bg-white/50 backdrop-blur-sm border border-gray-200/60 rounded-xl p-3 sm:p-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-2 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg">
                                            <BookOpen size={16} className="text-primary-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">
                                                {courseData.totalElements} courses found
                                            </p>
                                            <p className="text-xs text-gray-600">
                                                Page {courseData.number + 1} of {courseData.totalPages}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2 text-xs text-gray-600">
                                        <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></div>
                                        <span>Updated recently</span>
                                    </div>
                                </div>
                            </div>

                            {/* Course Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-5 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                                {courseData.content.map((course, index) => {
                                    const currentUrl = thumbnailUrls[index];
                                    return (
                                        <div
                                            key={course.id || index}
                                            className="animate-fade-in-up"
                                            style={{ animationDelay: `${0.5 + index * 0.1}s` }}
                                        >
                                            <CourseCard
                                                courseId={course.id}
                                                package_name={
                                                    course.package_name ||
                                                    "Untitled Package"
                                                }
                                                level_name={
                                                    course.level_name || "Beginner"
                                                }
                                                thumbnailUrl={currentUrl}
                                                instructors={
                                                    course.instructors?.length
                                                        ? course.instructors
                                                        : []
                                                }
                                                rating={course.rating || 4}
                                                description={
                                                    course.course_html_description_html ||
                                                    fallbackDescription
                                                }
                                                tags={
                                                    course.comma_separeted_tags
                                                        ? course.comma_separeted_tags
                                                              .split(",")
                                                              .map((tag: string) =>
                                                                  tag.trim()
                                                              )
                                                        : fallbackTags
                                                              .split(",")
                                                              .map((tag: string) =>
                                                                  tag.trim()
                                                              )
                                                }
                                                previewImageUrl={
                                                    course.course_preview_image_media_id
                                                }
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Pagination */}
                            {courseData.content.length > 0 && courseData.totalPages > 1 && (
                                <div className="bg-white/50 backdrop-blur-sm border border-gray-200/60 rounded-xl p-3 sm:p-4 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
                                    <MyPagination
                                        currentPage={page}
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
