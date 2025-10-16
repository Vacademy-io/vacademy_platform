import { useRouter } from "@tanstack/react-router";
import {
    CaretLeft,
} from "phosphor-react";
import { toTitleCase } from "@/lib/utils";
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

import { handleGetAllCourseDetails, handleGetCourseDetails } from "../-services/get-course-details";
import axios from "axios";
import { urlInstituteDetails } from "@/constants/urls";
import { getInstituteId } from "@/constants/helper";
import { Preferences } from "@capacitor/preferences";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { CourseStructureDetails } from "./course-structure-details";
import { CourseStructureResponse } from "@/types/institute-details/course-details-interface";
import { getIdByLevelAndSession } from "@/routes/courses/course-details/-utils/helper";
import { DonationDialog } from "@/components/common/donation/DonationDialog";
import { EnrollmentPaymentDialog } from "./payment-dialogs/EnrollmentPaymentDialog";
import { EnrollmentPendingApprovalDialog } from "./payment-dialogs/EnrollmentPendingApprovalDialog";
import { useEnrollmentStatus } from "@/hooks/use-enrollment-status";
import { getTokenFromStorage } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { getSubjectDetails } from "@/routes/courses/course-details/-utils/helper";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import {
    generateCertificateWithCache,
    getCachedCertificateStatus,
} from "@/services/certificates";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import LocalStorageUtils from "@/utils/localstorage";


import { fetchPaymentOptions } from "@/routes/courses/-services/payment-options-api";
import { CourseHeader } from "./course-header";
import { CertificateDialog } from "./certificate-dialog";
import { CertificateCompletionBanner } from "./certificate-completion-banner.tsx";
import { CourseEnrollment } from "./course-enrollment";
import { CourseContentSections } from "./course-content-sections";
import { CourseSidebar } from "./course-sidebar";
import { Button } from "@/components/ui/button";
import { extractTextFromHTML } from "@/components/common/helper";

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


export const CourseDetailsPage = () => {
    const { setNavHeading } = useNavHeadingStore();

    useEffect(() => {
        setNavHeading(heading);
    }, [setNavHeading]);

    const [selectedSession, setSelectedSession] = useState<string>("");
    const [selectedLevel, setSelectedLevel] = useState<string>("");
    const router = useRouter();
    const searchParams = router.state.location.search;
    
    // Navigation helper function
    const navigateTo = (
        pathname: string,
        searchParamsObj: Record<string, string | undefined>
    ) => router.navigate({ to: pathname, search: searchParamsObj });

    // Separate handlers for enrollment and navigation
    const handleEnrollmentSuccess = async () => {
        // Update enrolled sessions immediately using the hook
        const newEnrolledSession = {
            id: packageSessionIdForCurrentLevel || "",
            session: {
                id: selectedSession,
                session_name: sessionOptions.find(s => s.value === selectedSession)?.label || "",
                status: "ACTIVE",
                start_date: new Date().toISOString(),
            },
            level: {
                id: selectedLevel,
                level_name: levelOptions.find(l => l.value === selectedLevel)?.label || "",
                duration_in_days: null,
                thumbnail_id: null,
            },
            start_time: new Date().toISOString(),
            status: "ACTIVE",
            package_dto: {
                id: searchParams.courseId || "",
                package_name: form.getValues("courseData").title,
                thumbnail_id: null,
            },
        };
        
        // Add the enrolled session and wait for it to complete
        try {
            await addEnrolledSession(newEnrolledSession);
        } catch {
            toast.error("Failed to update enrollment status. Please refresh the page.");
            return;
        }
        
        // Close dialogs
        setEnrollmentDialogOpen(false);
        setDonationDialogOpen(false);
        
        // Show success message
        //toast.success("Successfully enrolled in the course!");
    };

    const handleNavigationToSlides = async () => {
        // Add a small delay to ensure enrollment is fully processed
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try to get course structure data from multiple sources
        let subjectId = "";
        let moduleId = "";
        let chapterId = "";
        let slideId = "";
        
        // Method 1: Try to get from form data
        const currentSubjects = getSubjectDetails(
            form.getValues(),
            selectedSession,
            selectedLevel
        );
        
        if (currentSubjects.length > 0) {
            subjectId = currentSubjects[0]?.id || "";
            
            // Method 2: Fetch complete course structure using the same API
            if (packageSessionIdForCurrentLevel && subjectId) {
                try {
                    // Import the API function dynamically to avoid circular dependencies
                    const { fetchModulesWithChapters } = await import('@/services/study-library/getModulesWithChapters');
                    
                    const modulesData = await fetchModulesWithChapters(subjectId, packageSessionIdForCurrentLevel);
                    
                    if (modulesData && modulesData.length > 0) {
                        const firstModule = modulesData[0];
                        moduleId = firstModule.module.id || "";
                        
                        if (firstModule.chapters && firstModule.chapters.length > 0) {
                            const firstChapter = firstModule.chapters[0];
                            chapterId = firstChapter.id || "";
                            
                            // For slides, we need to fetch them separately
                            if (chapterId) {
                                try {
                                    const { fetchSlidesByChapterId } = await import('@/hooks/study-library/use-slides');
                                    const slides = await fetchSlidesByChapterId(chapterId);
                                    
                                    if (slides && slides.length > 0) {
                                        slideId = slides[0].id || "";
                                    }
                                } catch {
                                    // Silent fallback
                                }
                            }
                        }
                    }
                } catch {
                    // Silent fallback
                }
            }
        }
        
        // Navigate to slides with whatever IDs we found
        // Even if some IDs are missing, the slides page should handle it gracefully
        const navigationParams = {
            courseId: searchParams.courseId,
            subjectId: subjectId || "",
            moduleId: moduleId || "",
            chapterId: chapterId || "",
            slideId: slideId || "",
        };
        
        navigateTo(
            `/study-library/courses/course-details/subjects/modules/chapters/slides`,
            navigationParams
        );
    };

    // Combined handler for donation flow - does both enrollment AND navigation
    const handleDonationEnrollmentSuccess = async () => {
        // First handle enrollment
        await handleEnrollmentSuccess();
        // Then handle navigation (donation flow should auto-navigate)
        await handleNavigationToSlides();
    };

    // Handler for free enrollment click - checks user status first
    const handleFreeEnrollmentClick = async () => {
        console.log('handleFreeEnrollmentClick - Function called', {
            packageSessionId: packageSessionIdForCurrentLevel,
            hasToken: !!authToken,
            paymentType: paymentType
        });

        if (!packageSessionIdForCurrentLevel || !authToken) {
            console.error('handleFreeEnrollmentClick - Missing required data', {
                packageSessionId: packageSessionIdForCurrentLevel,
                hasToken: !!authToken
            });
            return;
        }

        try {
            // Import the payment status API function
            const { fetchUserPlanStatus } = await import('@/services/payment-status-api');
            
            const response = await fetchUserPlanStatus(packageSessionIdForCurrentLevel, authToken);
            
            // Parse learner status
            const parseLearnerStatus = (status: string): 'INVITED' | 'PENDING_FOR_APPROVAL' | 'ACTIVE' | 'UNKNOWN' => {
                const normalizedStatus = status?.toUpperCase()?.trim();
                switch (normalizedStatus) {
                    case 'INVITED':
                        return 'INVITED';
                    case 'PENDING_FOR_APPROVAL':
                    case 'PENDING_APPROVAL':
                        return 'PENDING_FOR_APPROVAL';
                    case 'ACTIVE':
                        return 'ACTIVE';
                    default:
                        return 'UNKNOWN';
                }
            };

            const learnerStatus = parseLearnerStatus(response.learner_status);
            
            console.log('handleFreeEnrollmentClick - User status check', {
                packageSessionId: packageSessionIdForCurrentLevel,
                userPlanStatus: response.user_plan_status,
                learnerStatus: response.learner_status,
                parsedLearnerStatus: learnerStatus
            });

            // If user already has a pending approval, show pending approval dialog
            if (learnerStatus === 'PENDING_FOR_APPROVAL') {
                console.log('handleFreeEnrollmentClick - User has pending approval, showing pending dialog', {
                    learnerStatus: response.learner_status,
                    parsedStatus: learnerStatus,
                    settingDialogToTrue: true
                });
                setPendingApprovalDialogOpen(true);
                return;
            }

            // If user is already active, they're already enrolled
            if (learnerStatus === 'ACTIVE') {
                console.log('handleFreeEnrollmentClick - User is already enrolled');
                // Navigate to slides since user is already enrolled
                await handleNavigationToSlides();
                return;
            }

            // If user is invited or unknown status, proceed with enrollment
            console.log('handleFreeEnrollmentClick - Proceeding with enrollment');
            setEnrollmentDialogOpen(true);
            
        } catch (error) {
            console.error('handleFreeEnrollmentClick - Error checking user status', error);
            
            // If it's a 510 error (no enrollment request), proceed with enrollment
            if (error instanceof Error && error.message.includes('510')) {
                console.log('handleFreeEnrollmentClick - No previous enrollment request, proceeding with enrollment');
                setEnrollmentDialogOpen(true);
            } else {
                // For other errors, proceed with enrollment (fallback behavior)
                console.warn('handleFreeEnrollmentClick - Error checking status, proceeding with enrollment as fallback');
                setEnrollmentDialogOpen(true);
            }
        }
    };
    const [instituteId, setInstituteId] = useState<string | null>(null);
    const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
    const [showConfetti, setShowConfetti] = useState<boolean>(false);
    const [certificateDialogOpen, setCertificateDialogOpen] =
        useState<boolean>(false);
    const [completionPercentage, setCompletionPercentage] = useState<number>(0);
    const [certificateThreshold, setCertificateThreshold] = useState<number>(80);

    // Log certificate-related state changes

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

    // Use enrollment status hook - must be called early to avoid initialization errors
    const {
        enrolledSessions,
        addEnrolledSession,
        refreshData: refreshEnrollmentData,
    } = useEnrollmentStatus(instituteId);

    // Payment status check state
    const [paymentStatusChecked, setPaymentStatusChecked] = useState<boolean>(false);
    const [isCheckingPaymentStatus, setIsCheckingPaymentStatus] = useState<boolean>(false);

    // Refresh enrollment data when page loads to ensure latest state
    useEffect(() => {
        if (instituteId) {
            refreshEnrollmentData();
        }
    }, [instituteId, refreshEnrollmentData]);



    useEffect(() => {
        const fetchInstituteAndUserId = async () => {
            updateLoadingState("userData", true);
            const instituteResult = await Preferences.get({
                key: "InstituteId",
            });
            setInstituteId(instituteResult.value || null);

                    // Note: Enrolled sessions and donation status are now handled by the useEnrollmentStatus hook

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
    // NEW: Backend course timing data
    const [backendReadTimeMinutes, setBackendReadTimeMinutes] = useState<number | null>(null);



    useEffect(() => {
        const fetchInstituteDetails = async () => {
            
            updateLoadingState("instituteDetails", true);
            const fetchedInstituteId = await getInstituteId();
            try {
                const response = await axios.get(
                    `${urlInstituteDetails}/${fetchedInstituteId}`
                );
                const packageSessionId = getIdByLevelAndSession(
                    response.data.batches_for_sessions,
                    selectedSession,
                    selectedLevel,
                    searchParams.courseId || ""
                );
                setPackageSessionIdForCurrentLevel(packageSessionId);
                
                // NEW: Extract backend read_time_in_minutes from matching batch
                const matchingBatch = response.data.batches_for_sessions?.find((batch: unknown) => {
                    const typedBatch = batch as { level?: { id?: string }; session?: { id?: string }; package_dto?: { id?: string }; read_time_in_minutes?: number };
                    return typedBatch.level?.id === selectedLevel &&
                           typedBatch.session?.id === selectedSession &&
                           typedBatch.package_dto?.id === (searchParams.courseId || "");
                });
                const typedMatchingBatch = matchingBatch as { read_time_in_minutes?: number } | undefined;
                if (typedMatchingBatch?.read_time_in_minutes) {
                    setBackendReadTimeMinutes(typedMatchingBatch.read_time_in_minutes);
                } else {
                    setBackendReadTimeMinutes(null); // Reset if no backend data
                }
            } catch {
                // Error handling
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

    // Fetch payment type when institute ID is available
    useEffect(() => {
        const fetchPaymentType = async () => {
            if (instituteId) {
                try {
                    const paymentOption = await fetchPaymentOptions(instituteId);
                    console.log('fetchPaymentType - Payment option received:', paymentOption);
                    if (paymentOption && paymentOption.type) {
                        console.log('fetchPaymentType - Setting payment type to:', paymentOption.type);
                        setPaymentType(paymentOption.type);
                    } else {
                        console.log('fetchPaymentType - No payment option type, defaulting to SUBSCRIPTION');
                        setPaymentType("SUBSCRIPTION");
                    }
                } catch (error) {
                    console.error("Error fetching payment options:", error);
                    // Default to non-donation type for direct navigation if fetch fails
                    setPaymentType("SUBSCRIPTION");
                }
            }
        };

        fetchPaymentType();
    }, [instituteId]);

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

    // Update completion percentage when course details data changes
    useEffect(() => {
        if (courseDetailsData?.course?.percentage_completed) {
            setCompletionPercentage(courseDetailsData.course.percentage_completed);
        }
    }, [courseDetailsData]);

    // Update completion percentage from query parameters
    useEffect(() => {
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

        if (typeof pctFromQuery === "number") {
            setCompletionPercentage(pctFromQuery);
        }
    }, [searchParams]);

    // Trigger certificate generation after entering this page once essentials are available
    useEffect(() => {
        const tryGenerateCertificate = async () => {
            let settings;
            try {
                settings = await getStudentDisplaySettings(false);
            } catch {
                // If we can't fetch settings, assume certificate generation is disabled
                return;
            }
            
            // Check if certificate generation is enabled
            if (!settings.certificates?.enabled) {
                return; // Exit early if certificate generation is disabled
            }
            
            try {
                
                const threshold =
                    settings.certificates?.generationThresholdPercent ?? 80;
                setCertificateThreshold(threshold);
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

                // Set completion percentage for banner display
                if (typeof percentageCompleted === "number") {
                    setCompletionPercentage(percentageCompleted);
                }
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
                        } catch {
                            // Confetti error handling
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
            } catch (error) {
                // Since we already checked that certificate generation is enabled above,
                // we can safely show the error toast
                
                // Handle specific error types for better user experience
                if (error instanceof Error && error.message.includes('404')) {
                    // Don't show error toast for 404 - this suggests the API endpoint is not configured
                    return;
                }
                
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



    const [levelOptions, setLevelOptions] = useState<
        { _id: string; value: string; label: string }[]
    >([]);

            // Watch sessions so memo recomputes when form.reset updates course data
        const watchedSessions = form.watch("courseData.sessions") || [];

            // Convert sessions to select options format - filter based on selectedTab
    const sessionOptions = useMemo(() => {
        const sessions = watchedSessions || [];
        const safeEnrolledSessions = enrolledSessions || [];



        // For PROGRESS and COMPLETED tabs, only show enrolled sessions
        // For ALL tab, show all available sessions
        if (selectedTab === "PROGRESS" || selectedTab === "COMPLETED") {
            const enrolledSessionIds = safeEnrolledSessions.map(
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
    }, [selectedTab, watchedSessions]); // Remove enrolledSessions dependency to avoid issues

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
                    const safeEnrolledSessions = enrolledSessions || [];
                    const enrolledSession = safeEnrolledSessions.find(
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
        [form, selectedTab] // Remove enrolledSessions dependency to avoid issues
    );

    // Handle level change - clear expanded items and reset state
    const handleLevelChange = (levelId: string) => {
        setSelectedLevel(levelId);
    };

            // Set initial session and its levels - auto-select if only one option
        useEffect(() => {

                    if (
                sessionOptions.length > 0 &&
                !selectedSession &&
                sessionOptions[0]?.value
            ) {
                const initialSessionId = sessionOptions[0].value;
                handleSessionChange(initialSessionId);
            }
    }, [sessionOptions, selectedSession, selectedLevel, handleSessionChange]);

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
                } catch {
                    // Error transforming course data
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

    // Fetch single course details to derive author if needed (ensures call happens)
    const singleCourseQuery = useQuery({
        ...handleGetCourseDetails({ packageId: (searchParams.courseId as string) || "" }),
        enabled: !!searchParams.courseId,
    });


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
    const [donationDialogOpen, setDonationDialogOpen] = useState(false);
    const [pendingApprovalDialogOpen, setPendingApprovalDialogOpen] = useState(false);
    const [inviteCode, setInviteCode] = useState<string>("default");
    const [authToken, setAuthToken] = useState<string>("");
    const [paymentType, setPaymentType] = useState<string | null>(null);

    // Payment status check function
    const checkPaymentStatusOnLoad = useCallback(async () => {
        if (!packageSessionIdForCurrentLevel || !authToken || paymentStatusChecked || isCheckingPaymentStatus) {
            return;
        }


        setIsCheckingPaymentStatus(true);

        try {
            // Import the payment status API function
            const { fetchUserPlanStatus } = await import('@/services/payment-status-api');
            
            const response = await fetchUserPlanStatus(packageSessionIdForCurrentLevel, authToken);

            // Parse payment status
            const parseUserPlanStatus = (status: string): 'PAID' | 'FAILED' | 'PAYMENT_PENDING' | 'UNKNOWN' => {
                const normalizedStatus = status?.toUpperCase()?.trim();
                switch (normalizedStatus) {
                    case 'FAILED':
                        return 'FAILED';
                    case 'PAID':
                    case 'ACTIVE':
                        return 'PAID';
                    case 'PAYMENT_PENDING':
                    case 'PENDING_FOR_PAYMENT':
                        return 'PAYMENT_PENDING';
                    default:
                        console.warn('CourseDetailsPage - Unknown user plan status on load:', {
                            originalStatus: status,
                            normalizedStatus,
                            packageSessionId: packageSessionIdForCurrentLevel
                        });
                        return 'UNKNOWN';
                }
            };

            // Parse learner status
            const parseLearnerStatus = (status: string): 'INVITED' | 'PENDING_FOR_APPROVAL' | 'ACTIVE' | 'UNKNOWN' => {
                const normalizedStatus = status?.toUpperCase()?.trim();
                switch (normalizedStatus) {
                    case 'INVITED':
                        return 'INVITED';
                    case 'PENDING_FOR_APPROVAL':
                    case 'PENDING_APPROVAL':
                        return 'PENDING_FOR_APPROVAL';
                    case 'ACTIVE':
                        return 'ACTIVE';
                    default:
                        console.warn('CourseDetailsPage - Unknown learner status on load:', {
                            originalStatus: status,
                            normalizedStatus,
                            packageSessionId: packageSessionIdForCurrentLevel
                        });
                        return 'UNKNOWN';
                }
            };

            const userPlanStatus = parseUserPlanStatus(response.user_plan_status);
            const learnerStatus = parseLearnerStatus(response.learner_status);
            // const approvalRequired = response.approval_required || false;


            // If payment is successful and learner is active, enroll user immediately
            if (userPlanStatus === 'PAID' && learnerStatus === 'ACTIVE') {

                // Check if user is already enrolled to avoid duplicates
                const isAlreadyEnrolled = (enrolledSessions || []).some(
                    (enrolledSession) =>
                        enrolledSession.package_dto.id === searchParams.courseId &&
                        enrolledSession.session.id === selectedSession &&
                        enrolledSession.level.id === selectedLevel
                );

                if (!isAlreadyEnrolled) {
                    // Enroll user immediately
                    const newEnrolledSession = {
                        id: packageSessionIdForCurrentLevel,
                        session: {
                            id: selectedSession,
                            session_name: sessionOptions.find(s => s.value === selectedSession)?.label || "",
                            status: "ACTIVE",
                            start_date: new Date().toISOString(),
                        },
                        level: {
                            id: selectedLevel,
                            level_name: levelOptions.find(l => l.value === selectedLevel)?.label || "",
                            duration_in_days: null,
                            thumbnail_id: null,
                        },
                        start_time: new Date().toISOString(),
                        status: "ACTIVE",
                        package_dto: {
                            id: searchParams.courseId || "",
                            package_name: form.getValues("courseData").title,
                            thumbnail_id: null,
                        },
                    };

                    try {
                        await addEnrolledSession(newEnrolledSession);
                        // No toast needed for background enrollment check
                    } catch (error) {
                        console.error('CourseDetailsPage - Error enrolling user on page load:', error);
                        toast.error("Failed to update enrollment status. Please refresh the page.");
                    }
                }
            }

        } catch (error) {
            console.error('CourseDetailsPage - Error checking payment status on load:', error);
            // Don't show error toast for this background check
        } finally {
            setIsCheckingPaymentStatus(false);
            setPaymentStatusChecked(true);
        }
    }, [
        packageSessionIdForCurrentLevel,
        authToken,
        paymentStatusChecked,
        isCheckingPaymentStatus,
        enrolledSessions,
        searchParams.courseId,
        selectedSession,
        selectedLevel,
        sessionOptions,
        levelOptions,
        form,
        addEnrolledSession
    ]);

    // Check payment status when page loads and essential data is available
    useEffect(() => {
        if (packageSessionIdForCurrentLevel && authToken && selectedSession && selectedLevel && !paymentStatusChecked && !isCheckingPaymentStatus) {
            checkPaymentStatusOnLoad();
        }
    }, [
        packageSessionIdForCurrentLevel,
        authToken,
        selectedSession,
        selectedLevel,
        paymentStatusChecked,
        isCheckingPaymentStatus,
        checkPaymentStatusOnLoad
    ]);

    const [primaryInstructorNameFromApi, setPrimaryInstructorNameFromApi] = useState<string | undefined>(undefined);
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
                const cd = settings?.courseDetails;
                if (cd) {
                    const resolvedShowCourseConfiguration =
                        cd.showCourseConfiguration ?? true;
                    const resolvedOverviewVisible =
                        cd.courseOverview?.visible ?? true;
                    setShowCourseConfiguration(resolvedShowCourseConfiguration);
                    setOverviewVisible(resolvedOverviewVisible);
                }
            })
            .catch(() => {
                setShowCourseConfiguration(true);
                setOverviewVisible(true);
            });
    }, []);

    useEffect(() => {
        // Prefer react-query fetched data to set author; avoids duplicate network calls
        try {
            const hasInstructorInForm = (form.getValues("courseData").instructors || []).length > 0;
            if (hasInstructorInForm) return;
            const q1 = singleCourseQuery?.data as unknown as { instructors?: Array<{ full_name?: string; username?: string }> };
            const fromInstructors = q1?.instructors?.[0]?.full_name || q1?.instructors?.[0]?.username;
            if (fromInstructors && typeof fromInstructors === 'string') {
                setPrimaryInstructorNameFromApi(fromInstructors);
                return;
            }
            const q2 = singleCourseQuery?.data as unknown as { course?: { created_by_name?: string; author_name?: string; owner_name?: string } };
            const fromCourse = q2?.course?.created_by_name || q2?.course?.author_name || q2?.course?.owner_name || undefined;
            if (fromCourse && typeof fromCourse === 'string') {
                setPrimaryInstructorNameFromApi(fromCourse);
            }
        } catch (e) { void e; }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [singleCourseQuery.data]);

    const hasRightSidebar = true;

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

    // Removed getSlideTypeIcon function - now in CourseSidebar component

    // Debug logging removed


    // Show loading until essential data is ready; defer packageSessionId-dependent UI below

    
    if (isLoading || !instituteId || !studyLibraryData) {
        return <DashboardLoader />;
    }

    // Debug logging removed

    return (
        <>
            {/* Donation Dialog for Enrollment */}
            <DonationDialog
                open={donationDialogOpen}
                onOpenChange={setDonationDialogOpen}
                packageSessionId={packageSessionIdForCurrentLevel || ""}
                instituteId={instituteId || ""}
                token={authToken}
                courseTitle={form.getValues("courseData").title}
                inviteCode={inviteCode}
                mode="enrollment"
                isUserEnrolled={false} // User is not enrolled yet in enrollment mode
                onEnrollmentSuccess={handleDonationEnrollmentSuccess}
            />

            {/* Enrollment Payment Dialog for Non-Donation Payment Types */}
            <EnrollmentPaymentDialog
                open={enrollmentDialogOpen}
                onOpenChange={setEnrollmentDialogOpen}
                packageSessionId={packageSessionIdForCurrentLevel || ""}
                instituteId={instituteId || ""}
                token={authToken}
                courseTitle={form.getValues("courseData").title}
                inviteCode={inviteCode}
                onEnrollmentSuccess={handleEnrollmentSuccess}
                onNavigateToSlides={handleNavigationToSlides}
            />

            {/* Pending Approval Dialog for Free Enrollments */}
            <EnrollmentPendingApprovalDialog
                open={pendingApprovalDialogOpen}
                onOpenChange={setPendingApprovalDialogOpen}
                courseTitle={form.getValues("courseData").title}
            />

            <div className="min-h-screen bg-gradient-to-br from-gray-50/80 via-white to-primary-50/20 relative w-full max-w-full">
                {/* Animated background elements */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-32 md:w-64 h-32 md:h-64 bg-gradient-to-br from-primary-100/20 to-transparent rounded-full blur-3xl animate-gentle-pulse"></div>
                    <div
                        className="absolute bottom-1/3 right-1/3 w-40 md:w-80 h-40 md:h-80 bg-gradient-to-br from-primary-50/30 to-transparent rounded-full blur-3xl animate-gentle-pulse"
                        style={{ animationDelay: "2s" }}
                    ></div>
                </div>

                {/* Course Header */}
                <CourseHeader 
                    courseData={form.getValues("courseData")} 
                    showConfetti={showConfetti} 
                />

                {/* Certificate Modal */}
                {/* <CertificateDialog
                    open={certificateDialogOpen}
                    onOpenChange={setCertificateDialogOpen}
                    certificateUrl={certificateUrl}
                    courseTitle={form.getValues("courseData").title}
                    sessionLabel={sessionOptions?.find(o => o.value === selectedSession)?.label}
                    levelLabel={levelOptions?.find(o => o.value === selectedLevel)?.label}
                /> */}

                {/* Main Content Container */}
                <div className="relative z-10 w-full px-2 sm:px-0 py-3 lg:py-4">
                    <div
                        className={`grid grid-cols-1 ${hasRightSidebar ? "lg:grid-cols-3" : ""} gap-3 lg:gap-4`}
                    >
                        {/* Left Column - Course Content (3/4) */}
                        <div
                            className={`${hasRightSidebar ? "lg:col-span-2" : ""} space-y-3 lg:space-y-4`}
                        >

                            {/* Certificate Completion Banner - Show above course structure if threshold is met */}
                            <CertificateCompletionBanner
                                certificateUrl={certificateUrl}
                                courseTitle={form.getValues("courseData").title}
                                sessionLabel={sessionOptions?.find(o => o.value === selectedSession)?.label}
                                levelLabel={levelOptions?.find(o => o.value === selectedLevel)?.label}
                                percentageCompleted={completionPercentage}
                                threshold={certificateThreshold}
                            />

                            
                            {/* Course Enrollment Configuration */}
                            <CourseEnrollment
                                showCourseConfiguration={showCourseConfiguration}
                                selectedTab={selectedTab}
                                sessionOptions={sessionOptions || []}
                                levelOptions={levelOptions || []}
                                selectedSession={selectedSession}
                                selectedLevel={selectedLevel}
                                enrolledSessions={enrolledSessions || []}
                                courseId={searchParams.courseId || ""}
                                hasRightSidebar={hasRightSidebar}
                                paymentType={paymentType}
                                certificateUrl={certificateUrl}
                                onSessionChange={handleSessionChange}
                                onLevelChange={handleLevelChange}
                                onEnrollmentClick={async () => {
                                    console.log('onEnrollmentClick - Handler called', {
                                        paymentType: paymentType,
                                        isFree: paymentType === 'free' || paymentType === 'free_plan' || 
                                               paymentType === 'FREE' || paymentType === 'FREE_PLAN'
                                    });
                                    
                                    // Check user status for free payment types before opening enrollment dialog
                                    const isFreePayment = paymentType === 'free' || paymentType === 'free_plan' || 
                                                         paymentType === 'FREE' || paymentType === 'FREE_PLAN';
                                    
                                    if (isFreePayment) {
                                        console.log('onEnrollmentClick - Calling handleFreeEnrollmentClick');
                                        await handleFreeEnrollmentClick();
                                    } else {
                                        console.log('onEnrollmentClick - Opening enrollment dialog directly');
                                        // For paid payment types, open enrollment dialog directly
                                        setEnrollmentDialogOpen(true);
                                    }
                                }}
                            />


                            

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
                                    isEnrolledInCourse={(enrolledSessions || []).some(
                                        (enrolledSession) =>
                                            enrolledSession.package_dto.id ===
                                            searchParams.courseId
                                    )}
                                    onLoadingChange={handleModulesLoadingChange}
                                    {...(paymentType && { paymentType })}
                                />
                            </div>



                            {/* Content Sections with toggle on PROGRESS tab */}
                            {selectedTab === "PROGRESS" ? (
                                <div className="mt-4">
                                    <MoreDetailsToggle
                                        courseData={form.getValues("courseData")}
                                    />
                                </div>
                            ) : (
                                <CourseContentSections
                                    courseData={form.getValues("courseData")}
                                />
                            )}

                        </div>

                        {/* Right Column - Course Stats Sidebar (1/4) */}
                        <div className="lg:col-span-1">
                            <div className="sticky top-24 self-start h-fit">
                                <div className="max-h-[calc(100vh-6rem)] overflow-auto pt-2">
                                    <CourseSidebar
                                        hasRightSidebar={hasRightSidebar}
                                        levelOptions={levelOptions}
                                        selectedLevel={selectedLevel}
                                        slideCountQuery={slideCountQuery}
                                        overviewVisible={overviewVisible}
                                        processedSlideCounts={processedSlideCounts}
                                        moduleStats={moduleStats}
                                        currentSubjects={getSubjectDetails(
                                            form.getValues(),
                                            selectedSession,
                                            selectedLevel
                                        )}
                                        courseStructure={form.getValues("courseData.courseStructure")}
                                        instructorsCount={form.getValues("courseData").instructors.length}
                                        primaryInstructorName={
                                            (form.getValues("courseData").instructors?.[0] as unknown as { name?: string; full_name?: string } | undefined)?.name ||
                                            (form.getValues("courseData").instructors?.[0] as unknown as { name?: string; full_name?: string } | undefined)?.full_name ||
                                            (singleCourseQuery.data as unknown as { instructors?: Array<{ full_name?: string; username?: string }> })?.instructors?.[0]?.full_name ||
                                            (singleCourseQuery.data as unknown as { instructors?: Array<{ full_name?: string; username?: string }> })?.instructors?.[0]?.username ||
                                            (courseDetailsData as unknown as { course?: { created_by_name?: string; author_name?: string; owner_name?: string } })?.course?.created_by_name ||
                                            (courseDetailsData as unknown as { course?: { created_by_name?: string; author_name?: string; owner_name?: string } })?.course?.author_name ||
                                            (courseDetailsData as unknown as { course?: { created_by_name?: string; author_name?: string; owner_name?: string } })?.course?.owner_name ||
                                            primaryInstructorNameFromApi
                                        }
                                        backendReadTimeMinutes={backendReadTimeMinutes || undefined}
                                        selectedTab={selectedTab}
                                        selectedSession={selectedSession}
                                        enrolledSessions={enrolledSessions || []}
                                        courseId={searchParams.courseId || ""}
                                        paymentType={paymentType}
                                        packageSessionIdForCurrentLevel={packageSessionIdForCurrentLevel}
                                        percentageCompleted={completionPercentage}
                                        onEnrollmentClick={async () => {
                                            console.log('onEnrollmentClick (second) - Handler called', {
                                                paymentType: paymentType,
                                                isFree: paymentType === 'free' || paymentType === 'free_plan' || 
                                                       paymentType === 'FREE' || paymentType === 'FREE_PLAN'
                                            });
                                            
                                            // Check user status for free payment types before opening enrollment dialog
                                            const isFreePayment = paymentType === 'free' || paymentType === 'free_plan' || 
                                                                 paymentType === 'FREE' || paymentType === 'FREE_PLAN';
                                            
                                            if (isFreePayment) {
                                                console.log('onEnrollmentClick (second) - Calling handleFreeEnrollmentClick');
                                                await handleFreeEnrollmentClick();
                                            } else {
                                                console.log('onEnrollmentClick (second) - Opening enrollment dialog directly');
                                                // For paid payment types, open enrollment dialog directly
                                                setEnrollmentDialogOpen(true);
                                            }
                                        }}
                                        onRatingsLoadingChange={handleRatingsLoadingChange}
                                    />
                                </div>
                            </div>
                        </div>


                    </div>

                    {/* Ratings Component */}
                    {!hasRightSidebar && packageSessionIdForCurrentLevel && (
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

// Local component: More details toggle for PROGRESS tab
type CourseDetailsForSections = {
    whatYoullLearn: string;
    aboutTheCourse: string;
    whoShouldLearn: string;
    instructors: Array<{ name: string; email: string }>;
};

const MoreDetailsToggle = ({ courseData }: { courseData: CourseDetailsForSections }) => {
    const [showMoreDetails, setShowMoreDetails] = useState<boolean>(false);
    const hasWhatYoullLearn = !!extractTextFromHTML(courseData?.whatYoullLearn);
    const hasAboutTheCourse = !!extractTextFromHTML(courseData?.aboutTheCourse);
    const hasWhoShouldLearn = !!extractTextFromHTML(courseData?.whoShouldLearn);
    const hasAnyDetails = hasWhatYoullLearn || hasAboutTheCourse || hasWhoShouldLearn;

    if (!hasAnyDetails) return null;
    return (
        <div>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMoreDetails((v) => !v)}
            >
                {showMoreDetails ? "Hide details" : "More details"}
            </Button>
            {showMoreDetails && (
                <div className="mt-3">
                    <CourseContentSections courseData={courseData} />
                </div>
            )}
        </div>
    );
};
