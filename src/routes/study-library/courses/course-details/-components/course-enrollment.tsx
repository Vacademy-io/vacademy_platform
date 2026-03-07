import { GraduationCap } from "@phosphor-icons/react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, RoleTerms, SystemTerms } from "@/types/naming-settings";

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

interface BatchOption {
    id: string;
    label: string;
    isParent: boolean;
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

interface CourseEnrollmentProps {
    showCourseConfiguration: boolean;
    selectedTab: string;
    sessionOptions: SessionOption[];
    levelOptions: LevelOption[];
    batchOptions: BatchOption[];
    selectedSession: string;
    selectedLevel: string;
    selectedBatchId: string;
    shouldShowBatchDropdown: boolean;
    enrolledSessions: EnrolledSession[];
    courseId: string;
    hasRightSidebar: boolean;
    paymentType?: string | null;
    certificateUrl?: string | null;
    onSessionChange: (value: string) => void;
    onLevelChange: (value: string) => void;
    onBatchChange: (value: string) => void;
    onEnrollmentClick: () => void;
}

export const CourseEnrollment = ({
    showCourseConfiguration,
    selectedTab,
    sessionOptions,
    levelOptions,
    batchOptions,
    selectedSession,
    selectedLevel,
    selectedBatchId,
    shouldShowBatchDropdown,
    enrolledSessions,
    courseId,
    hasRightSidebar,
    paymentType,
    certificateUrl,
    onSessionChange,
    onLevelChange,
    onBatchChange,
    onEnrollmentClick,
}: CourseEnrollmentProps) => {
    if (!showCourseConfiguration) return null;

    const safeEnrolledSessions = enrolledSessions || [];
    const isEnrolledInCourse = safeEnrolledSessions.some(
        (enrolledSession) => enrolledSession.package_dto.id === courseId
    );

    return (
        <Card
            className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg animate-fade-in-up border-border/60"
            style={{ animationDelay: "0.1s" }}
        >
            {/* Background gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

            {/* Floating orb effect */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-y-1 translate-x-3 pointer-events-none"></div>

            <CardHeader className="pb-3 md:pb-4 space-y-0">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary/10 rounded-lg shadow-sm ring-1 ring-primary/20">
                        <GraduationCap
                            size={20}
                            className="text-primary"
                            weight="duotone"
                        />
                    </div>
                    <CardTitle className="text-base md:text-lg font-bold">
                        {getTerminology(ContentTerms.Course, SystemTerms.Course)}{" "}
                        Configuration
                    </CardTitle>
                </div>
            </CardHeader>

            <CardContent>
                {sessionOptions && sessionOptions.length > 0 ? (
                    <div className="space-y-4">
                        {/* Preview notice for ALL tab - only show if user is not enrolled */}
                        {selectedTab === "ALL" && !isEnrolledInCourse && (
                            <div className="p-3 bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
                                <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-300 font-medium mb-1">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                    <span>
                                        {getTerminology(
                                            ContentTerms.Course,
                                            SystemTerms.Course
                                        )}{" "}
                                        Preview Mode
                                    </span>
                                </div>
                                <p className="text-blue-600/90 dark:text-blue-400 pl-3.5 text-xs leading-relaxed">
                                    Browse structure. Enroll to access{" "}
                                    {getTerminology(
                                        ContentTerms.Slides,
                                        SystemTerms.Slides
                                    ).toLocaleLowerCase()}
                                    s and materials.
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Session Selector */}
                            {sessionOptions &&
                                sessionOptions.length > 0 &&
                                (sessionOptions.length === 1 &&
                                    sessionOptions[0].label === "default" ? null : sessionOptions.length === 1 ? (
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-xs font-medium text-muted-foreground ml-1">Session</span>
                                            <div className="px-3 py-2.5 bg-muted/50 rounded-md border text-sm font-medium">
                                                {sessionOptions[0]?.label}
                                            </div>
                                        </div>
                                    ) : sessionOptions.length > 1 ? (
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-xs font-medium text-muted-foreground ml-1">Session</span>
                                            <Select
                                                value={selectedSession}
                                                onValueChange={onSessionChange}
                                            >
                                                <SelectTrigger className="w-full bg-background">
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
                                (levelOptions.length === 1 &&
                                    levelOptions[0].label === "default" ? null : levelOptions.length === 1 ? (
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-xs font-medium text-muted-foreground ml-1">Level</span>
                                            <div className="px-3 py-2.5 bg-muted/50 rounded-md border text-sm font-medium">
                                                {levelOptions[0]?.label}
                                            </div>
                                        </div>
                                    ) : levelOptions.length > 1 ? (
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-xs font-medium text-muted-foreground ml-1">Level</span>
                                            <Select
                                                value={selectedLevel}
                                                onValueChange={onLevelChange}
                                                disabled={!selectedSession}
                                            >
                                                <SelectTrigger className="w-full bg-background">
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

                            {/* Batch / Subgroup Selector - only when child subgroups exist */}
                            {shouldShowBatchDropdown &&
                                batchOptions.length > 0 &&
                                selectedSession &&
                                selectedLevel && (
                                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                                        <span className="text-xs font-medium text-muted-foreground ml-1">
                                            Class / Section
                                        </span>
                                        <Select
                                            value={selectedBatchId}
                                            onValueChange={onBatchChange}
                                        >
                                            <SelectTrigger className="w-full bg-background">
                                                <SelectValue placeholder="Select class or section" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {batchOptions.map((option) => (
                                                    <SelectItem
                                                        key={option.id}
                                                        value={option.id}
                                                    >
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                        </div>
                    </div>
                ) : (
                    <div className="p-4 bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <div className="flex items-center space-x-2 mb-1.5">
                            <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>
                            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                {selectedTab === "ALL"
                                    ? `No active ${getTerminology(
                                        ContentTerms.Session,
                                        SystemTerms.Session
                                    ).toLocaleLowerCase()}s`
                                    : `Not enrolled`}
                            </span>
                        </div>
                        <p className="text-xs text-yellow-700 dark:text-yellow-400 pl-3.5 leading-relaxed">
                            {selectedTab === "ALL"
                                ? `This ${getTerminology(
                                    ContentTerms.Course,
                                    SystemTerms.Course
                                ).toLocaleLowerCase()} requires configuration.`
                                : `Please contact your ${getTerminology(
                                    RoleTerms.Teacher,
                                    SystemTerms.Teacher
                                ).toLocaleLowerCase()} to get enrolled.`}
                        </p>
                    </div>
                )}

                {/* Inline Enroll card when sidebar is hidden */}
                {!hasRightSidebar &&
                    selectedTab === "ALL" &&
                    (() => {
                        if (!selectedSession || !selectedLevel)
                            return null;
                        const safeEnrolledSessions = enrolledSessions || [];
                        const isAlreadyEnrolled =
                            safeEnrolledSessions.some(
                                (enrolledSession) =>
                                    enrolledSession.package_dto.id === courseId &&
                                    enrolledSession.session.id === selectedSession &&
                                    enrolledSession.level.id === selectedLevel &&
                                    (!selectedBatchId || enrolledSession.id === selectedBatchId)
                            );
                        if (isAlreadyEnrolled) return null;
                        return (
                            <div className="mt-4 pt-4 border-t border-border/50">
                                <Button
                                    type="button"
                                    size="lg"
                                    className="w-full font-semibold shadow-sm"
                                    onClick={onEnrollmentClick}
                                >
                                    Enroll Now
                                </Button>
                            </div>
                        );
                    })()}
            </CardContent>
        </Card>
    );
};
