import { Steps } from "@phosphor-icons/react";
import { useRouter } from "@tanstack/react-router";
import {
    ChalkboardTeacher,
    Code,
    File,
    FileDoc,
    FilePdf,
    PlayCircle,
    Question,
    CaretLeft,
    BookOpen,
    GraduationCap,
} from "phosphor-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useState, useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
    CourseDetailsFormValues,
    courseDetailsSchema,
} from "./course-details-schema";
import {
    VideoSlide,
    DocumentSlide,
    QuestionSlide,
    AssignmentSlide,
} from "../../-services/getAllSlides";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { handleGetSlideCountDetails } from "../-services/get-slides-count";
import { CourseDetailsRatingsComponent } from "./course-details-ratings-page";
import { transformApiDataToCourseData } from "../-utils/helper";
import { handleGetAllCourseDetails } from "../-services/get-course-details";
import axios from "axios";
import { urlInstituteDetails } from "@/constants/urls";
import { getInstituteId } from "@/constants/helper";
import { Preferences } from "@capacitor/preferences";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { CourseStructureDetails } from "./course-structure-details";
import { BatchForSessionType } from "@/types/institute-details/institute-details-interface";
import { CourseStructureResponse } from "@/types/institute-details/course-details-interface";
import { getIdByLevelAndSession } from "@/routes/courses/course-details/-utils/helper";

type SlideType = {
    id: string;
    name: string;
    type: string;
    description: string;
    status: string;
    order: number;
    videoSlide?: VideoSlide;
    documentSlide?: DocumentSlide;
    questionSlide?: QuestionSlide;
    assignmentSlide?: AssignmentSlide;
};

export type ChapterType = {
    id: string;
    name: string;
    status: string;
    file_id: string;
    description: string;
    chapter_order: number;
    slides: SlideType[];
    isOpen?: boolean;
};

export type ModuleType = {
    id: string;
    name: string;
    description: string;
    status: string;
    thumbnail_id: string;
    chapters: ChapterType[];
    isOpen?: boolean;
};

export type SubjectType = {
    id: string;
    subject_name: string;
    subject_code: string;
    credit: number;
    thumbnail_id: string | null;
    created_at: string | null;
    updated_at: string | null;
    modules: ModuleType[];
};

type Course = {
    id: string;
    title: string;
    level: 1 | 2 | 3 | 4 | 5;
    structure: {
        courseName: string;
        items: SubjectType[] | ModuleType[] | ChapterType[] | SlideType[];
    };
};

type SlideCountType = {
    slide_count: number;
    source_type: string;
};

const mockCourses: Course[] = [
    {
        id: "1",
        title: "2-Level Course Structure",
        level: 2,
        structure: {
            courseName: "Introduction to Web Development",
            items: [] as SlideType[],
        },
    },
    {
        id: "2",
        title: "3-Level Course Structure",
        level: 3,
        structure: {
            courseName: "Frontend Fundamentals",
            items: [] as SlideType[],
        },
    },
    {
        id: "3",
        title: "4-Level Course Structure",
        level: 4,
        structure: {
            courseName: "Full-Stack JavaScript Development Mastery",
            items: [] as ModuleType[],
        },
    },
    {
        id: "4",
        title: "5-Level Course Structure",
        level: 5,
        structure: {
            courseName: "Advanced Software Engineering Principles",
            items: [] as SubjectType[],
        },
    },
];

const heading = (
    <div className="flex items-center">
        <CaretLeft
            onClick={() => window.history.back()}
            className="cursor-pointer"
        />
        <h1 className="text-lg ml-2">Course Details</h1>
    </div>
);

export const CourseDetailsPage = () => {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(heading);
    }, []);

    const [selectedSession, setSelectedSession] = useState<string>("");
    const [selectedLevel, setSelectedLevel] = useState<string>("");
    const router = useRouter();
    const searchParams = router.state.location.search;
    const [instituteId, setInstituteId] = useState<string | null>(null);

    useEffect(() => {
        const fetchInstituteAndUserId = async () => {
            const instituteResult = await Preferences.get({
                key: "InstituteId",
            });
            setInstituteId(instituteResult.value || null);
        };

        fetchInstituteAndUserId();
    }, []);

    const [
        packageSessionIdForCurrentLevel,
        setPackageSessionIdForCurrentLevel,
    ] = useState<string | null>(null);

    const findIdByPackageId = (data: BatchForSessionType[]) => {
        const result = data?.find(
            (item) => item.package_dto?.id === searchParams.courseId
        );
        return result?.id || "";
    };

    const [packageSessionIds, setPackageSessionIds] = useState<string | null>(
        null
    );

    // ✅ Fetch institute details
    useEffect(() => {
        const FetchInstituteDetails = async () => {
            const instituteId = await getInstituteId();
            try {
                const response = await axios.get(
                    `${urlInstituteDetails}/${instituteId}`
                );
                setPackageSessionIds(
                    findIdByPackageId(response.data.batches_for_sessions)
                );
                setPackageSessionIdForCurrentLevel(
                    getIdByLevelAndSession(
                        response.data.batches_for_sessions,
                        selectedSession,
                        selectedLevel
                    )
                );
            } catch (error) {
                console.log(error);
            }
        };

        FetchInstituteDetails();
    }, [instituteId, selectedSession, selectedLevel]);

    // Only run the query if instituteId is available
    const { data: studyLibraryData } = useSuspenseQuery(
        handleGetAllCourseDetails({
            instituteId: instituteId || "",
        })
    );

    const courseDetailsData = useMemo(() => {
        return studyLibraryData?.find(
            (item: CourseStructureResponse) =>
                item.course.id === searchParams.courseId
        );
    }, [studyLibraryData]);

    const form = useForm<CourseDetailsFormValues>({
        resolver: zodResolver(courseDetailsSchema),
        defaultValues: {
            courseData: {
                id: "",
                title: "",
                description: "",
                tags: [],
                imageUrl: "",
                courseStructure: 1,
                whatYoullLearn: "",
                whyLearn: "",
                whoShouldLearn: "",
                aboutTheCourse: "",
                packageName: "",
                status: "",
                isCoursePublishedToCatalaouge: false,
                coursePreviewImageMediaId: "",
                courseBannerMediaId: "",
                courseMediaId: "",
                courseHtmlDescription: "",
                instructors: [],
                sessions: [],
            },
            mockCourses: [],
        },
        mode: "onChange",
    });

    const getInitials = (email: string) => {
        const name = email.split("@")[0];
        return name?.slice(0, 2).toUpperCase();
    };

    const [levelOptions, setLevelOptions] = useState<
        { _id: string; value: string; label: string }[]
    >([]);

    // Convert sessions to select options format
    const sessionOptions = useMemo(() => {
        const sessions = form.getValues("courseData")?.sessions || [];
        return sessions.map((session) => ({
            _id: session.sessionDetails.id,
            value: session.sessionDetails.id,
            label: session.sessionDetails.session_name,
        }));
    }, [form.watch("courseData.sessions")]);

    // Update level options when session changes
    const handleSessionChange = (sessionId: string) => {
        setSelectedSession(sessionId);
        const sessions = form.getValues("courseData")?.sessions || [];
        const selectedSessionData = sessions.find(
            (session) => session.sessionDetails.id === sessionId
        );

        if (selectedSessionData) {
            const newLevelOptions = selectedSessionData.levelDetails.map(
                (level) => ({
                    _id: level.id,
                    value: level.id,
                    label: level.name,
                })
            );
            setLevelOptions(newLevelOptions);

            // Select the first level when session changes
            if (newLevelOptions.length > 0 && newLevelOptions[0]?.value) {
                setSelectedLevel(newLevelOptions[0].value);
            } else {
                setSelectedLevel("");
            }
        }
    };

    // Handle level change - clear expanded items and reset state
    const handleLevelChange = (levelId: string) => {
        setSelectedLevel(levelId);
    };

    // Set initial session and its levels
    useEffect(() => {
        if (
            sessionOptions.length > 0 &&
            !selectedSession &&
            sessionOptions[0]?.value
        ) {
            const initialSessionId = sessionOptions[0].value;
            handleSessionChange(initialSessionId);
        }
    }, [sessionOptions]);

    useEffect(() => {
        const loadCourseData = async () => {
            if (courseDetailsData?.course) {
                try {
                    const transformedData =
                        await transformApiDataToCourseData(courseDetailsData);
                    if (transformedData) {
                        form.reset({
                            courseData: transformedData,
                            mockCourses: mockCourses,
                        });
                    }
                } catch (error) {
                    console.error("Error transforming course data:", error);
                }
            }
        };

        loadCourseData();
    }, [courseDetailsData]);

    // Add this with other queries at the top level of the component
    const slideCountQuery = useQuery({
        ...handleGetSlideCountDetails(packageSessionIds || ""),
        enabled: !!packageSessionIds,
    });

    return (
        <>
            <div className="min-h-screen bg-gradient-to-br from-gray-50/80 via-white to-primary-50/20 relative overflow-hidden w-full max-w-full">
                {/* Animated background elements */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-32 md:w-64 h-32 md:h-64 bg-gradient-to-br from-primary-100/20 to-transparent rounded-full blur-3xl animate-gentle-pulse"></div>
                    <div
                        className="absolute bottom-1/3 right-1/3 w-40 md:w-80 h-40 md:h-80 bg-gradient-to-br from-primary-50/30 to-transparent rounded-full blur-3xl animate-gentle-pulse"
                        style={{ animationDelay: "2s" }}
                    ></div>
                </div>

                {/* Enhanced Top Banner */}
                <div className="relative overflow-hidden animate-fade-in-up">
                    <div className="relative h-[200px] sm:h-[250px] lg:h-[280px]">
                        {/* Background with overlay */}
                        {!form.watch("courseData").courseBannerMediaId ? (
                            <div className="absolute inset-0 z-0 bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700" />
                        ) : (
                            <div className="absolute inset-0 z-0">
                                <img
                                    src={
                                        form.watch("courseData")
                                            .courseBannerMediaId
                                    }
                                    alt="Course Banner"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                        e.currentTarget.parentElement?.classList.add(
                                            "bg-gradient-to-br",
                                            "from-primary-500",
                                            "via-primary-600",
                                            "to-primary-700"
                                        );
                                    }}
                                />
                            </div>
                        )}

                        {/* Enhanced gradient overlay */}
                        <div className="absolute inset-0 z-10 bg-gradient-to-br from-black/40 via-black/30 to-transparent" />

                        {/* Floating orb effects */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-3xl opacity-70 -translate-y-2 translate-x-6"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary-300/20 rounded-full blur-3xl opacity-50 translate-y-6 -translate-x-6"></div>

                        {/* Content Container */}
                        <div className="relative z-20 h-full">
                            <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 h-full flex items-center">
                                {form.watch("courseData").courseMediaId ? (
                                    // Layout with video - 3/5 and 2/5 split
                                    <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6 items-center">
                                        {/* Left side - Course Info (3/5) */}
                                        <div className="lg:col-span-3 text-white animate-fade-in-up">
                                            {!form.watch("courseData").title ? (
                                                <div className="space-y-3">
                                                    <div className="h-5 w-20 animate-pulse rounded bg-white/20" />
                                                    <div className="h-6 sm:h-8 w-3/4 animate-pulse rounded bg-white/20" />
                                                    <div className="h-3 w-full animate-pulse rounded bg-white/20" />
                                                    <div className="h-3 w-2/3 animate-pulse rounded bg-white/20" />
                                                </div>
                                            ) : (
                                                <>
                                                    {/* Tags */}
                                                    <div className="mb-2 sm:mb-3 flex flex-wrap gap-1.5">
                                                        {form
                                                            .getValues(
                                                                "courseData"
                                                            )
                                                            .tags.map(
                                                                (
                                                                    tag,
                                                                    index
                                                                ) => (
                                                                    <span
                                                                        key={
                                                                            index
                                                                        }
                                                                        className="bg-white/20 backdrop-blur-sm border border-white/30 text-white px-2.5 py-1 rounded-full text-xs font-medium hover:bg-white/30 transition-all duration-300"
                                                                    >
                                                                        {tag}
                                                                    </span>
                                                                )
                                                            )}
                                                    </div>

                                                    {/* Title */}
                                                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 sm:mb-3 leading-tight">
                                                        {
                                                            form.getValues(
                                                                "courseData"
                                                            ).title
                                                        }
                                                    </h1>

                                                    {/* Description */}
                                                    <div
                                                        className="text-sm sm:text-base opacity-90 leading-relaxed line-clamp-2"
                                                        dangerouslySetInnerHTML={{
                                                            __html:
                                                                form.getValues(
                                                                    "courseData"
                                                                ).description ||
                                                                "",
                                                        }}
                                                    />
                                                </>
                                            )}
                                        </div>

                                        {/* Right side - Video Player (2/5) */}
                                        <div
                                            className="lg:col-span-2 animate-fade-in-up"
                                            style={{ animationDelay: "0.2s" }}
                                        >
                                            <div className="relative overflow-hidden rounded-xl shadow-2xl border border-white/20 bg-black/20 backdrop-blur-sm group">
                                                <div className="relative aspect-video">
                                                    <video
                                                        src={
                                                            form.watch(
                                                                "courseData"
                                                            ).courseMediaId
                                                        }
                                                        controls
                                                        controlsList="nodownload noremoteplayback"
                                                        disablePictureInPicture
                                                        disableRemotePlayback
                                                        className="w-full h-full object-cover rounded-xl"
                                                        onError={(e) => {
                                                            e.currentTarget.style.display =
                                                                "none";
                                                            e.currentTarget.parentElement?.classList.add(
                                                                "bg-black"
                                                            );
                                                        }}
                                                    >
                                                        Your browser does not
                                                        support the video tag.
                                                    </video>
                                                </div>

                                                {/* Video overlay gradient */}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none rounded-xl"></div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    // Layout without video - full width
                                    <div className="w-full text-center text-white animate-fade-in-up">
                                        {!form.watch("courseData").title ? (
                                            <div className="space-y-4 max-w-3xl mx-auto">
                                                <div className="h-6 w-32 animate-pulse rounded bg-white/20 mx-auto" />
                                                <div className="h-8 sm:h-10 w-3/4 animate-pulse rounded bg-white/20 mx-auto" />
                                                <div className="h-4 w-full animate-pulse rounded bg-white/20" />
                                                <div className="h-4 w-2/3 animate-pulse rounded bg-white/20 mx-auto" />
                                            </div>
                                        ) : (
                                            <div className="max-w-4xl mx-auto">
                                                {/* Tags */}
                                                <div className="mb-3 sm:mb-4 flex flex-wrap gap-2 justify-center">
                                                    {form
                                                        .getValues("courseData")
                                                        .tags.map(
                                                            (tag, index) => (
                                                                <span
                                                                    key={index}
                                                                    className="bg-white/20 backdrop-blur-sm border border-white/30 text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-white/30 transition-all duration-300"
                                                                >
                                                                    {tag}
                                                                </span>
                                                            )
                                                        )}
                                                </div>

                                                {/* Title */}
                                                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4 leading-tight">
                                                    {
                                                        form.getValues(
                                                            "courseData"
                                                        ).title
                                                    }
                                                </h1>

                                                {/* Description */}
                                                <div
                                                    className="text-base sm:text-lg opacity-90 leading-relaxed line-clamp-3 max-w-3xl mx-auto"
                                                    dangerouslySetInnerHTML={{
                                                        __html:
                                                            form.getValues(
                                                                "courseData"
                                                            ).description || "",
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Container */}
                <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 lg:py-6">
                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 lg:gap-6">
                        {/* Left Column - Course Content (3/4) */}
                        <div className="xl:col-span-3 space-y-4 lg:space-y-6">
                            {/* Enhanced Session and Level Selectors */}
                            <div
                                className="relative bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-sm hover:shadow-lg transition-all duration-500 p-3 sm:p-4 group animate-fade-in-up"
                                style={{ animationDelay: "0.1s" }}
                            >
                                {/* Background gradient overlay */}
                                <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"></div>

                                {/* Floating orb effect */}
                                <div className="absolute top-0 right-0 w-12 h-12 bg-primary-100/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-y-1 translate-x-3"></div>

                                <div className="relative">
                                    <div className="flex items-center space-x-2 mb-3">
                                        <div className="p-1.5 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg shadow-sm">
                                            <GraduationCap
                                                size={18}
                                                className="text-primary-600"
                                                weight="duotone"
                                            />
                                        </div>
                                        <h3 className="text-base font-bold text-gray-900">
                                            Course Configuration
                                        </h3>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                                        {/* Session Selector */}

                                        {sessionOptions && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-gray-700 flex items-center space-x-1.5">
                                                    <div className="w-1.5 h-1.5 bg-primary-500 rounded-full"></div>
                                                    <span>Session</span>
                                                </label>
                                                {sessionOptions.length === 1 ? (
                                                    sessionOptions[0]?.label !==
                                                        "default" && (
                                                        <div className="flex flex-col gap-2">
                                                            <label className="text-sm font-medium">
                                                                {
                                                                    sessionOptions[0]
                                                                        ?.label
                                                                }
                                                            </label>
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        <Select
                                                            value={
                                                                selectedSession
                                                            }
                                                            onValueChange={
                                                                handleSessionChange
                                                            }
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select Session" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {sessionOptions.map(
                                                                    (
                                                                        option
                                                                    ) => (
                                                                        <SelectItem
                                                                            key={
                                                                                option._id
                                                                            }
                                                                            value={
                                                                                option.value
                                                                            }
                                                                        >
                                                                            {
                                                                                option.label
                                                                            }
                                                                        </SelectItem>
                                                                    )
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Level Selector */}
                                        {levelOptions && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-gray-700 flex items-center space-x-1.5">
                                                    <div className="w-1.5 h-1.5 bg-primary-500 rounded-full"></div>
                                                    <span>Level</span>
                                                </label>
                                                {levelOptions.length === 1 ? (
                                                    levelOptions[0]?.label !==
                                                        "default" && (
                                                        <div className="flex flex-col gap-2">
                                                            <label className="text-sm font-medium">
                                                                {
                                                                    levelOptions[0]
                                                                        ?.label
                                                                }
                                                            </label>
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        <Select
                                                            value={
                                                                selectedLevel
                                                            }
                                                            onValueChange={
                                                                handleLevelChange
                                                            }
                                                            disabled={
                                                                !selectedSession
                                                            }
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select Level" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {levelOptions.map(
                                                                    (
                                                                        option
                                                                    ) => (
                                                                        <SelectItem
                                                                            key={
                                                                                option._id
                                                                            }
                                                                            value={
                                                                                option.value
                                                                            }
                                                                        >
                                                                            {
                                                                                option.label
                                                                            }
                                                                        </SelectItem>
                                                                    )
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Course Structure */}
                            <div
                                className="animate-fade-in-up"
                                style={{ animationDelay: "0.2s" }}
                            >
                                <CourseStructureDetails
                                    selectedSession={selectedSession}
                                    selectedLevel={selectedLevel}
                                    courseStructure={form.getValues(
                                        "courseData.courseStructure"
                                    )}
                                    courseData={form.getValues()}
                                    packageSessionId={
                                        packageSessionIdForCurrentLevel || ""
                                    }
                                />
                            </div>

                            {/* Content Sections */}
                            <div className="space-y-4">
                                {/* What You'll Learn Section */}
                                {form.getValues("courseData")
                                    .whatYoullLearn && (
                                    <div
                                        className="relative bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-sm hover:shadow-lg transition-all duration-500 p-3 sm:p-4 group animate-fade-in-up"
                                        style={{ animationDelay: "0.3s" }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-success-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"></div>
                                        <div className="relative">
                                            <div className="flex items-center space-x-2 mb-3">
                                                <div className="p-1.5 bg-gradient-to-br from-success-100 to-success-200 rounded-lg shadow-sm">
                                                    <BookOpen
                                                        size={18}
                                                        className="text-success-600"
                                                        weight="duotone"
                                                    />
                                                </div>
                                                <h2 className="text-base font-bold text-gray-900">
                                                    What you'll learn
                                                </h2>
                                            </div>
                                            <div
                                                className="text-sm text-gray-600 leading-relaxed"
                                                dangerouslySetInnerHTML={{
                                                    __html:
                                                        form.getValues(
                                                            "courseData"
                                                        ).whatYoullLearn || "",
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* About Course Section */}
                                {form.getValues("courseData")
                                    .aboutTheCourse && (
                                    <div
                                        className="relative bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-sm hover:shadow-lg transition-all duration-500 p-3 sm:p-4 group animate-fade-in-up"
                                        style={{ animationDelay: "0.4s" }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"></div>
                                        <div className="relative">
                                            <div className="flex items-center space-x-2 mb-3">
                                                <div className="p-1.5 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg shadow-sm">
                                                    <File
                                                        size={18}
                                                        className="text-blue-600"
                                                        weight="duotone"
                                                    />
                                                </div>
                                                <h2 className="text-base font-bold text-gray-900">
                                                    About this course
                                                </h2>
                                            </div>
                                            <div
                                                className="text-sm text-gray-600 leading-relaxed"
                                                dangerouslySetInnerHTML={{
                                                    __html:
                                                        form.getValues(
                                                            "courseData"
                                                        ).aboutTheCourse || "",
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Who Should Join Section */}
                                {form.getValues("courseData")
                                    .whoShouldLearn && (
                                    <div
                                        className="relative bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-sm hover:shadow-lg transition-all duration-500 p-3 sm:p-4 group animate-fade-in-up"
                                        style={{ animationDelay: "0.5s" }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"></div>
                                        <div className="relative">
                                            <div className="flex items-center space-x-2 mb-3">
                                                <div className="p-1.5 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg shadow-sm">
                                                    <GraduationCap
                                                        size={18}
                                                        className="text-purple-600"
                                                        weight="duotone"
                                                    />
                                                </div>
                                                <h2 className="text-base font-bold text-gray-900">
                                                    Who should join
                                                </h2>
                                            </div>
                                            <div
                                                className="text-sm text-gray-600 leading-relaxed"
                                                dangerouslySetInnerHTML={{
                                                    __html:
                                                        form.getValues(
                                                            "courseData"
                                                        ).whoShouldLearn || "",
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Instructors Section */}
                                {form.getValues("courseData").instructors &&
                                    form.getValues("courseData").instructors
                                        .length > 0 && (
                                        <div
                                            className="relative bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-sm hover:shadow-lg transition-all duration-500 p-3 sm:p-4 group animate-fade-in-up"
                                            style={{ animationDelay: "0.6s" }}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"></div>
                                            <div className="relative">
                                                <div className="flex items-center space-x-2 mb-3">
                                                    <div className="p-1.5 bg-gradient-to-br from-orange-100 to-orange-200 rounded-lg shadow-sm">
                                                        <ChalkboardTeacher
                                                            size={18}
                                                            className="text-orange-600"
                                                            weight="duotone"
                                                        />
                                                    </div>
                                                    <h2 className="text-base font-bold text-gray-900">
                                                        Instructors
                                                    </h2>
                                                </div>
                                                <div className="space-y-2">
                                                    {form
                                                        .getValues("courseData")
                                                        .instructors.map(
                                                            (
                                                                instructor,
                                                                index
                                                            ) => (
                                                                <div
                                                                    key={index}
                                                                    className="flex items-center gap-3 p-2.5 bg-gray-50/80 rounded-lg hover:bg-gray-100/80 transition-all duration-300"
                                                                >
                                                                    <Avatar className="w-8 h-8 border-2 border-white shadow-sm">
                                                                        <AvatarImage
                                                                            src=""
                                                                            alt={
                                                                                instructor.email
                                                                            }
                                                                        />
                                                                        <AvatarFallback className="bg-gradient-to-br from-primary-500 to-primary-600 text-white text-xs font-semibold">
                                                                            {getInitials(
                                                                                instructor.email
                                                                            )}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <div>
                                                                        <h3 className="text-sm font-semibold text-gray-900">
                                                                            {
                                                                                instructor.name
                                                                            }
                                                                        </h3>
                                                                        <p className="text-xs text-gray-600">
                                                                            {
                                                                                instructor.email
                                                                            }
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            )
                                                        )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                            </div>
                        </div>

                        {/* Right Column - Course Stats Sidebar (1/4) */}
                        <div className="xl:col-span-1">
                            <div className="sticky top-4 space-y-4">
                                <div
                                    className="relative bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-sm hover:shadow-lg transition-all duration-500 p-3 sm:p-4 group animate-fade-in-up"
                                    style={{ animationDelay: "0.7s" }}
                                >
                                    {/* Background gradient overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"></div>

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
                                                Course Overview
                                            </h2>
                                        </div>

                                        {/* Course Stats */}
                                        <div className="space-y-3">
                                            {/* Level Badge */}
                                            {levelOptions[0]?.label !==
                                                "default" && (
                                                <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg border border-primary-200">
                                                    <div className="flex items-center space-x-2">
                                                        <Steps
                                                            size={16}
                                                            className="text-primary-600"
                                                            weight="duotone"
                                                        />
                                                        <span className="text-xs font-medium text-primary-700">
                                                            Level
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-bold text-primary-800">
                                                        {
                                                            levelOptions.find(
                                                                (option) =>
                                                                    option.value ===
                                                                    selectedLevel
                                                            )?.label
                                                        }
                                                    </span>
                                                </div>
                                            )}

                                            {/* Slide Counts */}
                                            {slideCountQuery.isLoading ? (
                                                <div className="space-y-2">
                                                    {[1, 2, 3, 4, 5].map(
                                                        (i) => (
                                                            <div
                                                                key={i}
                                                                className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg animate-pulse"
                                                            >
                                                                <div className="h-3 w-16 bg-gray-200 rounded"></div>
                                                                <div className="h-3 w-6 bg-gray-200 rounded"></div>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            ) : slideCountQuery.error ? (
                                                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
                                                    <p className="text-xs text-red-600 font-medium">
                                                        Error loading slide
                                                        counts
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {slideCountQuery.data?.map(
                                                        (
                                                            count: SlideCountType
                                                        ) => (
                                                            <div
                                                                key={
                                                                    count.source_type
                                                                }
                                                                className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg hover:bg-gray-100/80 transition-all duration-300 group/item"
                                                            >
                                                                <div className="flex items-center space-x-2">
                                                                    {count.source_type ===
                                                                        "VIDEO" && (
                                                                        <PlayCircle
                                                                            size={
                                                                                16
                                                                            }
                                                                            className="text-blue-600 group-hover/item:scale-110 transition-transform duration-300"
                                                                            weight="duotone"
                                                                        />
                                                                    )}
                                                                    {count.source_type ===
                                                                        "CODE" && (
                                                                        <Code
                                                                            size={
                                                                                16
                                                                            }
                                                                            className="text-green-600 group-hover/item:scale-110 transition-transform duration-300"
                                                                            weight="duotone"
                                                                        />
                                                                    )}
                                                                    {count.source_type ===
                                                                        "PDF" && (
                                                                        <FilePdf
                                                                            size={
                                                                                16
                                                                            }
                                                                            className="text-red-600 group-hover/item:scale-110 transition-transform duration-300"
                                                                            weight="duotone"
                                                                        />
                                                                    )}
                                                                    {count.source_type ===
                                                                        "DOCUMENT" && (
                                                                        <FileDoc
                                                                            size={
                                                                                16
                                                                            }
                                                                            className="text-purple-600 group-hover/item:scale-110 transition-transform duration-300"
                                                                            weight="duotone"
                                                                        />
                                                                    )}
                                                                    {count.source_type ===
                                                                        "QUESTION" && (
                                                                        <Question
                                                                            size={
                                                                                16
                                                                            }
                                                                            className="text-orange-600 group-hover/item:scale-110 transition-transform duration-300"
                                                                            weight="duotone"
                                                                        />
                                                                    )}
                                                                    {count.source_type ===
                                                                        "ASSIGNMENT" && (
                                                                        <File
                                                                            size={
                                                                                16
                                                                            }
                                                                            className="text-indigo-600 group-hover/item:scale-110 transition-transform duration-300"
                                                                            weight="duotone"
                                                                        />
                                                                    )}
                                                                    <span className="text-xs font-medium text-gray-700">
                                                                        {count.source_type ===
                                                                            "VIDEO" &&
                                                                            "Video slides"}
                                                                        {count.source_type ===
                                                                            "CODE" &&
                                                                            "Code slides"}
                                                                        {count.source_type ===
                                                                            "PDF" &&
                                                                            "PDF slides"}
                                                                        {count.source_type ===
                                                                            "DOCUMENT" &&
                                                                            "Doc slides"}
                                                                        {count.source_type ===
                                                                            "QUESTION" &&
                                                                            "Question slides"}
                                                                        {count.source_type ===
                                                                            "ASSIGNMENT" &&
                                                                            "Assignment slides"}
                                                                    </span>
                                                                </div>
                                                                <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded-md shadow-sm">
                                                                    {
                                                                        count.slide_count
                                                                    }
                                                                </span>
                                                            </div>
                                                        )
                                                    )}

                                                    {/* Instructors Count */}
                                                    {form.getValues(
                                                        "courseData"
                                                    ).instructors.length >
                                                        0 && (
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
                                                                {
                                                                    form.getValues(
                                                                        "courseData"
                                                                    )
                                                                        .instructors
                                                                        .length
                                                                }
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Ratings Component */}
                    <div
                        className="mt-6 lg:mt-8 animate-fade-in-up"
                        style={{ animationDelay: "0.8s" }}
                    >
                        <CourseDetailsRatingsComponent
                            packageSessionId={packageSessionIdForCurrentLevel}
                        />
                    </div>
                </div>
            </div>
        </>
    );
};
