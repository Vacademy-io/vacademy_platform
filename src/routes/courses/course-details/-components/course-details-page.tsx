import { Steps } from "@phosphor-icons/react";
import { useRouter } from "@tanstack/react-router";
// Removed unused icon imports to improve modularity and avoid linter warnings
import { toTitleCase } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useState, useEffect, useMemo, useCallback } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { CourseDetailsRatingsComponent } from "./course-details-ratings-page";
import {
    getIdByLevelAndSession,
    transformApiDataToCourseData,
} from "../-utils/helper";
import { VideoPlayer } from "./course-details-video-player";
import { handleGetAllCourseDetails } from "../-services/get-course-details";
import axios from "axios";
import { urlInstituteDetails } from "@/constants/urls";
import CourseListHeader from "../../-component/CourseListHeader";
import { MyButton } from "@/components/design-system/button";
import { CourseStructureDetails } from "./course-structure-details";
import { handleGetSlideCountDetails } from "../-services/get-slides-count";
import {
    BatchForSessionType,
    InstituteDetailsType,
} from "@/types/institute-details/institute-details-interface";
import { CourseStructureResponse } from "@/types/institute-details/course-details-interface";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { AuthModal } from "@/components/common/auth/modal/AuthModal";
// import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
// import { TokenKey } from "@/constants/auth/tokens";
// import { Preferences } from "@capacitor/preferences";
import { getSubdomain } from "@/helpers/helper";
import { handleGetInstituteIdWithLocalStorageCheck } from "../../-services/courses-services";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { extractTextFromHTML } from "@/components/common/helper";
import { SlideCountEntry } from "@/utils/courseTime";
import { CourseStatsSidebar } from "@/routes/study-library/courses/course-details/-components/course-stats-sidebar";
import { formatTotalCourseDuration } from "@/utils/courseTime";

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

// Using SlideCountEntry from courseTime util instead

const mockCourses: Course[] = [
    {
        id: "1",
        title: `2-Level ${getTerminology(
            ContentTerms.Course,
            SystemTerms.Course
        )} Structure`,
        level: 2,
        structure: {
            courseName: "Introduction to Web Development",
            items: [] as SlideType[],
        },
    },
    {
        id: "2",
        title: `3-Level ${getTerminology(
            ContentTerms.Course,
            SystemTerms.Course
        )} Structure`,
        level: 3,
        structure: {
            courseName: "Frontend Fundamentals",
            items: [] as SlideType[],
        },
    },
    {
        id: "3",
        title: `4-Level ${getTerminology(
            ContentTerms.Course,
            SystemTerms.Course
        )} Structure`,
        level: 4,
        structure: {
            courseName: "Full-Stack JavaScript Development Mastery",
            items: [] as ModuleType[],
        },
    },
    {
        id: "4",
        title: `5-Level ${getTerminology(
            ContentTerms.Course,
            SystemTerms.Course
        )} Structure`,
        level: 5,
        structure: {
            courseName: "Advanced Software Engineering Principles",
            items: [] as SubjectType[],
        },
    },
];

export const CourseDetailsPage = () => {
    const [selectedSession, setSelectedSession] = useState<string>("");
    const [selectedLevel, setSelectedLevel] = useState<string>("");
    const router = useRouter();
    const searchParams = router.state.location.search;
    const subdomain = getSubdomain(window.location.hostname);


    // Loading state management
    const [isLoading, setIsLoading] = useState(true);
    const [loadingStates, setLoadingStates] = useState({
        instituteDetails: false,
        courseDetails: false,
        slideCount: false,
        modulesData: false,
        ratingsData: false,
        userData: false,
    });

    // Function to update loading states
    const updateLoadingState = useCallback(
        (key: keyof typeof loadingStates, value: boolean) => {
            setLoadingStates((prev) => ({ ...prev, [key]: value }));
        },
        []
    );

    // Check if all loading states are complete
    const isAllLoadingComplete = useMemo(() => {
        return Object.values(loadingStates).every((state) => !state);
    }, [loadingStates]);

    // Update main loading state when all individual states are complete
    useEffect(() => {
        if (isAllLoadingComplete) {
            setIsLoading(false);
        }
    }, [isAllLoadingComplete]);



    // Memoized callback functions for child components
    const handleModulesLoadingChange = useCallback(
        (loading: boolean) => {
            updateLoadingState("modulesData", loading);
        },
        [updateLoadingState]
    );

    const handleRatingsLoadingChange = useCallback(
        (loading: boolean) => {
            updateLoadingState("ratingsData", loading);
        },
        [updateLoadingState]
    );

    // Get instituteId from API using subdomain - Changed from useSuspenseQuery to useQuery to prevent infinite re-renders
    const { data: instituteIdFromApi, isLoading: isLoadingInstituteId } =
        useQuery(
            handleGetInstituteIdWithLocalStorageCheck({
                subdomain: subdomain || "",
            })
        );


    const instituteId = instituteIdFromApi;

    // Update institute ID loading state
    useEffect(() => {
        updateLoadingState("userData", isLoadingInstituteId);
    }, [isLoadingInstituteId, updateLoadingState]);

    const [
        packageSessionIdForCurrentLevel,
        setPackageSessionIdForCurrentLevel,
    ] = useState<string | null>(null);

    const findIdByPackageId = useCallback((data: BatchForSessionType[]) => {
        const result = data?.find(
            (item) => item.package_dto?.id === searchParams.courseId
        );
        return result?.id || "";
    }, [searchParams.courseId]);

    const [packageSessionIds, setPackageSessionIds] = useState<string | null>(
        null
    );

    const [instituteDetails, setInstituteDetails] =
        useState<InstituteDetailsType | null>(null);

    // ✅ Fetch institute details
    useEffect(() => {
        if (!instituteId) return; // Don't fetch if instituteId is not available

        const fetchInstituteDetails = async () => {
            updateLoadingState("instituteDetails", true);
            try {
                const response = await axios.get(
                    `${urlInstituteDetails}/${instituteId}`
                );
                setPackageSessionIds(
                    findIdByPackageId(response.data.batches_for_sessions)
                );
                setInstituteDetails(response?.data);
                setPackageSessionIdForCurrentLevel(
                    getIdByLevelAndSession(
                        response?.data?.batches_for_sessions,
                        selectedSession,
                        selectedLevel,
                        searchParams?.courseId || ""
                    )
                );
            } catch (error) {
                console.log(error);
            } finally {
                updateLoadingState("instituteDetails", false);
            }
        };

        fetchInstituteDetails();
    }, [instituteId, selectedSession, selectedLevel, searchParams?.courseId, updateLoadingState, findIdByPackageId]);

    // Only run the query if instituteId is available
    const { data: studyLibraryData, isLoading: isCourseDetailsLoading } =
        useQuery({
            ...handleGetAllCourseDetails({
                instituteId: instituteId || "",
            }),
            enabled: !!instituteId, // Only run query when instituteId is available
        });

    // Update course details loading state
    useEffect(() => {
        updateLoadingState("courseDetails", isCourseDetailsLoading);
    }, [isCourseDetailsLoading, updateLoadingState]);

    const courseDetailsData = useMemo(() => {
        return studyLibraryData?.find(
            (item: CourseStructureResponse) =>
                item.course.id === searchParams.courseId
        );
    }, [studyLibraryData, searchParams.courseId]);

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
    const watchedSessions = form.watch("courseData.sessions");
    const sessionOptions = useMemo(() => {
        const sessions = watchedSessions || [];
        return sessions.map((session) => ({
            _id: session.sessionDetails.id,
            value: session.sessionDetails.id,
            label: toTitleCase(session.sessionDetails.session_name),
        }));
    }, [watchedSessions]);

    // Determine if selectors should be hidden when names are 'default'
    const isSessionDefault = useMemo(() => {
        return (
            sessionOptions.length === 1 &&
            (sessionOptions[0]?.label || "").toLowerCase() === "default"
        );
    }, [sessionOptions]);

    const isLevelDefault = useMemo(() => {
        return (
            levelOptions.length === 1 &&
            (levelOptions[0]?.label || "").toLowerCase() === "default"
        );
    }, [levelOptions]);

    // Update level options when session changes
    const handleSessionChange = useCallback((sessionId: string) => {
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
    }, [form]);

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
    }, [sessionOptions, handleSessionChange, selectedSession]);

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
    }, [courseDetailsData, form]);

    // Add this with other queries at the top level of the component
    const slideCountQuery = useQuery({
        ...handleGetSlideCountDetails(packageSessionIds || ""),
        enabled: !!packageSessionIds,
    });

    // Update slide count loading state
    useEffect(() => {
        updateLoadingState("slideCount", slideCountQuery.isLoading);
    }, [slideCountQuery.isLoading, updateLoadingState]);

    // Total duration is computed via utility where needed

    // Temporarily disabled automatic redirect to prevent redirect loops
    // useEffect(() => {
    //     const redirectToDashboardIfAuthenticated = async () => {
    //         const token = await getTokenFromStorage(TokenKey.accessToken);
    //         const studentDetails = await Preferences.get({
    //             key: "StudentDetails",
    //         });
    //         const instituteDetails = await Preferences.get({
    //             key: "InstituteDetails",
    //         });

    //         // Only redirect if the user is authenticated and we're not already on a course details page
    //         // This prevents redirect loops and allows users to stay on the public course details page
    //         if (
    //             !isNullOrEmptyOrUndefined(token) &&
    //             !isNullOrEmptyOrUndefined(studentDetails) &&
    //             !isNullOrEmptyOrUndefined(instituteDetails) &&
    //             !window.location.pathname.includes('/study-library/') &&
    //             !window.location.pathname.includes('/course-details')
    //         ) {
    //             // Only redirect if we're coming from a different page, not if we're already on course details
    //             const referrer = document.referrer;
    //             const isComingFromCoursesPage = referrer.includes('/courses') && !referrer.includes('/course-details');
                
    //             if (isComingFromCoursesPage) {
    //             navigate({
    //                 to: "/study-library/courses/course-details",
    //                 search: {
    //                     courseId: searchParams.courseId || "",
    //                 },
    //                 replace: true,
    //             });
    //         }
    //     }
    //     };

    //     redirectToDashboardIfAuthenticated();
    // }, [navigate]);

    // Show loading until essential APIs are complete
    // Note: packageSessionIdForCurrentLevel is not required for initial render
    if (isLoading || isLoadingInstituteId || !instituteId || !studyLibraryData) {
        return <DashboardLoader />;
    }

    return (
        <>
            <div className="flex min-h-screen flex-col bg-white w-full">
                <CourseListHeader
                    fileId={instituteDetails?.institute_logo_file_id || ""}
                    instituteId={instituteDetails?.id}
                    type="courseDetailsPage"
                    courseId={searchParams.courseId || ""}
                />
                {/* Top Banner */}
                <div className="relative min-h-[200px] sm:min-h-[250px] md:min-h-[300px]">
                    {/* Transparent black overlay */}
                    {form.watch("courseData").courseBannerMediaId ? (
                        <div className="pointer-events-none absolute inset-0 z-10 bg-black/50" />
                    ) : (
                        <div className="pointer-events-none absolute inset-0 z-10 bg-black/10" />
                    )}
                    {!form.watch("courseData").courseBannerMediaId ? (
                        <div className="absolute inset-0 z-0 bg-transparent" />
                    ) : (
                        <div className="absolute inset-0 z-0 opacity-70">
                            <img
                                src={
                                    form.watch("courseData").courseBannerMediaId
                                }
                                alt="Course Banner"
                                className="size-full object-cover"
                                onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                    e.currentTarget.parentElement?.classList.add(
                                        "bg-primary-500"
                                    );
                                }}
                            />
                        </div>
                    )}
                    {/* Primary color overlay with 70% opacity */}
                    <div
                        className={`relative z-20 px-8 py-6 sm:py-8 md:py-12 ${
                            !form.watch("courseData").courseBannerMediaId
                                ? "text-black"
                                : "text-white"
                        }`}
                    >
                        <div className="flex flex-col lg:flex-row items-start justify-between gap-4 lg:gap-8">
                            {/* Left side - Title and Description */}
                            <div className="w-full lg:max-w-2xl">
                                {!form.watch("courseData").title ? (
                                    <div className="space-y-4">
                                        <div className="h-6 sm:h-8 w-24 sm:w-32 animate-pulse rounded bg-white/20" />
                                        <div className="h-8 sm:h-12 w-full sm:w-3/4 animate-pulse rounded bg-white/20" />
                                        <div className="h-3 sm:h-4 w-full animate-pulse rounded bg-white/20" />
                                        <div className="h-3 sm:h-4 w-2/3 animate-pulse rounded bg-white/20" />
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-3 sm:mb-4 flex flex-wrap gap-2">
                                            {form
                                                .getValues("courseData")
                                                .tags.map((tag, index) => (
                                                    <span
                                                        key={index}
                                                        className={`rounded-full px-2 sm:px-3 py-1 text-xs sm:text-sm ${
                                                            !form.watch(
                                                                "courseData"
                                                            )
                                                                .courseBannerMediaId
                                                                ? "text-black bg-white"
                                                                : "text-white bg-blue-500"
                                                        }`}
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                        </div>
                                        <h1 className="mb-3 sm:mb-4 text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
                                            {form.getValues("courseData").title}
                                        </h1>
                                        <div className="hidden lg:block">
                                            <AuthModal
                                                type="courseDetailsPage"
                                                courseId={searchParams.courseId}
                                                trigger={
                                                    <MyButton
                                                        type="button"
                                                        scale="large"
                                                        buttonType="primary"
                                                        layoutVariant="default"
                                                        className="mt-2"
                                                    >
                                                        Enroll
                                                    </MyButton>
                                                }
                                            />
                                        </div>
                                        <p
                                            className="text-base sm:text-lg opacity-90 leading-relaxed"
                                            dangerouslySetInnerHTML={{
                                                __html:
                                                    form.getValues("courseData")
                                                        .description || "",
                                            }}
                                        />
                                    </>
                                )}
                            </div>

                            {/* Right side - Video Player */}
                            {form.watch("courseData").courseMediaId && (
                                <div className="hidden lg:block w-full lg:w-auto mt-4 lg:mt-0">
                                    <VideoPlayer
                                        src={
                                            form.watch("courseData")
                                                .courseMediaId
                                        }
                                        className="!w-full sm:!w-[320px] md:!w-[370px] lg:!w-[370px]"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {/* Main Content */}
                <div className="px-12 py-6 sm:py-8">
                    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                        {/* Left Column - Full width on mobile, 2/3 on larger screens */}
                        <div className="w-full lg:w-2/3 lg:grow">
                            {/* Session and Level Selectors */}
                            {!(isSessionDefault || isLevelDefault) && (
                            <div className=" px-0 pb-4 sm:pb-6">
                                {/* Video Player for smaller screens - positioned above levels */}
                                {form.watch("courseData").courseMediaId && (
                                    <div className="mb-6 lg:hidden flex items-start">
                                        <VideoPlayer
                                            src={
                                                form.watch("courseData")
                                                    .courseMediaId
                                            }
                                            className="!w-full max-w-sm"
                                        />
                                    </div>
                                )}

                                <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                                    {/* Session Dropdown Logic */}
                                    {sessionOptions.length === 1 &&
                                    sessionOptions[0].label ===
                                        "default" ? null : sessionOptions.length ===
                                      1 ? (
                                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                                            <label className="text-sm font-medium">
                                                {sessionOptions[0]?.label}
                                            </label>
                                        </div>
                                    ) : sessionOptions.length > 1 ? (
                                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                                            <label className="text-sm font-medium">
                                                Session
                                            </label>
                                            <Select
                                                value={selectedSession}
                                                onValueChange={
                                                    handleSessionChange
                                                }
                                            >
                                                <SelectTrigger className="w-full sm:w-48">
                                                    <SelectValue placeholder="Select Session" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {sessionOptions.map(
                                                        (option) => (
                                                            <SelectItem
                                                                key={option._id}
                                                                value={
                                                                    option.value
                                                                }
                                                            >
                                                                {option.label}
                                                            </SelectItem>
                                                        )
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ) : null}

                                    {/* Level Dropdown Logic */}
                                    {levelOptions.length === 1 &&
                                    levelOptions[0].label ===
                                        "default" ? null : levelOptions.length ===
                                      1 ? (
                                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                                            <label className="text-sm font-medium">
                                                {/* {levelOptions[0]?.label} */}
                                            </label>
                                        </div>
                                    ) : levelOptions.length > 1 ? (
                                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                                            <label className="text-sm font-medium">
                                                Level
                                            </label>
                                            <Select
                                                value={selectedLevel}
                                                onValueChange={
                                                    handleLevelChange
                                                }
                                                disabled={!selectedSession}
                                            >
                                                <SelectTrigger className="w-full sm:w-48">
                                                    <SelectValue placeholder="Select Level" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {levelOptions.map(
                                                        (option) => (
                                                            <SelectItem
                                                                key={option._id}
                                                                value={
                                                                    option.value
                                                                }
                                                            >
                                                                {option.label}
                                                            </SelectItem>
                                                        )
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                            )}
                            {/* Enroll Button Card - shown above CourseStructureDetails for smaller screens */}
                            <div className="lg:hidden mb-6">
                                <div className="w-full max-w-[350px] rounded-lg border bg-white p-4 sm:p-6 shadow-lg">
                                    {/* Course Stats */}
                                    <h2 className="mb-3 sm:mb-4 text-base sm:text-lg font-bold line-clamp-2">
                                        {form.getValues("courseData").title}
                                    </h2>

                                    <div className="relative">
                                        {/* Header */}
                                        <div className="flex items-center space-x-2 mb-3 sm:mb-4">
                                            <div className="p-1.5 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg shadow-sm">
                                                <Steps
                                                    size={16}
                                                    className="text-primary-600"
                                                    weight="duotone"
                                                />
                                            </div>
                                            <h2 className="text-sm sm:text-base font-bold text-gray-900">
                                                {toTitleCase(
                                                    getTerminology(
                                                        ContentTerms.Course,
                                                        SystemTerms.Course
                                                    )
                                                )} {" "}
                                                Overview
                                            </h2>
                                        </div>

                                        {/* Course Stats */}
                                        <div className="space-y-2 sm:space-y-3">
                                            {/* Level Badge */}
                                            {levelOptions.length > 0 &&
                                                selectedLevel &&
                                                levelOptions.find(
                                                    (option) =>
                                                        option.value ===
                                                        selectedLevel
                                                )?.label !== "default" && (
                                                    <div className="flex items-center justify-between p-2 sm:p-2.5 bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg border border-primary-200">
                                                        <div className="flex items-center space-x-2">
                                                            <Steps
                                                                size={14}
                                                                className="text-primary-600"
                                                                weight="duotone"
                                                            />
                                                            <span className="text-xs font-medium text-primary-700">
                                                                {toTitleCase(
                                                                    getTerminology(
                                                                        ContentTerms.Level,
                                                                        SystemTerms.Level
                                                                    )
                                                                )}
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

                                            {/* Total Duration */}
                                            {slideCountQuery.isLoading ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between p-2 sm:p-2.5 bg-gray-50 rounded-lg animate-pulse">
                                                        <div className="h-3 w-24 bg-gray-200 rounded"></div>
                                                        <div className="h-3 w-10 bg-gray-200 rounded"></div>
                                                    </div>
                                                </div>
                                            ) : slideCountQuery.error ? (
                                                <div className="p-2 sm:p-2.5 bg-red-50 border border-red-200 rounded-lg">
                                                    <p className="text-xs text-red-600 font-medium">
                                                        Error loading total duration
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between p-2 sm:p-2.5 bg-gray-50/80 rounded-lg">
                                                        <span className="text-xs font-medium text-gray-700">Total Duration</span>
                                                        <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded-md shadow-sm">
                                                            {formatTotalCourseDuration(slideCountQuery.data as unknown as Array<{ slide_count: number; total_read_time_minutes: number | null; source_type: string }>)}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <AuthModal
                                            type="courseDetailsPage"
                                            courseId={searchParams.courseId}
                                            trigger={
                                                <MyButton
                                                    type="button"
                                                    scale="large"
                                                    buttonType="primary"
                                                    layoutVariant="default"
                                                    className="mt-3 sm:mt-4 !min-w-full !w-full"
                                                >
                                                    Enroll
                                                </MyButton>
                                            }
                                        />
                                        <div className="mt-4">
                                            <CourseDetailsRatingsComponent
                                                packageSessionId={packageSessionIdForCurrentLevel}
                                                onRatingsLoadingChange={handleRatingsLoadingChange}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
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
                                onModulesLoadingChange={
                                    handleModulesLoadingChange
                                }
                            />

                            {/* What You'll Learn Section */}
                            {extractTextFromHTML(
                                form.getValues("courseData").whatYoullLearn
                            ) && (
                                <div className="mb-6 sm:mb-8">
                                    <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-bold">
                                        What you&apos;ll learn?
                                    </h2>
                                    <div className="rounded-lg">
                                        <p
                                            className="text-sm sm:text-base leading-relaxed"
                                            dangerouslySetInnerHTML={{
                                                __html:
                                                    form.getValues("courseData")
                                                        .whatYoullLearn || "",
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* About Content Section */}
                            {extractTextFromHTML(
                                form.getValues("courseData").aboutTheCourse
                            ) && (
                                <div className="mb-6 sm:mb-8">
                                    <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-bold">
                                        About this course
                                    </h2>
                                    <div className="rounded-lg">
                                        <p
                                            className="text-sm sm:text-base leading-relaxed"
                                            dangerouslySetInnerHTML={{
                                                __html:
                                                    form.getValues("courseData")
                                                        .aboutTheCourse || "",
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Who Should Join Section */}
                            {extractTextFromHTML(
                                form.getValues("courseData").whoShouldLearn
                            ) && (
                                <div className="mb-6 sm:mb-8">
                                    <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-bold">
                                        Who should join?
                                    </h2>
                                    <div className="rounded-lg">
                                        <p
                                            className="text-sm sm:text-base leading-relaxed"
                                            dangerouslySetInnerHTML={{
                                                __html:
                                                    form.getValues("courseData")
                                                        .whoShouldLearn || "",
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Instructors Section */}
                            {form.getValues("courseData").instructors &&
                                form.getValues("courseData").instructors
                                    .length > 0 && (
                                    <div className="mb-6 sm:mb-8">
                                        <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-bold">
                                            Instructors
                                        </h2>
                                        <div className="space-y-3 sm:space-y-4">
                                            {form
                                                .getValues("courseData")
                                                .instructors.map(
                                                    (instructor, index) => (
                                                        <div
                                                            key={index}
                                                            className="flex gap-3 sm:gap-4 rounded-lg bg-gray-50 p-3 sm:p-4"
                                                        >
                                                            <Avatar className="size-6 sm:size-8 flex-shrink-0">
                                                                <AvatarImage
                                                                    src=""
                                                                    alt={
                                                                        instructor.email
                                                                    }
                                                                />
                                                                <AvatarFallback className="bg-[#3B82F6] text-xs font-medium text-white">
                                                                    {getInitials(
                                                                        instructor.email
                                                                    )}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <h3 className="text-base sm:text-lg font-medium">
                                                                {
                                                                    instructor.name
                                                                }
                                                            </h3>
                                                        </div>
                                                    )
                                                )}
                                        </div>
                                    </div>
                                )}
                        </div>

                        {/* Right Column - Full width on mobile, 1/3 on larger screens */}
                        <div className="hidden lg:block max-w-[350px] lg:w-1/3 lg:max-w-sm mb-12">
                            <CourseStatsSidebar
                                title={form.getValues("courseData").title}
                                levelOptions={levelOptions}
                                selectedLevel={selectedLevel}
                                slideCounts={slideCountQuery.data as SlideCountEntry[]}
                                authorName={form.getValues("courseData").instructors?.[0]?.name}
                                ctaSlot={
                                    <AuthModal
                                        type="courseDetailsPage"
                                        courseId={searchParams.courseId}
                                        trigger={
                                            <MyButton
                                                type="button"
                                                scale="large"
                                                buttonType="primary"
                                                layoutVariant="default"
                                                className="!min-w-full !w-full"
                                            >
                                                Enroll
                                            </MyButton>
                                        }
                                    />
                                }
                                ratingsSlot={
                                    packageSessionIdForCurrentLevel ? (
                                        <CourseDetailsRatingsComponent
                                            packageSessionId={packageSessionIdForCurrentLevel}
                                            onRatingsLoadingChange={handleRatingsLoadingChange}
                                        />
                                     ) : null
                                }
                            />
                        </div>
                    </div>
                    {/* Ratings moved to sidebar below overview */}
                </div>
            </div>
        </>
    );
};
