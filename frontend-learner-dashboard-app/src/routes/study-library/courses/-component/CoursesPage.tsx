import React, { useEffect, useRef, useState } from "react";
import FilterPanel from "./FilterPanel.tsx";
import SearchAndSortBar from "./SearchAndSortBar.tsx";
import CourseCard from "./CourseCards.tsx";
import Pagination from "./Pagination.tsx";
import { CoursePackageResponse } from "@/types/course-catalog/course-catalog-list.ts";
import { Search } from "lucide-react";
import { cn, toTitleCase } from "@/lib/utils";
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
    isLoading?: boolean;
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
    isLoading = false,
}) => {
    const fallbackDescription =
        "";
    const fallbackTags: string = "";

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const filterPanelRef = useRef<HTMLDivElement | null>(null);
    const [isSticky, setIsSticky] = useState(false);
    const [filterPanelWidth, setFilterPanelWidth] = useState(0);
    const [filterPanelLeft, setFilterPanelLeft] = useState(0);

    // Smooth scroll on page change and dev log
    useEffect(() => {
        if (import.meta.env.DEV) {
            console.debug("[CoursesPage] page changed", {
                page: courseData.number,
                totalPages: courseData.totalPages,
                totalElements: courseData.totalElements,
            });
        }
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }
    }, [courseData.number, courseData.totalPages, courseData.totalElements]);

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

    // Sticky filter panel logic
    useEffect(() => {
        if (!showFilters || !filterPanelRef.current) return;

        const handleScroll = () => {
            if (!filterPanelRef.current) return;

            const rect = filterPanelRef.current.getBoundingClientRect();
            const scrollTop = window.scrollY || document.documentElement.scrollTop;

            // Check if we're on desktop (lg breakpoint is 1024px)
            if (window.innerWidth < 1024) {
                setIsSticky(false);
                return;
            }

            // Navbar is approximately 80px, start sticking when scrolled past initial position
            if (scrollTop > 150) {
                if (!isSticky) {
                    setFilterPanelWidth(rect.width);
                    setFilterPanelLeft(rect.left);
                    setIsSticky(true);
                }
            } else {
                setIsSticky(false);
            }
        };

        const handleResize = () => {
            if (filterPanelRef.current && !isSticky) {
                const rect = filterPanelRef.current.getBoundingClientRect();
                setFilterPanelWidth(rect.width);
                setFilterPanelLeft(rect.left);
            }
        };

        // Initial calculation
        handleResize();
        handleScroll();

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleResize);
        };
    }, [showFilters, isSticky]);

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
            className="w-full"
        >
            <div
                className={`flex flex-col lg:flex-row lg:items-start ${showFilters ? "gap-4 lg:gap-6" : ""} mx-auto relative`}
            >
                {/* Sidebar - Only show if showFilters is true */}
                {showFilters && (
                    <>
                        {/* Spacer to maintain layout when filter panel becomes fixed */}
                        {isSticky && (
                            <div
                                className="hidden lg:block flex-shrink-0"
                                style={{ width: '20rem' }}
                            />
                        )}
                        <aside
                            ref={filterPanelRef}
                            className="w-full flex-shrink-0"
                            style={{
                                position: isSticky ? 'fixed' : 'static',
                                top: isSticky ? '5rem' : 'auto',
                                left: isSticky ? `${filterPanelLeft}px` : 'auto',
                                width: isSticky ? `${filterPanelWidth}px` : '100%',
                                maxWidth: '20rem',
                                maxHeight: isSticky ? 'calc(100vh - 6rem)' : 'none',
                                overflowY: isSticky ? 'auto' : 'visible',
                                zIndex: isSticky ? 10 : 'auto'
                            }}
                        >
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
                        </aside>
                    </>
                )}

                {/* Main Content Area */}
                <div className="flex-1 min-w-0">
                    <SearchAndSortBar
                        searchTerm={searchTerm}
                        onSearchChange={onSearchChange}
                        sortOption={sortOption}
                        onSortChange={onSortChange}
                    />

                    {isLoading ? (
                        <div className={cn(
                            "bg-card border rounded-md shadow-sm p-5 sm:p-6",
                            // Vibrant Styles
                            "[.ui-vibrant_&]:shadow-sm [.ui-vibrant_&]:border-primary/20",
                            "[.ui-vibrant_&]:bg-gradient-to-br [.ui-vibrant_&]:from-card [.ui-vibrant_&]:to-primary/5",
                            // Play Styles — solid, bold, Duolingo-style
                            "[.ui-play_&]:!bg-primary-50 [.ui-play_&]:border-2 [.ui-play_&]:!border-primary-200 [.ui-play_&]:rounded-2xl",
                            "[.ui-play_&]:shadow-[0_4px_0_hsl(var(--primary-200))]"
                        )}>
                            <div className="animate-pulse space-y-3 sm:space-y-4">
                                <div className="h-4 bg-muted rounded w-1/3"></div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="bg-muted/10 border rounded-md p-3 sm:p-4">
                                            <div className="h-32 sm:h-36 bg-muted rounded mb-3"></div>
                                            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                                            <div className="h-3 bg-muted rounded w-1/2"></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : courseData.content.length === 0 ? (
                        <div className={cn(
                            "bg-card border rounded-md shadow-sm p-5 sm:p-6 text-center",
                            // Vibrant Styles
                            "[.ui-vibrant_&]:shadow-sm [.ui-vibrant_&]:border-primary/20",
                            "[.ui-vibrant_&]:bg-gradient-to-br [.ui-vibrant_&]:from-card [.ui-vibrant_&]:to-primary/5",
                            // Play Styles — solid, bold, Duolingo-style
                            "[.ui-play_&]:!bg-primary-50 [.ui-play_&]:border-2 [.ui-play_&]:!border-primary-200 [.ui-play_&]:rounded-2xl",
                            "[.ui-play_&]:shadow-[0_4px_0_hsl(var(--primary-200))]"
                        )}>
                            <div className={cn(
                                "w-12 h-12 sm:w-16 sm:h-16 bg-muted rounded-md mx-auto mb-3 sm:mb-4 flex items-center justify-center",
                                "[.ui-vibrant_&]:bg-primary/10",
                                // Play Styles
                                "[.ui-play_&]:bg-[#58cc02] [.ui-play_&]:rounded-xl"
                            )}>
                                <Search
                                    size={20}
                                    className={cn(
                                        "text-muted-foreground sm:w-6 sm:h-6",
                                        "[.ui-vibrant_&]:text-primary",
                                        // Play Styles
                                        "[.ui-play_&]:text-white"
                                    )}
                                />
                            </div>
                            <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
                                No{" "}
                                {getTerminology(
                                    ContentTerms.Course,
                                    SystemTerms.Course
                                ).toLocaleLowerCase()}
                                s found
                            </h3>
                            <p className="text-muted-foreground text-sm max-w-md mx-auto">
                                Try adjusting your search criteria or browse our
                                popular categories to discover learning
                                opportunities.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3 sm:space-y-4">
                            {/* Compact Results Summary */}
                            <div className="text-[11px] sm:text-xs text-muted-foreground mb-1">
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
                                            key={`${course.id || "no-id"}-${index}`}
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
                                            packageSessionId={course.package_session_id || undefined}
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

                            {/* Pagination: API uses 0-based page (0, 1, 2...), UI shows 1-based (1, 2, 3...) */}
                            {courseData.totalPages > 1 && (
                                <div className="flex justify-center mt-4 sm:mt-6">
                                    <Pagination
                                        currentPage={courseData.number + 1}
                                        totalPages={courseData.totalPages}
                                        onPageChange={(page) => handlePageChange(page - 1)}
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
