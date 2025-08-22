import { Steps } from "@phosphor-icons/react";
import { useRouter } from "@tanstack/react-router";
import {
    ChalkboardTeacher,
    Code,
    File,
    FilePdf,
    PlayCircle,
    Question,
    CaretLeft,
    BookOpen,
    GraduationCap,
    Presentation,
    GameController,
    Exam,
    Terminal,
    ClipboardText,
    FileDoc,
    Notebook,
    FileText,
    PresentationChart,
    Folder,
} from "phosphor-react";
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
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { handleGetSlideCountDetails } from "../-services/get-slides-count";
import { CourseDetailsRatingsComponent } from "./course-details-ratings-page";
import { transformApiDataToCourseData } from "../-utils/helper";
import { VideoPlayer } from "./video-player";
import { handleGetAllCourseDetails } from "../-services/get-course-details";
import axios from "axios";
import { urlInstituteDetails } from "@/constants/urls";
import { getInstituteId } from "@/constants/helper";
import { Preferences } from "@capacitor/preferences";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { CourseStructureDetails } from "./course-structure-details";
import { CourseStructureResponse } from "@/types/institute-details/course-details-interface";
import { getIdByLevelAndSession } from "@/routes/courses/course-details/-utils/helper";
import { EnrollmentPaymentDialog } from "./payment-dialogs";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { getSubjectDetails } from "@/routes/courses/course-details/-utils/helper";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, RoleTerms, SystemTerms } from "@/types/naming-settings";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import {
    generateCertificateWithCache,
    getCachedCertificateStatus,
} from "@/services/certificates";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import LocalStorageUtils from "@/utils/localstorage";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MyButton } from "@/components/design-system/button";

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

const heading = (
    <div className="flex items-center">
        <CaretLeft
            onClick={() => window.history.back()}
            className="cursor-pointer"
        />
        <h1 className="text-lg ml-2">
            {getTerminology(ContentTerms.Course, SystemTerms.Course)} Details
        </h1>
    </div>
);

// Add a type for enrolled session - matches BatchForSessionType structure
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

export const CourseDetailsPage = () => {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(heading);
    }, [setNavHeading]);

    const [selectedSession, setSelectedSession] = useState<string>("");
    const [selectedLevel, setSelectedLevel] = useState<string>("");
    const router = useRouter();
    const searchParams = router.state.location.search;
    const [instituteId, setInstituteId] = useState<string | null>(null);
    const [enrolledSessions, setEnrolledSessions] = useState<EnrolledSession[]>(
        []
    );
    const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
    const [showConfetti, setShowConfetti] = useState<boolean>(false);
    const [certificateDialogOpen, setCertificateDialogOpen] =
        useState<boolean>(false);

    // Log certificate-related state changes
    useEffect(() => {
        console.debug("[certificates] state: certificateUrl", certificateUrl);
    }, [certificateUrl]);
    useEffect(() => {
        console.debug("[certificates] state: showConfetti", showConfetti);
    }, [showConfetti]);

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

    // Get selectedTab from route params, default to "ALL" if not provided
    const selectedTab = searchParams.selectedTab || "ALL";

    useEffect(() => {
        const fetchInstituteAndUserId = async () => {
            updateLoadingState("userData", true);
            const instituteResult = await Preferences.get({
                key: "InstituteId",
            });
            setInstituteId(instituteResult.value || null);

            // Fetch user's enrolled sessions
            const sessionListResult = await Preferences.get({
                key: "sessionList",
            });
            if (sessionListResult.value) {
                const sessionList = JSON.parse(sessionListResult.value);
                setEnrolledSessions(
                    Array.isArray(sessionList)
                        ? (sessionList as EnrolledSession[])
                        : [sessionList as EnrolledSession]
                );
            }

            // Fetch invite code from preferences or use default
            const inviteCodeResult = await Preferences.get({
                key: "inviteCode",
            });
            if (inviteCodeResult.value) {
                setInviteCode(inviteCodeResult.value);
            }

            // Fetch authentication token
            const token = await getTokenFromStorage(TokenKey.accessToken);
            if (token) {
                setAuthToken(token);
            }
            updateLoadingState("userData", false);
        };

        fetchInstituteAndUserId();
    }, [updateLoadingState]);

    const [
        packageSessionIdForCurrentLevel,
        setPackageSessionIdForCurrentLevel,
    ] = useState<string | null>(null);

    useEffect(() => {
        const fetchInstituteDetails = async () => {
            console.log("Fetching institute details with:", {
                instituteId,
                selectedSession,
                selectedLevel,
                courseId: searchParams.courseId,
            });
            updateLoadingState("instituteDetails", true);
            const fetchedInstituteId = await getInstituteId();
            try {
                const response = await axios.get(
                    `${urlInstituteDetails}/${fetchedInstituteId}`
                );
                console.log("Institute response:", response.data);
                const packageSessionId = getIdByLevelAndSession(
                    response.data.batches_for_sessions,
                    selectedSession,
                    selectedLevel,
                    searchParams.courseId || ""
                );
                console.log("Package session ID:", packageSessionId);
                setPackageSessionIdForCurrentLevel(packageSessionId);
            } catch (error) {
                console.log(error);
            } finally {
                updateLoadingState("instituteDetails", false);
            }
        };

        // Only fetch when we have the required dependencies
        if (instituteId && selectedSession && selectedLevel) {
            fetchInstituteDetails();
        }
    }, [
        instituteId,
        selectedSession,
        selectedLevel,
        searchParams.courseId,
        updateLoadingState,
    ]);

    // Only run the query if instituteId is available
    const { data: studyLibraryData, isLoading: isCourseDetailsLoading } =
        useSuspenseQuery(
            handleGetAllCourseDetails({
                instituteId: instituteId || "",
            })
        );

    // Update course details loading state
    useEffect(() => {
        updateLoadingState("courseDetails", isCourseDetailsLoading);
    }, [isCourseDetailsLoading, updateLoadingState]);

    const courseDetailsData = useMemo(() => {
        const found = studyLibraryData?.find(
            (item: CourseStructureResponse) =>
                item.course.id === searchParams.courseId
        );
        return found;
    }, [studyLibraryData, searchParams.courseId]);

    // Trigger certificate generation after entering this page once essentials are available
    useEffect(() => {
        const tryGenerateCertificate = async () => {
            try {
                const settings = await getStudentDisplaySettings(false);
                const threshold = settings.certificates?.generationThresholdPercent ?? 800;
                // percent can come from query param (carried over from list) or course data
                const pctFromQuery = ((): number | undefined => {
                    const raw =
                        (searchParams as { [k: string]: unknown })
                            .percentageCompleted ??
                        (searchParams as { [k: string]: unknown })
                            .percentage_completed;
                    if (typeof raw === "number") return raw;
                    if (typeof raw === "string") {
                        const n = Number(raw);
                        return Number.isFinite(n) ? n : undefined;
                    }
                    return undefined;
                })();
                const pctFromCourse =
                    courseDetailsData?.course?.percentage_completed;
                const pctFromLocal = (() => {
                    const key = `COURSE_PCT_${searchParams.courseId}`;
                    const saved = LocalStorageUtils.get<{
                        value: number;
                        ts: number;
                    }>(key);
                    return saved?.value;
                })();
                const percentageCompleted =
                    typeof pctFromQuery === "number" &&
                    !Number.isNaN(pctFromQuery)
                        ? pctFromQuery
                        : typeof pctFromCourse === "number"
                          ? pctFromCourse
                          : typeof pctFromLocal === "number"
                            ? pctFromLocal
                            : undefined;
                const userDetailsRaw = await Preferences.get({
                    key: "StudentDetails",
                });
                const user = userDetailsRaw.value
                    ? JSON.parse(userDetailsRaw.value)
                    : null;
                const userId: string | null = user?.user_id || user?.id || null;

                if (!userId || !packageSessionIdForCurrentLevel) return;

                // Always surface cached certificate if present
                const cached = getCachedCertificateStatus(
                    userId,
                    packageSessionIdForCurrentLevel
                );
                if (cached?.url) {
                    setCertificateUrl(cached.url);
                }

                if (percentageCompleted == null) return;

                if (
                    typeof percentageCompleted === "number" &&
                    percentageCompleted >= threshold
                ) {
                    const celebrationKey = `CERTIFICATE_CELEBRATED_${userId}_${packageSessionIdForCurrentLevel}`;
                    const alreadyCelebrated =
                        !!LocalStorageUtils.get<boolean>(celebrationKey);

                    const res = await generateCertificateWithCache({
                        user_id: userId,
                        package_session_id: packageSessionIdForCurrentLevel,
                    });

                    setCertificateUrl(res.url || null);

                    if (res.status === 200 && !alreadyCelebrated) {
                        // Enhanced multi-burst confetti (professional feel)
                        try {
                            const colors = [
                                "#0ea5e9",
                                "#22c55e",
                                "#f59e0b",
                                "#ef4444",
                                "#8b5cf6",
                            ];
                            const defaults = {
                                colors,
                                origin: { y: 0.6 },
                            } as const;

                            function fire(
                                particleRatio: number,
                                opts: {
                                    [K in keyof import("canvas-confetti").Options]?: import("canvas-confetti").Options[K];
                                } = {}
                            ) {
                                confetti({
                                    ...defaults,
                                    particleCount: Math.floor(
                                        220 * particleRatio
                                    ),
                                    ...opts,
                                });
                            }

                            // Central bursts
                            fire(0.25, { spread: 26, startVelocity: 55 });
                            fire(0.2, { spread: 60 });
                            fire(0.35, {
                                spread: 100,
                                decay: 0.91,
                                scalar: 0.9,
                            });
                            fire(0.1, {
                                spread: 120,
                                startVelocity: 25,
                                decay: 0.92,
                                scalar: 1.2,
                            });
                            fire(0.1, { spread: 120, startVelocity: 45 });

                            // Side cannons
                            confetti({
                                ...defaults,
                                particleCount: 60,
                                angle: 60,
                                spread: 55,
                                origin: { x: 0 },
                                gravity: 0.9,
                            });
                            confetti({
                                ...defaults,
                                particleCount: 60,
                                angle: 120,
                                spread: 55,
                                origin: { x: 1 },
                                gravity: 0.9,
                            });

                            // Subtle fireworks loop for 2s
                            const end = Date.now() + 2000;
                            (function frame() {
                                confetti({
                                    ...defaults,
                                    particleCount: 3,
                                    startVelocity: 40,
                                    ticks: 60,
                                    origin: {
                                        x: Math.random(),
                                        y: Math.random() * 0.4 + 0.2,
                                    },
                                });
                                if (Date.now() < end)
                                    requestAnimationFrame(frame);
                            })();
                        } catch (e) {
                            console.log("[certificates] confetti error", e);
                        }
                        setShowConfetti(true);
                        setTimeout(() => setShowConfetti(false), 3000);
                        // Show professional modal after confetti
                        setTimeout(() => setCertificateDialogOpen(true), 3200);
                        toast.success("Certificate generated successfully!", {
                            description: "You can now view your certificate.",
                        });
                        // Mark celebration as shown to avoid repeating confetti on future visits
                        LocalStorageUtils.set(celebrationKey, true);
                    }
                }
            } catch (err) {
                console.error("Certificate generation failed", err);
                toast.error(
                    "Failed to generate certificate. Please try again later."
                );
            }
        };

        // Only attempt after we have course data and package session id
        if (packageSessionIdForCurrentLevel && courseDetailsData) {
            tryGenerateCertificate();
        }
    }, [
        packageSessionIdForCurrentLevel,
        courseDetailsData,
        searchParams.percentageCompleted,
    ]);

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

    // Watch sessions so memo recomputes when form.reset updates course data
    const watchedSessions = form.watch("courseData.sessions") || [];

    // Convert sessions to select options format - filter based on selectedTab
    const sessionOptions = useMemo(() => {
        const sessions = watchedSessions || [];
        console.log("Form sessions:", sessions);
        console.log("Enrolled sessions:", enrolledSessions);
        console.log("Selected tab:", selectedTab);

        // For PROGRESS and COMPLETED tabs, only show enrolled sessions
        // For ALL tab, show all available sessions
        if (selectedTab === "PROGRESS" || selectedTab === "COMPLETED") {
            const enrolledSessionIds = enrolledSessions.map(
                (enrolled) => enrolled.session.id
            );
            const filteredSessions = sessions.filter((session) =>
                enrolledSessionIds.includes(session.sessionDetails.id)
            );

            // If no enrolled sessions found, show all sessions as fallback
            if (filteredSessions.length === 0 && sessions.length > 0) {
                return sessions.map((session) => ({
                    _id: session.sessionDetails.id,
                    value: session.sessionDetails.id,
                    label: toTitleCase(session.sessionDetails.session_name),
                }));
            }

            return filteredSessions.map((session) => ({
                _id: session.sessionDetails.id,
                value: session.sessionDetails.id,
                label: toTitleCase(session.sessionDetails.session_name),
            }));
        } else {
            // For ALL tab, show all sessions
            return sessions.map((session) => ({
                _id: session.sessionDetails.id,
                value: session.sessionDetails.id,
                label: toTitleCase(session.sessionDetails.session_name),
            }));
        }
    }, [enrolledSessions, selectedTab, watchedSessions]);

    // Update level options when session changes - filter based on selectedTab
    const handleSessionChange = useCallback(
        (sessionId: string) => {
            setSelectedSession(sessionId);
            const sessions = form.getValues("courseData")?.sessions || [];
            const selectedSessionData = sessions.find(
                (session) => session.sessionDetails.id === sessionId
            );

            if (selectedSessionData) {
                let newLevelOptions;

                // For PROGRESS and COMPLETED tabs, only show enrolled levels
                if (selectedTab === "PROGRESS" || selectedTab === "COMPLETED") {
                    // Find the enrolled session to get enrolled level IDs
                    const enrolledSession = enrolledSessions.find(
                        (enrolled) => enrolled.session.id === sessionId
                    );

                    let enrolledLevelIds: string[] = [];
                    if (enrolledSession) {
                        // Extract level ID from enrolled session
                        enrolledLevelIds = [enrolledSession.level.id].filter(
                            Boolean
                        ) as string[];
                    }

                    // Filter levels based on enrollment
                    const filteredLevels =
                        selectedSessionData.levelDetails.filter((level) =>
                            enrolledLevelIds.includes(level.id)
                        );

                    // If no enrolled levels found, show all levels as fallback
                    if (
                        filteredLevels.length === 0 &&
                        selectedSessionData.levelDetails.length > 0
                    ) {
                        newLevelOptions = selectedSessionData.levelDetails.map(
                            (level) => ({
                                _id: level.id,
                                value: level.id,
                                label: level.name,
                            })
                        );
                    } else {
                        newLevelOptions = filteredLevels.map((level) => ({
                            _id: level.id,
                            value: level.id,
                            label: level.name,
                        }));
                    }
                } else {
                    // For ALL tab, show all levels
                    newLevelOptions = selectedSessionData.levelDetails.map(
                        (level) => ({
                            _id: level.id,
                            value: level.id,
                            label: level.name,
                        })
                    );
                }

                setLevelOptions(newLevelOptions);

                // Select the first level when session changes
                if (newLevelOptions.length > 0 && newLevelOptions[0]?.value) {
                    setSelectedLevel(newLevelOptions[0].value);
                } else {
                    setSelectedLevel("");
                }
            }
        },
        [enrolledSessions, form, selectedTab]
    );

    // Handle level change - clear expanded items and reset state
    const handleLevelChange = (levelId: string) => {
        setSelectedLevel(levelId);
    };

    // Set initial session and its levels - auto-select if only one option
    useEffect(() => {
        console.log("Session options:", sessionOptions);
        console.log("Selected session:", selectedSession);
        console.log("Selected level:", selectedLevel);

        if (
            sessionOptions.length > 0 &&
            !selectedSession &&
            sessionOptions[0]?.value
        ) {
            const initialSessionId = sessionOptions[0].value;
            console.log("Setting initial session:", initialSessionId);
            handleSessionChange(initialSessionId);
        }
    }, [sessionOptions, selectedSession, selectedLevel, handleSessionChange]);

    useEffect(() => {
        const loadCourseData = async () => {
            console.log("Loading course data:", courseDetailsData);
            if (courseDetailsData?.course) {
                try {
                    const transformedData =
                        await transformApiDataToCourseData(courseDetailsData);
                    console.log("Transformed data:", transformedData);
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

    // Calculate module statistics
    useEffect(() => {
        const currentSubjects = getSubjectDetails(
            form.getValues(),
            selectedSession,
            selectedLevel
        );

        let totalModules = 0;
        let totalChapters = 0;
        const totalSubjects = currentSubjects.length;

        // Calculate modules and chapters for non-depth-5 courses
        if (form.getValues("courseData.courseStructure") !== 5) {
            currentSubjects.forEach((subject) => {
                const subj = subject as unknown as {
                    modules?: Array<{ chapters?: Array<unknown> }>;
                };
                if (Array.isArray(subj.modules)) {
                    totalModules += subj.modules.length;
                    subj.modules.forEach((module) => {
                        if (Array.isArray(module.chapters)) {
                            totalChapters += module.chapters.length;
                        }
                    });
                }
            });
        }

        setModuleStats({
            totalModules,
            totalChapters,
            totalSubjects,
        });
    }, [selectedSession, selectedLevel, form]);

    // Add this with other queries at the top level of the component
    const slideCountQuery = useQuery({
        ...handleGetSlideCountDetails(packageSessionIdForCurrentLevel || ""),
        enabled: !!packageSessionIdForCurrentLevel,
    });

    // Update slide count loading state
    useEffect(() => {
        updateLoadingState("slideCount", slideCountQuery.isLoading);
    }, [slideCountQuery.isLoading, updateLoadingState]);

    // Custom slide count calculation to handle special document types
    const processedSlideCounts = useMemo(() => {
        if (!slideCountQuery.data) return [];

        const counts = slideCountQuery.data as SlideCountType[];

        const processedCounts: {
            source_type: string;
            slide_count: number;
            display_name: string;
        }[] = [];

        // Create a map to track counts for different types
        const typeCounts: { [key: string]: number } = {};

        // Track if we have specific document types to avoid duplicates
        const hasSpecificDocumentTypes = counts.some(
            (count) =>
                count.source_type === "JUPYTER_NOTEBOOK" ||
                count.source_type === "CODE_EDITOR" ||
                count.source_type === "PRESENTATION" ||
                count.source_type === "SCRATCH_PROJECT"
        );

        counts.forEach((count) => {
            let canonicalType = count.source_type;
            if (canonicalType === "JUPYTER") canonicalType = "JUPYTER_NOTEBOOK";
            if (canonicalType === "SCRATCH") canonicalType = "SCRATCH_PROJECT";
            if (canonicalType === "DOCUMENT") {
                // Only add DOCUMENT count if we don't have specific document types
                // This prevents duplicates when we have JUPYTER_NOTEBOOK, CODE_EDITOR, etc.
                if (!hasSpecificDocumentTypes) {
                    typeCounts["DOCUMENT"] =
                        (typeCounts["DOCUMENT"] || 0) + count.slide_count;
                }
            } else {
                typeCounts[canonicalType] =
                    (typeCounts[canonicalType] || 0) + count.slide_count;
            }
        });

        // Convert the map to the required format
        Object.entries(typeCounts).forEach(([sourceType, slideCount]) => {
            let displayName = "";
            switch (sourceType) {
                case "VIDEO":
                    displayName = "Video slides";
                    break;
                case "CODE":
                    displayName = "Code slides";
                    break;
                case "PDF":
                    displayName = "PDF slides";
                    break;
                case "DOCUMENT":
                    displayName = "DOC slides";
                    break;
                case "QUESTION":
                    displayName = "Question slides";
                    break;
                case "ASSIGNMENT":
                    displayName = "Assignment slides";
                    break;
                case "PRESENTATION":
                    displayName = "Presentation slides";
                    break;
                case "JUPYTER_NOTEBOOK":
                case "JUPYTER":
                    displayName = "Jupyter Notebook slides";
                    break;
                case "SCRATCH_PROJECT":
                case "SCRATCH":
                    displayName = "Scratch Project slides";
                    break;
                case "QUIZ":
                    displayName = "Quiz slides";
                    break;
                case "CODE_EDITOR":
                    displayName = "Code Editor slides";
                    break;
                default:
                    displayName = `${sourceType} slides`;
            }

            processedCounts.push({
                source_type: sourceType,
                slide_count: slideCount,
                display_name: displayName,
            });
        });

        return processedCounts;
    }, [slideCountQuery.data]);

    const [enrollmentDialogOpen, setEnrollmentDialogOpen] = useState(false);
    const [inviteCode, setInviteCode] = useState<string>("default");
    const [authToken, setAuthToken] = useState<string>("");
    const [moduleStats, setModuleStats] = useState({
        totalModules: 0,
        totalChapters: 0,
        totalSubjects: 0,
    });

    // Student display settings flags
    const [showCourseConfiguration, setShowCourseConfiguration] =
        useState<boolean>(true);
    const [overviewVisible, setOverviewVisible] = useState<boolean>(true);

    useEffect(() => {
        getStudentDisplaySettings(false)
            .then((settings) => {
                console.log("Student Display Settings:", settings);
                const cd = settings?.courseDetails;
                console.log("Student Display Settings - courseDetails:", cd);
                if (cd) {
                    const resolvedShowCourseConfiguration =
                        cd.showCourseConfiguration ?? true;
                    const resolvedOverviewVisible =
                        cd.courseOverview?.visible ?? true;
                    const resolvedShowCourseContentPrefixes =
                        cd.showCourseContentPrefixes ?? true;
                    console.log("Student Display Settings - resolved flags:", {
                        showCourseConfiguration:
                            resolvedShowCourseConfiguration,
                        overviewVisible: resolvedOverviewVisible,
                        showCourseContentPrefixes:
                            resolvedShowCourseContentPrefixes,
                    });
                    setShowCourseConfiguration(resolvedShowCourseConfiguration);
                    setOverviewVisible(resolvedOverviewVisible);
                } else {
                    console.log(
                        "Student Display Settings - courseDetails not found, using defaults"
                    );
                }
            })
            .catch((error) => {
                console.log(
                    "Failed to load Student Display Settings, using defaults. Error:",
                    error
                );
                setShowCourseConfiguration(true);
                setOverviewVisible(true);
            });
    }, []);

    const hasRightSidebar = overviewVisible;

    // Function to update module statistics for depth 5 courses
    const updateModuleStats = (
        modulesData: Record<string, Array<{ chapters?: Array<unknown> }>>
    ) => {
        if (form.getValues("courseData.courseStructure") === 5) {
            let totalModules = 0;
            let totalChapters = 0;

            Object.values(modulesData).forEach((modules) => {
                totalModules += modules.length;
                modules.forEach((module) => {
                    if (module.chapters) {
                        totalChapters += module.chapters.length;
                    }
                });
            });

            setModuleStats((prev) => ({
                ...prev,
                totalModules,
                totalChapters,
            }));
        }
    };

    const getSlideTypeIcon = (type: string) => {
        switch (type) {
            case "VIDEO":
                return (
                    <PlayCircle
                        size={16}
                        className="text-blue-600 group-hover/item:scale-110 transition-transform duration-300"
                        weight="duotone"
                    />
                );
            case "CODE":
                return (
                    <Code
                        size={16}
                        className="text-green-600 group-hover/item:scale-110 transition-transform duration-300"
                        weight="duotone"
                    />
                );
            case "PDF":
                return (
                    <FilePdf
                        size={16}
                        className="text-red-600 group-hover/item:scale-110 transition-transform duration-300"
                        weight="duotone"
                    />
                );
            case "DOCUMENT":
                return (
                    <FileDoc
                        size={16}
                        className="text-purple-600 group-hover/item:scale-110 transition-transform duration-300"
                        weight="duotone"
                    />
                );
            case "QUESTION":
                return (
                    <Question
                        size={16}
                        className="text-orange-600 group-hover/item:scale-110 transition-transform duration-300"
                        weight="duotone"
                    />
                );
            case "ASSIGNMENT":
                return (
                    <ClipboardText
                        size={16}
                        className="text-indigo-600 group-hover/item:scale-110 transition-transform duration-300"
                        weight="duotone"
                    />
                );
            case "PRESENTATION":
                return (
                    <Presentation
                        size={16}
                        className="text-cyan-600 group-hover/item:scale-110 transition-transform duration-300"
                        weight="duotone"
                    />
                );
            case "JUPYTER_NOTEBOOK":
            case "JUPYTER":
                return (
                    <Notebook
                        size={16}
                        className="text-yellow-600 group-hover/item:scale-110 transition-transform duration-300"
                        weight="duotone"
                    />
                );
            case "SCRATCH_PROJECT":
            case "SCRATCH":
                return (
                    <GameController
                        size={16}
                        className="text-pink-600 group-hover/item:scale-110 transition-transform duration-300"
                        weight="duotone"
                    />
                );
            case "QUIZ":
                return (
                    <Exam
                        size={16}
                        className="text-teal-600 group-hover/item:scale-110 transition-transform duration-300"
                        weight="duotone"
                    />
                );
            case "CODE_EDITOR":
                return (
                    <Terminal
                        size={16}
                        className="text-gray-600 group-hover/item:scale-110 transition-transform duration-300"
                        weight="duotone"
                    />
                );
            default:
                return (
                    <File
                        size={16}
                        className="text-gray-500 group-hover/item:scale-110 transition-transform duration-300"
                        weight="duotone"
                    />
                );
        }
    };

    // Debug logging
    console.log("Loading states:", loadingStates);
    console.log("isLoading:", isLoading);
    console.log("instituteId:", instituteId);
    console.log("studyLibraryData:", studyLibraryData);
    console.log(
        "packageSessionIdForCurrentLevel:",
        packageSessionIdForCurrentLevel
    );
    console.log("Student Display Settings flags:", {
        showCourseConfiguration,
        overviewVisible,
    });

    // Show loading until essential data is ready; defer packageSessionId-dependent UI below
    if (isLoading || !instituteId || !studyLibraryData) {
        return <DashboardLoader />;
    }

    // Debug logging for CourseStructureDetails props
    console.log("Rendering CourseStructureDetails with props:", {
        selectedSession,
        selectedLevel,
        courseStructure: form.getValues("courseData.courseStructure"),
        packageSessionId: packageSessionIdForCurrentLevel,
        selectedTab,
        courseData: form.getValues(),
    });

    return (
        <>
            {/* Enrollment Payment Dialog */}
            <EnrollmentPaymentDialog
                open={enrollmentDialogOpen}
                onOpenChange={setEnrollmentDialogOpen}
                packageSessionId={packageSessionIdForCurrentLevel || ""}
                instituteId={instituteId || ""}
                token={authToken}
                courseTitle={form.getValues("courseData").title}
                inviteCode={inviteCode}
            />
            <div className="min-h-screen bg-gradient-to-br from-gray-50/80 via-white to-primary-50/20 relative overflow-hidden w-full max-w-full">
                {/* Animated background elements */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-32 md:w-64 h-32 md:h-64 bg-gradient-to-br from-primary-100/20 to-transparent rounded-full blur-3xl animate-gentle-pulse"></div>
                    <div
                        className="absolute bottom-1/3 right-1/3 w-40 md:w-80 h-40 md:h-80 bg-gradient-to-br from-primary-50/30 to-transparent rounded-full blur-3xl animate-gentle-pulse"
                        style={{ animationDelay: "2s" }}
                    ></div>
                </div>

                {/* Enhanced Top Banner (always visible) */}
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
                        <div className="absolute inset-0 z-10 bg-gradient-to-br from-black/20 via-black/10 to-transparent dark:from-black/50 dark:via-black/40 dark:to-transparent" />

                        {/* Floating orb effects */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-3xl opacity-70 -translate-y-2 translate-x-6"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary-300/20 rounded-full blur-3xl opacity-50 translate-y-6 -translate-x-6"></div>

                        {/* Content Container */}
                        <div className="relative z-20 h-full">
                            <div className="max-w-7xl mx-auto px-2 sm:px-3 lg:px-4 h-full flex items-center">
                                {form.watch("courseData").courseMediaId ? (
                                    // Layout with video - 3/5 and 2/5 split
                                    <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-3 lg:gap-4 items-center">
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
                                                    <div className="mb-1.5 sm:mb-2 flex flex-wrap gap-1.5">
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
                                                                        className="bg-white/20 border border-white/30 text-white px-2.5 py-1 rounded-md text-xs font-medium hover:bg-white/30 transition-all duration-200"
                                                                    >
                                                                        {tag}
                                                                    </span>
                                                                )
                                                            )}
                                                    </div>

                                                    {/* Title */}
                                                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1.5 sm:mb-2 leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                                                        {toTitleCase(
                                                            form.getValues(
                                                                "courseData"
                                                            ).title
                                                        )}
                                                    </h1>

                                                    {/* Description */}
                                                    <div
                                                        className="text-sm sm:text-base opacity-90 leading-relaxed line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
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
                                            className="hidden lg:block lg:col-span-2 animate-fade-in-up"
                                            style={{ animationDelay: "0.2s" }}
                                        >
                                            <VideoPlayer
                                                src={
                                                    form.watch("courseData")
                                                        .courseMediaId
                                                }
                                            />
                                            {/* Certificate CTA moved to Course Configuration section */}
                                        </div>
                                    </div>
                                ) : (
                                    // Layout without video - full width
                                    <div className="w-full text-center text-white animate-fade-in-up">
                                        {!form.watch("courseData").title ? (
                                            <div className="space-y-3 max-w-3xl mx-auto">
                                                <div className="h-6 w-32 animate-pulse rounded bg-white/20 mx-auto" />
                                                <div className="h-8 sm:h-10 w-3/4 animate-pulse rounded bg-white/20 mx-auto" />
                                                <div className="h-4 w-full animate-pulse rounded bg-white/20" />
                                                <div className="h-4 w-2/3 animate-pulse rounded bg-white/20 mx-auto" />
                                            </div>
                                        ) : (
                                            <div className="max-w-4xl mx-auto">
                                                {/* Tags */}
                                                <div className="mb-2 sm:mb-3 flex flex-wrap gap-2 justify-center">
                                                    {form
                                                        .getValues("courseData")
                                                        .tags.map(
                                                            (tag, index) => (
                                                                <span
                                                                    key={index}
                                                                    className="bg-white/20 border border-white/30 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-white/30 transition-all duration-200"
                                                                >
                                                                    {tag}
                                                                </span>
                                                            )
                                                        )}
                                                </div>

                                                {/* Title */}
                                                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 sm:mb-3 leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                                                    {toTitleCase(
                                                        form.getValues(
                                                            "courseData"
                                                        ).title
                                                    )}
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

                                                {/* Certificate CTA moved to Course Configuration section */}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lightweight confetti placeholder overlay (replace with library later) */}
                {showConfetti && (
                    <div className="pointer-events-none fixed inset-0 z-[1000] overflow-hidden">
                        <div className="absolute inset-0 bg-transparent animate-pulse" />
                    </div>
                )}

                {/* Certificate Modal */}
                <Dialog
                    open={certificateDialogOpen}
                    onOpenChange={setCertificateDialogOpen}
                >
                    <DialogContent className="max-w-md p-0 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-primary-600 to-primary-500 text-white px-5 py-4 flex items-center gap-3"
                            style={{
                                background:
                                    "linear-gradient(to right, var(--color-primary-600, #2563eb), var(--color-primary-500, #3b82f6))",
                                color: "#fff",
                            }}
                        >
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                <GraduationCap
                                    size={18}
                                    className="text-white"
                                />
                            </div>
                            <div>
                                <div className="text-base font-semibold">
                                    Course Completed
                                </div>
                                <div className="text-xs opacity-90">
                                    Congratulations! You’ve earned a
                                    certificate.
                                </div>
                            </div>
                        </div>
                        <div className="px-5 py-4">
                            {(() => {
                                const sessionLabel = (
                                    sessionOptions || []
                                ).find(
                                    (o) => o.value === selectedSession
                                )?.label;
                                const levelLabel = (levelOptions || []).find(
                                    (o) => o.value === selectedLevel
                                )?.label;
                                const isSessionVisible =
                                    !!sessionLabel &&
                                    sessionLabel.toLowerCase() !== "default";
                                const isLevelVisible =
                                    !!levelLabel &&
                                    levelLabel.toLowerCase() !== "default";
                                return (
                                    <div className="space-y-2 text-sm">
                                        <div>
                                            <span className="font-medium text-gray-700">
                                                Course:
                                            </span>
                                            <span className="ml-2">
                                                {toTitleCase(
                                                    form.getValues("courseData")
                                                        .title
                                                )}
                                            </span>
                                        </div>
                                        {isSessionVisible && (
                                            <div>
                                                <span className="font-medium text-gray-700">
                                                    Session:
                                                </span>
                                                <span className="ml-2">
                                                    {toTitleCase(
                                                        sessionLabel || ""
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                        {isLevelVisible && (
                                            <div>
                                                <span className="font-medium text-gray-700">
                                                    Level:
                                                </span>
                                                <span className="ml-2">
                                                    {toTitleCase(
                                                        levelLabel || ""
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                            <div className="mt-4 -mx-5 px-5 py-3 bg-gray-50 dark:bg-neutral-900/50 border-t border-gray-200 dark:border-neutral-800 flex items-center justify-end gap-2">
                                <MyButton
                                    buttonType="secondary"
                                    scale="medium"
                                    onClick={() =>
                                        setCertificateDialogOpen(false)
                                    }
                                >
                                    Close
                                </MyButton>
                                <MyButton
                                    asChild
                                    buttonType="primary"
                                    scale="medium"
                                >
                                    <a
                                        href={certificateUrl || undefined}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() =>
                                            setCertificateDialogOpen(false)
                                        }
                                    >
                                        View Certificate
                                    </a>
                                </MyButton>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
                {/* Video Player for non-lg screens (always visible if course has media) */}
                {form.watch("courseData").courseMediaId && (
                    <div className="lg:hidden relative z-10 max-w-[350px] px-2 sm:px-3 py-3">
                        <div className="bg-white border border-gray-200 rounded-md shadow-sm p-2 sm:p-3">
                            <VideoPlayer
                                src={form.watch("courseData").courseMediaId}
                            />
                        </div>
                    </div>
                )}

                {/* Main Content Container */}
                <div className="relative z-10 max-w-7xl mx-auto px-2 sm:px-3 lg:px-4 py-3 lg:py-4">
                    <div
                        className={`grid grid-cols-1 ${hasRightSidebar ? "lg:grid-cols-4" : ""} gap-3 lg:gap-4`}
                    >
                        {/* Left Column - Course Content (3/4) */}
                        <div
                            className={`${hasRightSidebar ? "lg:col-span-3" : ""} space-y-3 lg:space-y-4`}
                        >
                            {/* Certificate Card (separate from Course Configuration) */}
                            {certificateUrl && (
                                <div
                                    className="relative bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-all duration-200 p-3 sm:p-4 group animate-fade-in-up"
                                    style={{ animationDelay: "0.05s" }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>
                                    <div className="relative flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-md shadow-sm">
                                                <GraduationCap
                                                    size={18}
                                                    className="text-emerald-600"
                                                    weight="duotone"
                                                />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-gray-900">
                                                    Certificate available
                                                </div>
                                                <div className="text-xs text-gray-600">
                                                    You can view or download
                                                    your certificate now.
                                                </div>
                                            </div>
                                        </div>
                                        <a
                                            href={certificateUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1.5 rounded-md text-xs font-medium shadow"
                                        >
                                            View Certificate
                                        </a>
                                    </div>
                                </div>
                            )}
                            {/* Enhanced Session and Level Selectors */}
                            {showCourseConfiguration && (
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

                                        {sessionOptions &&
                                        sessionOptions.length > 0 ? (
                                            <div>
                                                {/* Preview notice for ALL tab - only show if user is not enrolled */}
                                                {selectedTab === "ALL" &&
                                                    (() => {
                                                        // Check if user is enrolled in this course
                                                        const isEnrolledInCourse =
                                                            enrolledSessions.some(
                                                                (
                                                                    enrolledSession
                                                                ) => {
                                                                    return (
                                                                        enrolledSession
                                                                            .package_dto
                                                                            .id ===
                                                                        searchParams.courseId
                                                                    );
                                                                }
                                                            );

                                                        // Only show preview mode message if user is NOT enrolled
                                                        if (
                                                            !isEnrolledInCourse
                                                        ) {
                                                            return (
                                                                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                                    <div className="flex items-center space-x-2">
                                                                        <div className="w-2 h-2 bg-blue-500 rounded-sm"></div>
                                                                        <span className="text-sm font-medium text-blue-800">
                                                                            {getTerminology(
                                                                                ContentTerms.Course,
                                                                                SystemTerms.Course
                                                                            )}{" "}
                                                                            Preview
                                                                            Mode
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs text-blue-700 mt-1">
                                                                        Browse{" "}
                                                                        {getTerminology(
                                                                            ContentTerms.Course,
                                                                            SystemTerms.Course
                                                                        ).toLocaleLowerCase()}{" "}
                                                                        structure.
                                                                        Enroll
                                                                        to
                                                                        access{" "}
                                                                        {getTerminology(
                                                                            ContentTerms.Slides,
                                                                            SystemTerms.Slides
                                                                        ).toLocaleLowerCase()}
                                                                        s and
                                                                        materials.
                                                                    </p>
                                                                </div>
                                                            );
                                                        }

                                                        // If user is enrolled, don't show preview mode message
                                                        return null;
                                                    })()}

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                                                    {/* Session Selector */}
                                                    {sessionOptions &&
                                                        sessionOptions.length >
                                                            0 &&
                                                        // Hide if only one and label is 'default'
                                                        (sessionOptions.length ===
                                                            1 &&
                                                        sessionOptions[0]
                                                            .label ===
                                                            "default" ? null : sessionOptions.length ===
                                                          1 ? (
                                                            <div className="p-2.5 bg-gray-50/80 rounded-lg border border-gray-200">
                                                                <span className="text-sm font-medium text-gray-900">
                                                                    {
                                                                        sessionOptions[0]
                                                                            ?.label
                                                                    }
                                                                </span>
                                                            </div>
                                                        ) : sessionOptions.length >
                                                          1 ? (
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
                                                        ) : null)}

                                                    {/* Level Selector */}
                                                    {levelOptions &&
                                                        levelOptions.length >
                                                            0 &&
                                                        // Hide if only one and label is 'default'
                                                        (levelOptions.length ===
                                                            1 &&
                                                        levelOptions[0]
                                                            .label ===
                                                            "default" ? null : levelOptions.length ===
                                                          1 ? (
                                                            <div className="p-2.5 bg-gray-50/80 rounded-lg border border-gray-200">
                                                                <span className="text-sm font-medium text-gray-900">
                                                                    {
                                                                        levelOptions[0]
                                                                            ?.label
                                                                    }
                                                                </span>
                                                            </div>
                                                        ) : levelOptions.length >
                                                          1 ? (
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
                                                        ) : null)}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-2 h-2 bg-yellow-500 rounded-sm"></div>
                                                    <span className="text-sm font-medium text-yellow-800">
                                                        {selectedTab === "ALL"
                                                            ? `No ${getTerminology(
                                                                  ContentTerms.Session,
                                                                  SystemTerms.Session
                                                              ).toLocaleLowerCase()} available for this ${getTerminology(
                                                                  ContentTerms.Course,
                                                                  SystemTerms.Course
                                                              ).toLocaleLowerCase()}`
                                                            : `You are not enrolled in any ${getTerminology(
                                                                  ContentTerms.Session,
                                                                  SystemTerms.Session
                                                              ).toLocaleLowerCase()} for this ${getTerminology(
                                                                  ContentTerms.Course,
                                                                  SystemTerms.Course
                                                              ).toLocaleLowerCase()}`}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-yellow-700 mt-1">
                                                    {selectedTab === "ALL"
                                                        ? `This ${getTerminology(
                                                              ContentTerms.Course,
                                                              SystemTerms.Course
                                                          ).toLocaleLowerCase()} may not have any active ${getTerminology(
                                                              ContentTerms.Session,
                                                              SystemTerms.Session
                                                          ).toLocaleLowerCase()}s configured.`
                                                        : `Please contact your ${getTerminology(
                                                              RoleTerms.Teacher,
                                                              SystemTerms.Teacher
                                                          ).toLocaleLowerCase()} or ${getTerminology(
                                                              RoleTerms.Admin,
                                                              SystemTerms.Admin
                                                          ).toLocaleLowerCase()} to get enrolled.`}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Course Structure (always rendered; internal logic will adapt to enrollment/public) */}
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
                                    selectedTab={selectedTab}
                                    updateModuleStats={updateModuleStats}
                                    isEnrolledInCourse={enrolledSessions.some(
                                        (enrolledSession) =>
                                            enrolledSession.package_dto.id ===
                                            searchParams.courseId
                                    )}
                                    onLoadingChange={handleModulesLoadingChange}
                                />
                            </div>

                            {/* Inline Enroll card when sidebar is hidden */}
                            {!hasRightSidebar &&
                                selectedTab === "ALL" &&
                                (() => {
                                    if (!selectedSession || !selectedLevel)
                                        return null;
                                    const isAlreadyEnrolled =
                                        enrolledSessions.some(
                                            (enrolledSession) =>
                                                enrolledSession.package_dto
                                                    .id ===
                                                    searchParams.courseId &&
                                                enrolledSession.session.id ===
                                                    selectedSession &&
                                                enrolledSession.level.id ===
                                                    selectedLevel
                                        );
                                    if (isAlreadyEnrolled) return null;
                                    return (
                                        <div className="relative bg-white border border-gray-200 rounded-md shadow-sm p-2 sm:p-3">
                                            <MyButton
                                                type="button"
                                                scale="large"
                                                buttonType="primary"
                                                layoutVariant="default"
                                                className="!min-w-full !w-full text-xs h-8"
                                                onClick={() =>
                                                    setEnrollmentDialogOpen(
                                                        true
                                                    )
                                                }
                                            >
                                                Enroll
                                            </MyButton>
                                        </div>
                                    );
                                })()}

                            {/* Content Sections */}
                            <div className="space-y-4">
                                {/* What You'll Learn Section */}
                                {form.getValues("courseData")
                                    .whatYoullLearn && (
                                    <div
                                        className="relative bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-all duration-300 p-3 sm:p-4 group animate-fade-in-up"
                                        style={{ animationDelay: "0.3s" }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-success-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>
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
                                        className="relative bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-all duration-300 p-3 sm:p-4 group animate-fade-in-up"
                                        style={{ animationDelay: "0.4s" }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>
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
                                                    About this{" "}
                                                    {getTerminology(
                                                        ContentTerms.Course,
                                                        SystemTerms.Course
                                                    ).toLocaleLowerCase()}
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
                                        className="relative bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-all duration-300 p-3 sm:p-4 group animate-fade-in-up"
                                        style={{ animationDelay: "0.5s" }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>
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
                                            className="relative bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-all duration-300 p-3 sm:p-4 group animate-fade-in-up"
                                            style={{ animationDelay: "0.6s" }}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>
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
                                                        {getTerminology(
                                                            RoleTerms.Teacher,
                                                            SystemTerms.Teacher
                                                        ).toLocaleLowerCase()}
                                                        s
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
                        {hasRightSidebar && (
                            <div className="lg:col-span-1">
                                <div className="sticky top-4 space-y-4">
                                    {overviewVisible && (
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
                                                            (option) =>
                                                                option.value ===
                                                                selectedLevel
                                                        )?.label !==
                                                            "default" && (
                                                            <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg border border-primary-200">
                                                                <div className="flex items-center space-x-2">
                                                                    <Steps
                                                                        size={
                                                                            16
                                                                        }
                                                                        className="text-primary-600"
                                                                        weight="duotone"
                                                                    />
                                                                    <span className="text-xs font-medium text-primary-700">
                                                                        {getTerminology(
                                                                            ContentTerms.Level,
                                                                            SystemTerms.Level
                                                                        ).toLocaleLowerCase()}
                                                                    </span>
                                                                </div>
                                                                <span className="text-xs font-bold text-primary-800">
                                                                    {
                                                                        levelOptions.find(
                                                                            (
                                                                                option
                                                                            ) =>
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
                                                            {[
                                                                1, 2, 3, 4, 5,
                                                            ].map((i) => (
                                                                <div
                                                                    key={i}
                                                                    className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg animate-pulse"
                                                                >
                                                                    <div className="h-3 w-16 bg-gray-200 rounded"></div>
                                                                    <div className="h-3 w-6 bg-gray-200 rounded"></div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : slideCountQuery.error ? (
                                                        <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
                                                            <p className="text-xs text-red-600 font-medium">
                                                                Error loading{" "}
                                                                {getTerminology(
                                                                    ContentTerms.Slides,
                                                                    SystemTerms.Slides
                                                                ).toLocaleLowerCase()}
                                                                counts
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {processedSlideCounts.map(
                                                                (count: {
                                                                    source_type: string;
                                                                    slide_count: number;
                                                                    display_name: string;
                                                                }) => (
                                                                    <div
                                                                        key={
                                                                            count.source_type
                                                                        }
                                                                        className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg hover:bg-gray-100/80 transition-all duration-300 group/item"
                                                                    >
                                                                        <div className="flex items-center space-x-2">
                                                                            {getSlideTypeIcon(
                                                                                count.source_type
                                                                            )}
                                                                            <span className="text-xs font-medium text-gray-700">
                                                                                {
                                                                                    count.display_name
                                                                                }
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

                                                            {/* Module Statistics */}
                                                            {(() => {
                                                                const currentSubjects =
                                                                    getSubjectDetails(
                                                                        form.getValues(),
                                                                        selectedSession,
                                                                        selectedLevel
                                                                    );

                                                                return (
                                                                    <>
                                                                        {/* Total Modules */}
                                                                        {moduleStats.totalModules >
                                                                            0 && (
                                                                            <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg hover:bg-gray-100/80 transition-all duration-300 group/item">
                                                                                <div className="flex items-center space-x-2">
                                                                                    <FileText
                                                                                        size={
                                                                                            16
                                                                                        }
                                                                                        className="text-blue-600 group-hover/item:scale-110 transition-transform duration-300"
                                                                                        weight="duotone"
                                                                                    />
                                                                                    <span className="text-xs font-medium text-gray-700">
                                                                                        {getTerminology(
                                                                                            ContentTerms.Modules,
                                                                                            SystemTerms.Modules
                                                                                        )}
                                                                                    </span>
                                                                                </div>
                                                                                <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded-md shadow-sm">
                                                                                    {
                                                                                        moduleStats.totalModules
                                                                                    }
                                                                                </span>
                                                                            </div>
                                                                        )}

                                                                        {/* Total Chapters */}
                                                                        {moduleStats.totalChapters >
                                                                            0 && (
                                                                            <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg hover:bg-gray-100/80 transition-all duration-300 group/item">
                                                                                <div className="flex items-center space-x-2">
                                                                                    <PresentationChart
                                                                                        size={
                                                                                            16
                                                                                        }
                                                                                        className="text-green-600 group-hover/item:scale-110 transition-transform duration-300"
                                                                                        weight="duotone"
                                                                                    />
                                                                                    <span className="text-xs font-medium text-gray-700">
                                                                                        {getTerminology(
                                                                                            ContentTerms.Chapters,
                                                                                            SystemTerms.Chapters
                                                                                        )}
                                                                                    </span>
                                                                                </div>
                                                                                <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded-md shadow-sm">
                                                                                    {
                                                                                        moduleStats.totalChapters
                                                                                    }
                                                                                </span>
                                                                            </div>
                                                                        )}

                                                                        {/* Total Subjects (for depth 5) */}
                                                                        {form.getValues(
                                                                            "courseData.courseStructure"
                                                                        ) ===
                                                                            5 &&
                                                                            currentSubjects.length >
                                                                                0 && (
                                                                                <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg hover:bg-gray-100/80 transition-all duration-300 group/item">
                                                                                    <div className="flex items-center space-x-2">
                                                                                        <Folder
                                                                                            size={
                                                                                                16
                                                                                            }
                                                                                            className="text-purple-600 group-hover/item:scale-110 transition-transform duration-300"
                                                                                            weight="duotone"
                                                                                        />
                                                                                        <span className="text-xs font-medium text-gray-700">
                                                                                            {getTerminology(
                                                                                                ContentTerms.Subjects,
                                                                                                SystemTerms.Subjects
                                                                                            )}
                                                                                        </span>
                                                                                    </div>
                                                                                    <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded-md shadow-sm">
                                                                                        {
                                                                                            currentSubjects.length
                                                                                        }
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                    </>
                                                                );
                                                            })()}

                                                            {/* Instructors Count */}
                                                            {form.getValues(
                                                                "courseData"
                                                            ).instructors
                                                                .length > 0 && (
                                                                <div className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg hover:bg-gray-100/80 transition-all duration-300 group/item">
                                                                    <div className="flex items-center space-x-2">
                                                                        <ChalkboardTeacher
                                                                            size={
                                                                                16
                                                                            }
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
                                                {/* Only show enroll button for ALL tab when user is not enrolled */}
                                                {selectedTab === "ALL" &&
                                                    (() => {
                                                        // Only show enrollment options if session and level are selected
                                                        if (
                                                            !selectedSession ||
                                                            !selectedLevel
                                                        ) {
                                                            return null; // Don't show anything if session/level not selected
                                                        }

                                                        // Check if user is already enrolled in this course
                                                        const isAlreadyEnrolled =
                                                            enrolledSessions.some(
                                                                (
                                                                    enrolledSession
                                                                ) => {
                                                                    // Check if the enrolled session matches the current course
                                                                    // The package_dto.id represents the course/package ID
                                                                    return (
                                                                        enrolledSession
                                                                            .package_dto
                                                                            .id ===
                                                                            searchParams.courseId &&
                                                                        enrolledSession
                                                                            .session
                                                                            .id ===
                                                                            selectedSession &&
                                                                        enrolledSession
                                                                            .level
                                                                            .id ===
                                                                            selectedLevel
                                                                    );
                                                                }
                                                            );

                                                        // Only show enroll button if not already enrolled
                                                        return !isAlreadyEnrolled ? (
                                                            <MyButton
                                                                type="button"
                                                                scale="large"
                                                                buttonType="primary"
                                                                layoutVariant="default"
                                                                className="mt-2 !min-w-full !w-full text-xs h-8"
                                                                onClick={() =>
                                                                    setEnrollmentDialogOpen(
                                                                        true
                                                                    )
                                                                }
                                                            >
                                                                Enroll
                                                            </MyButton>
                                                        ) : null; // Don't show anything if already enrolled
                                                    })()}
                                            </div>
                                        </div>
                                    )}

                                    {/* Enrollment card within sidebar (when visible) */}
                                    {hasRightSidebar &&
                                        selectedTab === "ALL" &&
                                        (() => {
                                            if (
                                                !selectedSession ||
                                                !selectedLevel
                                            )
                                                return null;
                                            const isAlreadyEnrolled =
                                                enrolledSessions.some(
                                                    (enrolledSession) =>
                                                        enrolledSession
                                                            .package_dto.id ===
                                                            searchParams.courseId &&
                                                        enrolledSession.session
                                                            .id ===
                                                            selectedSession &&
                                                        enrolledSession.level
                                                            .id ===
                                                            selectedLevel
                                                );
                                            if (isAlreadyEnrolled) return null;
                                            return (
                                                <div className="relative bg-white border border-gray-200 rounded-md shadow-sm p-2 sm:p-3">
                                                    <MyButton
                                                        type="button"
                                                        scale="large"
                                                        buttonType="primary"
                                                        layoutVariant="default"
                                                        className="!min-w-full !w-full text-xs h-8"
                                                        onClick={() =>
                                                            setEnrollmentDialogOpen(
                                                                true
                                                            )
                                                        }
                                                    >
                                                        Enroll
                                                    </MyButton>
                                                </div>
                                            );
                                        })()}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Ratings Component */}
                    {packageSessionIdForCurrentLevel && (
                        <div
                            className="mt-6 lg:mt-8 animate-fade-in-up"
                            style={{ animationDelay: "0.8s" }}
                        >
                            <CourseDetailsRatingsComponent
                                packageSessionId={
                                    packageSessionIdForCurrentLevel
                                }
                                onLoadingChange={handleRatingsLoadingChange}
                            />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
