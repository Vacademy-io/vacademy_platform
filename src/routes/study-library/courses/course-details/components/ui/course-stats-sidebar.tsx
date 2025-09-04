import { ChartBar, GraduationCap } from "phosphor-react";
import { MyButton } from "@/components/design-system/button";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";

interface LevelOption {
    _id: string;
    value: string;
    label: string;
}

interface ModuleStats {
    totalModules: number;
    totalChapters: number;
    totalSlides: number;
    completedModules: number;
    completedChapters: number;
    completedSlides: number;
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
    start_time: string;
    status: string;
    package_dto: {
        id: string;
        package_name: string;
        thumbnail_id: string | null;
    };
}

interface CourseStatsSidebarProps {
    hasRightSidebar: boolean;
    selectedLevel: string;
    levelOptions: LevelOption[];
    moduleStats: ModuleStats;
    enrolledSessions: EnrolledSession[];
    courseId: string;
    selectedSession: string;
    selectedTab: string;
    paymentType: string;
    onEnrollmentClick: () => void;
    onDonationClick: () => void;
}

export const CourseStatsSidebar = ({
    hasRightSidebar,
    selectedLevel,
    levelOptions,
    moduleStats,
    enrolledSessions,
    courseId,
    selectedSession,
    selectedTab,
    paymentType,
    onEnrollmentClick,
    onDonationClick,
}: CourseStatsSidebarProps) => {
    if (!hasRightSidebar) return null;

    const safeEnrolledSessions = enrolledSessions || [];
    const isAlreadyEnrolled = safeEnrolledSessions.some(
        (enrolledSession) =>
            enrolledSession.package_dto.id === courseId &&
            enrolledSession.session.id === selectedSession &&
            enrolledSession.level.id === selectedLevel
    );

    return (
        <div className="lg:col-span-1">
            <div className="sticky top-4 space-y-4">
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
                                <ChartBar
                                    size={18}
                                    className="text-primary-600"
                                    weight="duotone"
                                />
                            </div>
                            <h2 className="text-base font-bold text-gray-900">
                                {getTerminology(
                                    ContentTerms.Course,
                                    SystemTerms.Course
                                ).toLocaleLowerCase()}{" "}
                                Overview
                            </h2>
                        </div>

                        {/* Course Stats */}
                        <div className="space-y-3">
                            {/* Level Badge */}
                            {levelOptions.length > 0 &&
                                selectedLevel &&
                                levelOptions.find(
                                    (option) => option.value === selectedLevel
                                ) && (
                                    <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg hover:bg-gray-100/80 transition-all duration-300 group/item">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                                            <span className="text-sm font-medium text-gray-700">
                                                Level
                                            </span>
                                        </div>
                                        <span className="text-sm font-semibold text-gray-900">
                                            {levelOptions.find(
                                                (option) => option.value === selectedLevel
                                            )?.label}
                                        </span>
                                    </div>
                                )}

                            {/* Module Stats */}
                            {moduleStats.totalModules > 0 && (
                                <>
                                    {/* Total Modules */}
                                    <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg hover:bg-gray-100/80 transition-all duration-300 group/item">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                            <span className="text-sm font-medium text-gray-700">
                                                {getTerminology(
                                                    ContentTerms.Modules,
                                                    SystemTerms.Modules
                                                )}
                                            </span>
                                        </div>
                                        <span className="text-sm font-semibold text-gray-900">
                                            {moduleStats.totalModules}
                                        </span>
                                    </div>

                                    {/* Total Chapters */}
                                    {moduleStats.totalChapters > 0 && (
                                        <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg hover:bg-gray-100/80 transition-all duration-300 group/item">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                <span className="text-sm font-medium text-gray-700">
                                                    {getTerminology(
                                                        ContentTerms.Chapters,
                                                        SystemTerms.Chapters
                                                    )}
                                                </span>
                                            </div>
                                            <span className="text-sm font-semibold text-gray-900">
                                                {moduleStats.totalChapters}
                                            </span>
                                        </div>
                                    )}

                                    {/* Total Slides */}
                                    {moduleStats.totalSlides > 0 && (
                                        <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg hover:bg-gray-100/80 transition-all duration-300 group/item">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                                <span className="text-sm font-medium text-gray-700">
                                                    {getTerminology(
                                                        ContentTerms.Slides,
                                                        SystemTerms.Slides
                                                    )}
                                                </span>
                                            </div>
                                            <span className="text-sm font-semibold text-gray-900">
                                                {moduleStats.totalSlides}
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Progress Stats (only show if user is enrolled) */}
                            {isAlreadyEnrolled && (
                                <>
                                    {/* Completed Modules */}
                                    {moduleStats.completedModules > 0 && (
                                        <div className="flex items-center justify-between p-2.5 bg-emerald-50/80 rounded-lg hover:bg-emerald-100/80 transition-all duration-300 group/item">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                                <span className="text-sm font-medium text-emerald-700">
                                                    Completed{" "}
                                                    {getTerminology(
                                                        ContentTerms.Modules,
                                                        SystemTerms.Modules
                                                    )}
                                                </span>
                                            </div>
                                            <span className="text-sm font-semibold text-emerald-900">
                                                {moduleStats.completedModules}
                                            </span>
                                        </div>
                                    )}

                                    {/* Completed Chapters */}
                                    {moduleStats.completedChapters > 0 && (
                                        <div className="flex items-center justify-between p-2.5 bg-emerald-50/80 rounded-lg hover:bg-emerald-100/80 transition-all duration-300 group/item">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                                <span className="text-sm font-medium text-emerald-700">
                                                    Completed{" "}
                                                    {getTerminology(
                                                        ContentTerms.Chapters,
                                                        SystemTerms.Chapters
                                                    )}
                                                </span>
                                            </div>
                                            <span className="text-sm font-semibold text-emerald-900">
                                                {moduleStats.completedChapters}
                                            </span>
                                        </div>
                                    )}

                                    {/* Completed Slides */}
                                    {moduleStats.completedSlides > 0 && (
                                        <div className="flex items-center justify-between p-2.5 bg-emerald-50/80 rounded-lg hover:bg-emerald-100/80 transition-all duration-300 group/item">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                                <span className="text-sm font-medium text-emerald-700">
                                                    Completed{" "}
                                                    {getTerminology(
                                                        ContentTerms.Slides,
                                                        SystemTerms.Slides
                                                    )}
                                                </span>
                                            </div>
                                            <span className="text-sm font-semibold text-emerald-900">
                                                {moduleStats.completedSlides}
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Enroll Button */}
                        {selectedSession && selectedLevel && selectedTab === "ALL" && !isAlreadyEnrolled && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <MyButton
                                    type="button"
                                    scale="large"
                                    buttonType="primary"
                                    layoutVariant="default"
                                    className="!min-w-full !w-full text-xs h-8"
                                    onClick={() => {
                                        console.log('Enrollment button clicked, payment type:', paymentType);
                                        // Check payment type first - if not donation, use enrollment dialog
                                        if (paymentType && paymentType.toLowerCase() !== 'donation') {
                                            console.log('Non-donation payment type, opening enrollment dialog');
                                            onEnrollmentClick();
                                        } else {
                                            console.log('Donation payment type, opening donation dialog');
                                            onDonationClick();
                                        }
                                    }}
                                >
                                    Enroll
                                </MyButton>
                            </div>
                        )}

                        {/* Already Enrolled Message */}
                        {isAlreadyEnrolled && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-green-500 rounded-sm"></div>
                                        <span className="text-sm font-medium text-green-800">
                                            You are enrolled in this{" "}
                                            {getTerminology(
                                                ContentTerms.Course,
                                                SystemTerms.Course
                                            ).toLocaleLowerCase()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
