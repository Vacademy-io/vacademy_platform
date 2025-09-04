import { GraduationCap } from "phosphor-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { MyButton } from "@/components/design-system/button";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";

interface SessionOption {
    _id: string;
    value: string;
    label: string;
}

interface LevelOption {
    _id: string;
    value: string;
    label: string;
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

interface CourseConfigurationProps {
    showCourseConfiguration: boolean;
    selectedTab: string;
    selectedSession: string;
    selectedLevel: string;
    sessionOptions: SessionOption[];
    levelOptions: LevelOption[];
    enrolledSessions: EnrolledSession[];
    courseId: string;
    paymentType: string;
    onSessionChange: (value: string) => void;
    onLevelChange: (value: string) => void;
    onEnrollmentClick: () => void;
    onDonationClick: () => void;
}

export const CourseConfiguration = ({
    showCourseConfiguration,
    selectedTab,
    selectedSession,
    selectedLevel,
    sessionOptions,
    levelOptions,
    enrolledSessions,
    courseId,
    paymentType,
    onSessionChange,
    onLevelChange,
    onEnrollmentClick,
    onDonationClick,
}: CourseConfigurationProps) => {
    if (!showCourseConfiguration) return null;

    const safeEnrolledSessions = enrolledSessions || [];
    const isEnrolledInCourse = safeEnrolledSessions.some(
        (enrolledSession) => enrolledSession.package_dto.id === courseId
    );

    return (
        <div
            className="relative bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-all duration-200 p-3 sm:p-4 group animate-fade-in-up"
            style={{ animationDelay: "0.1s" }}
        >
            {/* Background gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>

            {/* Floating orb effect */}
            <div className="absolute top-0 right-0 w-12 h-12 bg-primary-100/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-y-1 translate-x-3"></div>

            <div className="relative">
                <div className="flex items-center space-x-2 mb-3">
                    <div className="p-1.5 bg-gradient-to-br from-primary-100 to-primary-200 rounded-md shadow-sm">
                        <GraduationCap
                            size={18}
                            className="text-primary-600"
                            weight="duotone"
                        />
                    </div>
                    <h3 className="text-base font-bold text-gray-900">
                        {getTerminology(
                            ContentTerms.Course,
                            SystemTerms.Course
                        )}{" "}
                        Configuration
                    </h3>
                </div>

                {sessionOptions && sessionOptions.length > 0 ? (
                    <div>
                        {/* Preview notice for ALL tab - only show if user is not enrolled */}
                        {selectedTab === "ALL" && !isEnrolledInCourse && (
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-sm"></div>
                                    <span className="text-sm font-medium text-blue-800">
                                        {getTerminology(
                                            ContentTerms.Course,
                                            SystemTerms.Course
                                        )}{" "}
                                        Preview Mode
                                    </span>
                                </div>
                                <p className="text-xs text-blue-700 mt-1">
                                    Browse{" "}
                                    {getTerminology(
                                        ContentTerms.Course,
                                        SystemTerms.Course
                                    ).toLocaleLowerCase()}{" "}
                                    structure. Enroll to access{" "}
                                    {getTerminology(
                                        ContentTerms.Slides,
                                        SystemTerms.Slides
                                    ).toLocaleLowerCase()}
                                    s and materials.
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                            {/* Session Selector */}
                            {sessionOptions &&
                                sessionOptions.length > 0 &&
                                // Hide if only one and label is 'default'
                                (sessionOptions.length === 1 &&
                                sessionOptions[0].label === "default" ? null : sessionOptions.length === 1 ? (
                                    <div className="p-2.5 bg-gray-50/80 rounded-lg border border-gray-200">
                                        <span className="text-sm font-medium text-gray-900">
                                            {sessionOptions[0]?.label}
                                        </span>
                                    </div>
                                ) : sessionOptions.length > 1 ? (
                                    <div className="flex flex-col gap-2">
                                        <Select
                                            value={selectedSession}
                                            onValueChange={onSessionChange}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Session" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {sessionOptions.map((option) => (
                                                    <SelectItem
                                                        key={option._id}
                                                        value={option.value}
                                                    >
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ) : null)}

                            {/* Level Selector */}
                            {levelOptions &&
                                levelOptions.length > 0 &&
                                // Hide if only one and label is 'default'
                                (levelOptions.length === 1 &&
                                levelOptions[0].label === "default" ? null : levelOptions.length === 1 ? (
                                    <div className="p-2.5 bg-gray-50/80 rounded-lg border border-gray-200">
                                        <span className="text-sm font-medium text-gray-900">
                                            {levelOptions[0]?.label}
                                        </span>
                                    </div>
                                ) : levelOptions.length > 1 ? (
                                    <div className="flex flex-col gap-2">
                                        <Select
                                            value={selectedLevel}
                                            onValueChange={onLevelChange}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Level" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {levelOptions.map((option) => (
                                                    <SelectItem
                                                        key={option._id}
                                                        value={option.value}
                                                    >
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ) : null)}
                        </div>

                        {/* Enroll Button */}
                        {selectedSession && selectedLevel && (
                            <div className="mt-4">
                                {(() => {
                                    const isAlreadyEnrolled = safeEnrolledSessions.some(
                                        (enrolledSession) =>
                                            enrolledSession.package_dto.id === courseId &&
                                            enrolledSession.session.id === selectedSession &&
                                            enrolledSession.level.id === selectedLevel
                                    );

                                    if (isAlreadyEnrolled) {
                                        return (
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
                                        );
                                    }

                                    return (
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
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <p className="text-sm text-gray-500">
                            No sessions available for this{" "}
                            {getTerminology(
                                ContentTerms.Course,
                                SystemTerms.Course
                            ).toLocaleLowerCase()}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
