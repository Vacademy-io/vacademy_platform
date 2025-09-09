import { FileText, PresentationChart, Folder, ChalkboardTeacher } from "phosphor-react";
import { Steps } from "@phosphor-icons/react";
import { useEffect } from "react";
import { MyButton } from "@/components/design-system/button";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { CourseDetailsRatingsComponent } from "./course-details-ratings-page";
import { formatTotalCourseDuration, SlideCountEntry } from "@/utils/courseTime";

interface LevelOption {
    _id: string;
    value: string;
    label: string;
}

interface SlideCount {
    source_type: string;
    slide_count: number;
    display_name: string;
}

interface ModuleStats {
    totalModules: number;
    totalChapters: number;
}

interface EnrolledSession {
    id: string;
    session: {
        id: string;
        session_name: string;
        status: string;
        start_date: string;
    };
    level: {
        id: string;
        level_name: string;
        duration_in_days: number | null;
        thumbnail_id: string | null;
    };
    start_time: string | null;
    status: string;
    package_dto: {
        id: string;
        package_name: string;
        thumbnail_id?: string | null;
    };
}

interface CourseSidebarProps {
    hasRightSidebar: boolean;
    levelOptions: LevelOption[];
    selectedLevel: string;
    slideCountQuery: {
        isLoading: boolean;
        error: unknown;
        // data is optional but if present, can be used for precise totals
        data?: Array<{
            slide_count: number;
            total_read_time_minutes: number | null;
            source_type: string;
        }>;
    };
    overviewVisible: boolean;
    processedSlideCounts: SlideCount[];
    moduleStats: ModuleStats;
    currentSubjects: unknown[];
    courseStructure: number;
    instructorsCount: number;
    selectedTab: string;
    selectedSession: string;
    enrolledSessions: EnrolledSession[];
    courseId: string;
    primaryInstructorName?: string;
    paymentType?: string | null;
    packageSessionIdForCurrentLevel?: string | null;
    onEnrollmentClick: () => void;
    onRatingsLoadingChange: (loading: boolean) => void;
}

// Removed per-type slide icon rendering; sidebar now shows only aggregate time

export const CourseSidebar = ({
    hasRightSidebar,
    levelOptions,
    selectedLevel,
    slideCountQuery,
    overviewVisible,
    processedSlideCounts,
    moduleStats,
    currentSubjects,
    courseStructure,
    instructorsCount,
    selectedTab,
    selectedSession,
    enrolledSessions,
    courseId,
    primaryInstructorName,
    packageSessionIdForCurrentLevel,
    onEnrollmentClick,
    onRatingsLoadingChange,
}: CourseSidebarProps) => {
    if (!hasRightSidebar) return null;

    const capitalizeFirst = (text: string): string => {
        if (!text) return text;
        return text.charAt(0).toUpperCase() + text.slice(1);
    };

    const safeEnrolledSessions = enrolledSessions || [];
    const isAlreadyEnrolled = safeEnrolledSessions.some(
        (enrolledSession) =>
            enrolledSession.package_dto.id === courseId &&
            enrolledSession.session.id === selectedSession &&
            enrolledSession.level.id === selectedLevel
    );

    // Compute total duration from either provided raw data or processed counts as fallback
    const totalDuration = (() => {
        const raw = (slideCountQuery as unknown as { data?: SlideCountEntry[] })?.data;
        if (raw && Array.isArray(raw)) {
            return formatTotalCourseDuration(raw);
        }
        // fallback: map processedSlideCounts into SlideCountEntry with null minutes
        const mapped: SlideCountEntry[] = (processedSlideCounts || []).map((c) => ({
            slide_count: c.slide_count,
            total_read_time_minutes: null,
            source_type: c.source_type,
        }));
        return formatTotalCourseDuration(mapped);
    })();

    const displayAuthorName = (() => {
        if (primaryInstructorName && String(primaryInstructorName).trim().length > 0) {
            return primaryInstructorName;
        }
        // Fallback label when instructors exist but no name available in form
        if (instructorsCount > 0) {
            return "Unknown Instructor";
        }
        return undefined;
    })();

    useEffect(() => {
        // We intentionally depend on these to log when inputs change
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [primaryInstructorName, instructorsCount, slideCountQuery?.isLoading, slideCountQuery?.error, (slideCountQuery as unknown as { data?: SlideCountEntry[] })?.data, processedSlideCounts, totalDuration]);

    return (
        <div className="lg:col-span-1">
            <div className="sticky top-4 space-y-4 lg:max-h-[calc(100vh-1rem)] overflow-y-auto">
                <div
                    className="relative bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-all duration-300 p-3 sm:p-4 group animate-fade-in-up"
                    style={{ animationDelay: "0.7s" }}
                >
                    {/* Background gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>

                    {/* Floating orb effect */}
                    <div className="absolute top-0 right-0 w-12 h-12 bg-primary-100/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-y-1 translate-x-3"></div>

                    <div className="relative">
                        {/* Header */}
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="p-1.5 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg shadow-sm">
                                <Steps
                                    size={18}
                                    className="text-primary-600"
                                    weight="duotone"
                                />
                            </div>
                            <h2 className="text-base font-bold text-gray-900">
                                {(() => {
                                    const term = getTerminology(
                                        ContentTerms.Course,
                                        SystemTerms.Course
                                    ).toLocaleLowerCase();
                                    return term.charAt(0).toUpperCase() + term.slice(1);
                                })()}{" "}
                                Overview
                            </h2>
                        </div>

                        {/* Course Stats */}
                        <div className="space-y-3">
                            {/* Author Name (always show row with placeholder if missing) */}
                            <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg">
                                <span className="text-xs font-medium text-gray-700">Author</span>
                                <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded-md shadow-sm">
                                    {displayAuthorName || "—"}
                                </span>
                            </div>
                            {/* Level Badge */}
                            {levelOptions.length > 0 &&
                                selectedLevel &&
                                levelOptions.find(
                                    (option) => option.value === selectedLevel
                                )?.label !== "default" && (
                                    <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg border border-primary-200">
                                        <div className="flex items-center space-x-2">
                                            <Steps
                                                size={16}
                                                className="text-primary-600"
                                                weight="duotone"
                                            />
                                            <span className="text-xs font-medium text-primary-700">
                                                {capitalizeFirst(
                                                    getTerminology(
                                                        ContentTerms.Level,
                                                        SystemTerms.Level
                                                    ).toLocaleLowerCase()
                                                )}
                                            </span>
                                        </div>
                                        <span className="text-xs font-bold text-primary-800">
                                            {capitalizeFirst(
                                                levelOptions.find(
                                                    (option) =>
                                                        option.value === selectedLevel
                                                )?.label || ""
                                            )}
                                        </span>
                                    </div>
                                )}

                            {/* Total Time (hide per-type counts) */}
                            {slideCountQuery.isLoading ? (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg animate-pulse">
                                        <div className="h-3 w-24 bg-gray-200 rounded" />
                                        <div className="h-3 w-10 bg-gray-200 rounded" />
                                    </div>
                                </div>
                            ) : slideCountQuery.error ? (
                                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-xs text-red-600 font-medium">Unable to load total time</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg">
                                        <span className="text-xs font-medium text-gray-700">Course Time</span>
                                        <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded-md shadow-sm">
                                            {totalDuration}
                                        </span>
                                    </div>

                                    {/* Module Statistics */}
                                    {overviewVisible && (
                                        <>
                                            {/* Total Modules */}
                                            {moduleStats.totalModules > 0 && (
                                                <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg hover:bg-gray-100/80 transition-all duration-300 group/item">
                                                    <div className="flex items-center space-x-2">
                                                        <FileText
                                                            size={16}
                                                            className="text-blue-600 group-hover/item:scale-110 transition-transform duration-300"
                                                            weight="duotone"
                                                        />
                                                        <span className="text-xs font-medium text-gray-700">
                                                            {capitalizeFirst(
                                                                getTerminology(
                                                                    ContentTerms.Modules,
                                                                    SystemTerms.Modules
                                                                ).toLocaleLowerCase()
                                                            )}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded-md shadow-sm">
                                                        {moduleStats.totalModules}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Total Chapters */}
                                            {moduleStats.totalChapters > 0 && (
                                                <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg hover:bg-gray-100/80 transition-all duration-300 group/item">
                                                    <div className="flex items-center space-x-2">
                                                        <PresentationChart
                                                            size={16}
                                                            className="text-green-600 group-hover/item:scale-110 transition-transform duration-300"
                                                            weight="duotone"
                                                        />
                                                        <span className="text-xs font-medium text-gray-700">
                                                            {capitalizeFirst(
                                                                getTerminology(
                                                                    ContentTerms.Chapters,
                                                                    SystemTerms.Chapters
                                                                ).toLocaleLowerCase()
                                                            )}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded-md shadow-sm">
                                                        {moduleStats.totalChapters}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Total Subjects (for depth 5) */}
                                            {courseStructure === 5 && currentSubjects.length > 0 && (
                                                <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg hover:bg-gray-100/80 transition-all duration-300 group/item">
                                                    <div className="flex items-center space-x-2">
                                                        <Folder
                                                            size={16}
                                                            className="text-purple-600 group-hover/item:scale-110 transition-transform duration-300"
                                                            weight="duotone"
                                                        />
                                                        <span className="text-xs font-medium text-gray-700">
                                                            {capitalizeFirst(
                                                                getTerminology(
                                                                    ContentTerms.Subjects,
                                                                    SystemTerms.Subjects
                                                                ).toLocaleLowerCase()
                                                            )}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded-md shadow-sm">
                                                        {currentSubjects.length}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Instructors Count */}
                                            {instructorsCount > 0 && (
                                                <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg hover:bg-gray-100/80 transition-all duration-300 group/item">
                                                    <div className="flex items-center space-x-2">
                                                        <ChalkboardTeacher
                                                            size={16}
                                                            className="text-orange-600 group-hover/item:scale-110 transition-transform duration-300"
                                                            weight="duotone"
                                                        />
                                                        <span className="text-xs font-medium text-gray-700">
                                                            Instructors
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded-md shadow-sm">
                                                        {instructorsCount}
                                                    </span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Only show enroll button for ALL tab when user is not enrolled */}
                        {selectedTab === "ALL" &&
                            selectedSession &&
                            selectedLevel &&
                            !isAlreadyEnrolled && (
                                <MyButton
                                    type="button"
                                    scale="large"
                                    buttonType="primary"
                                    layoutVariant="default"
                                    className="mt-2 !min-w-full !w-full text-xs h-8"
                                    onClick={onEnrollmentClick}
                                >
                                    Enroll
                                </MyButton>
                            )}
                    </div>
                </div>

                {/* Ratings & Reviews */}
                {packageSessionIdForCurrentLevel && (
                    <div
                        className="animate-fade-in-up"
                        style={{ animationDelay: "1.0s" }}
                    >
                        <CourseDetailsRatingsComponent
                            packageSessionId={packageSessionIdForCurrentLevel}
                            onLoadingChange={onRatingsLoadingChange}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
