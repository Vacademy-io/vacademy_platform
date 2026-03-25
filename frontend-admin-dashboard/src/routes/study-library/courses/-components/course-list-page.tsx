import type { AllCourseFilters, AllCoursesApiResponse, CourseInstructor } from './course-material';
import type { CourseItem } from './course-material';
import type { UserRolesDataEntry } from '@/types/dashboard/user-roles';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';
import { StarRatingComponent } from '@/components/common/star-rating-component';
import { MyButton } from '@/components/design-system/button';
import { TrashSimple, Funnel, X } from '@phosphor-icons/react';
import { useNavigate } from '@tanstack/react-router';
import { MyPagination } from '@/components/design-system/pagination';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { convertCapitalToTitleCase } from '@/lib/utils';
import { CourseImageShimmer, InstructorAvatarShimmer } from '@/components/ui/shimmer';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';

interface CourseListPageProps {
    selectedFilters: AllCourseFilters;
    setSelectedFilters: React.Dispatch<React.SetStateAction<AllCourseFilters>>;
    handleClearAll: () => void;
    handleApply: () => void;
    levels: Array<{ id: string; name: string }>;
    handleLevelChange: (levelId: string) => void;
    tags: string[];
    accessControlUsers: UserRolesDataEntry[];
    handleUserChange: (userId: string) => void;
    handleTagChange: (tagValue: string) => void;
    searchValue: string;
    setSearchValue: React.Dispatch<React.SetStateAction<string>>;
    handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    sortBy: string;
    setSortBy: React.Dispatch<React.SetStateAction<string>>;
    allCourses: AllCoursesApiResponse | null;
    courseImageUrls: Record<string, string>;
    instructorProfilePicUrls: Record<string, string>;
    isLoadingImages: boolean;
    handleCourseDelete: (courseId: string) => void;
    page: number;
    handlePageChange: (newPage: number) => void;
    deletingCourseId: string | null;
    showDeleteButton?: boolean;
    /** When true, hide the filters section (e.g. for faculty users with restricted access) */
    hideFilters?: boolean;
}

const CourseListPage = ({
    selectedFilters,
    setSelectedFilters,
    handleClearAll,
    handleApply,
    levels,
    handleLevelChange,
    tags,
    accessControlUsers,
    handleUserChange,
    handleTagChange,
    searchValue,
    setSearchValue,
    handleSearchChange,
    handleSearchKeyDown,
    sortBy,
    setSortBy,
    allCourses,
    courseImageUrls,
    instructorProfilePicUrls,
    isLoadingImages,
    handleCourseDelete,
    page,
    handlePageChange,
    deletingCourseId,
    showDeleteButton = true,
    hideFilters = false,
}: CourseListPageProps) => {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Count active filters
    const activeFilterCount =
        selectedFilters.level_ids.length +
        selectedFilters.tag.length +
        selectedFilters.faculty_ids.length;

    // Filter sidebar content - reused between mobile sheet and desktop sidebar
    const FilterContent = () => (
        <div className="flex h-full flex-col gap-2">
            <div className="mb-2 flex items-center justify-between">
                <div className="text-base font-semibold">Filters</div>
                {activeFilterCount > 0 && (
                    <div className="flex gap-2">
                        <button
                            className="text-xs font-medium text-primary-500 transition-transform hover:underline active:scale-95"
                            onClick={handleClearAll}
                        >
                            Clear All
                        </button>
                        <button
                            className="hover:bg-primary-600 rounded bg-primary-500 px-3 py-1 text-xs font-medium text-white transition-transform active:scale-95"
                            onClick={() => {
                                handleApply();
                                if (isMobile) setIsFilterOpen(false);
                            }}
                        >
                            Apply
                        </button>
                    </div>
                )}
            </div>
            <div className="mb-1 text-sm font-semibold">
                {getTerminology(ContentTerms.Level, SystemTerms.Level)}s
            </div>
            <div className="flex flex-col gap-2">
                {levels.map((level: { id: string; name: string }) => (
                    <label
                        key={level.id}
                        className="group flex cursor-pointer items-center gap-2"
                    >
                        <input
                            type="checkbox"
                            checked={selectedFilters.level_ids.includes(level.id)}
                            onChange={() => handleLevelChange(level.id)}
                            className="scale-110 accent-primary-500 transition-transform"
                        />
                        <span className="transition-colors group-hover:text-primary-500">
                            {convertCapitalToTitleCase(level.name)}
                        </span>
                    </label>
                ))}
            </div>
            {/* Tags Section */}
            {tags.length > 0 && (
                <>
                    <div className="mb-1 mt-4 text-sm font-semibold">
                        {getTerminology(ContentTerms.PopularTag, SystemTerms.PopularTag)}
                    </div>
                    <div className="flex flex-col gap-2">
                        {tags.map((tagValue: string) => (
                            <label
                                key={tagValue}
                                className="group flex cursor-pointer items-center gap-2"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedFilters.tag.includes(tagValue)}
                                    onChange={() => handleTagChange(tagValue)}
                                    className="scale-110 accent-primary-500 transition-transform"
                                />
                                <span className="transition-colors group-hover:text-primary-500">
                                    {convertCapitalToTitleCase(tagValue)}
                                </span>
                            </label>
                        ))}
                    </div>
                </>
            )}
            {/* Users Section */}
            {Array.isArray(accessControlUsers) && accessControlUsers.length > 0 && (
                <>
                    <div className="mb-1 mt-4 text-sm font-semibold">
                        {getTerminology(RoleTerms.Teacher, SystemTerms.Teacher)}s
                    </div>
                    <div className="flex flex-col gap-2">
                        {(accessControlUsers as UserRolesDataEntry[]).map(
                            (user: UserRolesDataEntry) => (
                                <label
                                    key={user.id}
                                    className="group flex cursor-pointer items-center gap-2"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedFilters.faculty_ids.includes(user.id)}
                                        onChange={() => handleUserChange(user.id)}
                                        className="scale-110 accent-primary-500 transition-transform"
                                    />
                                    <span className="transition-colors group-hover:text-primary-500">
                                        {user.full_name}
                                    </span>
                                </label>
                            )
                        )}
                    </div>
                </>
            )}
        </div>
    );

    return (
        <>
            <div className="mt-4 flex w-full flex-col gap-4 lg:mt-6 lg:flex-row lg:gap-6">
                {/* Mobile Filter Button - hidden for faculty users */}
                {!hideFilters && (
                    <div className="flex items-center gap-2 lg:hidden">
                        <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                            <SheetTrigger asChild>
                                <MyButton
                                    buttonType="secondary"
                                    className="flex items-center gap-2"
                                >
                                    <Funnel size={18} />
                                    Filters
                                    {activeFilterCount > 0 && (
                                        <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-primary-500 text-xs text-white">
                                            {activeFilterCount}
                                        </span>
                                    )}
                                </MyButton>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[280px] overflow-y-auto p-4">
                                <SheetHeader className="mb-4">
                                    <SheetTitle>Filter Courses</SheetTitle>
                                </SheetHeader>
                                <FilterContent />
                            </SheetContent>
                        </Sheet>
                    </div>
                )}

                {/* Desktop Filter Section - hidden for faculty users */}
                {!hideFilters && (
                    <div className="animate-fade-in hidden h-fit min-w-[240px] max-w-[260px] flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm lg:flex">
                        <FilterContent />
                    </div>
                )}

                {/* Courses Section */}
                <div className="animate-fade-in flex flex-1 flex-col gap-4">
                    {/* Search and Sort Row */}
                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        {/* Search Bar */}
                        <div className="relative flex-1 sm:max-w-xs">
                            {/* Search Icon */}
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                                <svg
                                    width="18"
                                    height="18"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"
                                    />
                                </svg>
                            </span>
                            <input
                                type="text"
                                value={searchValue}
                                onChange={handleSearchChange}
                                onKeyDown={handleSearchKeyDown}
                                placeholder="Search courses..."
                                className="w-full rounded-md border border-neutral-200 px-9 py-2 text-sm shadow-sm transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                            />
                            {/* Cross Button (visible only if searchValue) */}
                            {searchValue && (
                                <button
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 transition-transform active:scale-95"
                                    aria-label="Clear search"
                                    onClick={() => {
                                        setSearchValue('');
                                        setSelectedFilters((prev) => ({
                                            ...prev,
                                            search_by_name: '',
                                        }));
                                    }}
                                    type="button"
                                >
                                    <svg
                                        width="18"
                                        height="18"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            )}
                        </div>
                        {/* Sort By */}
                        <div className="flex items-center justify-between gap-2 sm:min-w-[180px] sm:justify-end">
                            <span className="text-sm font-medium text-neutral-600">Sort by</span>
                            <Select value={sortBy} onValueChange={setSortBy}>
                                <SelectTrigger className="w-[110px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="oldest">Oldest</SelectItem>
                                    <SelectItem value="newest">Newest</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Course Grid - Responsive columns */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                        {Array.isArray(allCourses?.content) &&
                            (allCourses?.content?.length ?? 0) > 0 ? (
                            allCourses?.content?.map((course: CourseItem) => {
                                const instructors: CourseInstructor[] = course.instructors || [];
                                const tags: string[] = course.comma_separeted_tags
                                    ? course.comma_separeted_tags
                                        .split(',')
                                        .map((t: string) => t.trim())
                                    : [];
                                const displayName = course.package_session_name
                                    ? `${convertCapitalToTitleCase(
                                          course.package_name
                                      )} ${convertCapitalToTitleCase(
                                          course.package_session_name
                                      )}`
                                    : convertCapitalToTitleCase(course.package_name);

                                return (
                                    <div
                                        key={course.id}
                                        className={`animate-fade-in group relative flex h-fit flex-col rounded-lg border border-neutral-200 bg-white p-0 shadow-sm transition-transform duration-500 hover:scale-[1.02] hover:shadow-md sm:hover:scale-[1.025]`}
                                    >
                                        {/* Course Banner Image */}
                                        {isLoadingImages ? (
                                            <CourseImageShimmer />
                                        ) : courseImageUrls[course.id] ? (
                                            <div className="flex size-full w-full items-center justify-center overflow-hidden rounded-lg px-2 pb-0 pt-2 sm:px-3 sm:pt-4">
                                                <img
                                                    src={
                                                        courseImageUrls[course.id] ||
                                                        course.thumbnail_file_id ||
                                                        'https://images.pexels.com/photos/31530661/pexels-photo-31530661.jpeg'
                                                    }
                                                    alt={course.package_name}
                                                    className="rounded-lg bg-white object-cover p-1 transition-transform duration-300 group-hover:scale-105 sm:p-2"
                                                />
                                            </div>
                                        ) : null}
                                        <div className="flex flex-col gap-1 p-3 sm:p-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1 text-base font-extrabold text-neutral-800 sm:text-lg">
                                                    {displayName}
                                                </div>
                                                <div
                                                    className={`flex-shrink-0 rounded-lg bg-gray-100 p-1 px-2 text-xs font-semibold text-gray-700`}
                                                >
                                                    {convertCapitalToTitleCase(course.level_name) ||
                                                        'Level'}
                                                </div>
                                            </div>
                                            {/* Description section */}
                                            <div
                                                className={
                                                    (course.course_html_description_html || '')
                                                        .replace(/<[^>]*>/g, '')
                                                        .slice(0, 120).length > 0
                                                        ? 'mt-1 line-clamp-2 text-xs text-neutral-600 sm:mt-2 sm:text-sm'
                                                        : 'text-xs text-neutral-600 sm:text-sm'
                                                }
                                            >
                                                {(course.course_html_description_html || '')
                                                    .replace(/<[^>]*>/g, '')
                                                    .slice(0, 120)}
                                            </div>
                                            {/* Instructors section */}
                                            <div
                                                className={
                                                    instructors && instructors.length > 0
                                                        ? 'mt-2 flex items-center gap-2'
                                                        : 'flex items-center gap-2'
                                                }
                                            >
                                                {instructors?.map((inst: CourseInstructor) =>
                                                    isLoadingImages ? (
                                                        <InstructorAvatarShimmer key={inst.id} />
                                                    ) : (
                                                        <img
                                                            key={inst.id}
                                                            src={
                                                                instructorProfilePicUrls[inst.id] ||
                                                                'https://randomuser.me/api/portraits/lego/1.jpg'
                                                            }
                                                            alt={inst.full_name}
                                                            className="-ml-2 size-6 rounded-full border border-neutral-200 object-cover first:ml-0 sm:size-7"
                                                        />
                                                    )
                                                )}
                                                <span className="ml-1 truncate text-xs text-neutral-600 sm:ml-2">
                                                    {instructors
                                                        ?.map(
                                                            (inst: CourseInstructor) =>
                                                                inst.full_name
                                                        )
                                                        .join(', ')}
                                                </span>
                                            </div>
                                            {/* Tags section - scrollable on mobile */}
                                            <div
                                                className={
                                                    tags && tags.length > 0
                                                        ? 'no-scrollbar mt-2 flex gap-2 overflow-x-auto'
                                                        : 'flex flex-wrap gap-2'
                                                }
                                            >
                                                {tags?.map((tag: string) => (
                                                    <span
                                                        key={tag}
                                                        className="flex-shrink-0 rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                            {/* Rating section */}
                                            <div
                                                className={
                                                    tags && tags.length > 0
                                                        ? 'my-2 -mb-2 flex items-center gap-2'
                                                        : '-mb-2 flex items-center gap-2'
                                                }
                                            >
                                                <StarRatingComponent
                                                    score={course.rating * 20}
                                                    maxScore={100}
                                                />
                                                <span className="text-neutral-500">
                                                    {(course.rating || 0).toFixed(1)}
                                                </span>
                                            </div>
                                            {/* Catalog/Private status */}
                                            <span className="-mb-3 mt-2 flex items-center gap-1 rounded py-1 text-xs font-medium text-gray-500">
                                                {course.is_course_published_to_catalaouge ? (
                                                    <>
                                                        <Eye className="size-4" /> In Catalog
                                                    </>
                                                ) : (
                                                    <>
                                                        <EyeSlash className="size-4" /> Private
                                                    </>
                                                )}
                                            </span>
                                            {/* View Course Button */}
                                            <div className="mt-3 flex gap-2 sm:mt-4">
                                                <MyButton
                                                    className="flex-1 text-sm"
                                                    buttonType="primary"
                                                    onClick={() =>
                                                        navigate({
                                                            to: '/study-library/courses/course-details',
                                                            search: { courseId: course.id },
                                                        })
                                                    }
                                                >
                                                    View{' '}
                                                    {getTerminology(
                                                        ContentTerms.Course,
                                                        SystemTerms.Course
                                                    )}
                                                </MyButton>
                                                {showDeleteButton && (
                                                    <AlertDialog
                                                        open={
                                                            deletingCourseId === course.id ||
                                                            undefined
                                                        }
                                                        onOpenChange={() => {
                                                            // Only allow closing if not currently deleting
                                                            if (
                                                                !deletingCourseId ||
                                                                deletingCourseId !== course.id
                                                            ) {
                                                                // If parent controls dialog open state, call parent handler here if needed
                                                            }
                                                        }}
                                                    >
                                                        <AlertDialogTrigger className="flex size-9 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-500 transition-colors hover:border-red-300 hover:bg-red-100 active:scale-95">
                                                            <TrashSimple size={18} />
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>
                                                                    Are you sure you want to delete
                                                                    this course?
                                                                </AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    This action cannot be undone.
                                                                    This will permanently delete
                                                                    your course and remove your
                                                                    course data from our servers.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                                                                <AlertDialogCancel
                                                                    disabled={
                                                                        deletingCourseId ===
                                                                        course.id
                                                                    }
                                                                    className="w-full sm:w-auto"
                                                                >
                                                                    Cancel
                                                                </AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    onClick={() =>
                                                                        handleCourseDelete(
                                                                            course.id
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        deletingCourseId ===
                                                                        course.id
                                                                    }
                                                                    className="w-full bg-primary-500 text-white sm:w-auto"
                                                                >
                                                                    {deletingCourseId ===
                                                                        course.id ? (
                                                                        <svg
                                                                            className="animate-spin"
                                                                            width="18"
                                                                            height="18"
                                                                            viewBox="0 0 24 24"
                                                                            fill="none"
                                                                            xmlns="http://www.w3.org/2000/svg"
                                                                        >
                                                                            <circle
                                                                                cx="12"
                                                                                cy="12"
                                                                                r="10"
                                                                                stroke="#ef4444"
                                                                                strokeWidth="4"
                                                                                strokeDasharray="60"
                                                                                strokeDashoffset="20"
                                                                            />
                                                                        </svg>
                                                                    ) : (
                                                                        'Confirm'
                                                                    )}
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="col-span-full py-8 text-center text-neutral-400">
                                No courses found.
                            </div>
                        )}
                    </div>
                    <MyPagination
                        currentPage={page}
                        totalPages={allCourses?.totalPages || 0}
                        onPageChange={handlePageChange}
                    />
                </div>
            </div>
        </>
    );
};

export default CourseListPage;
