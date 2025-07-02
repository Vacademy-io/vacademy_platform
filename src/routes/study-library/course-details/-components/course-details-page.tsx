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
    CaretDown,
    CaretRight,
    Export,
    CaretLeft,
} from "phosphor-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
    CourseDetailsFormValues,
    courseDetailsSchema,
} from "./course-details-schema";
import { handleFetchModulesWithChapters } from "../../courses/-services/getModulesWithChapters";
import {
    handleFetchChaptersWithSlides,
    VideoSlide,
    DocumentSlide,
    QuestionSlide,
    AssignmentSlide,
    ChapterWithSlides,
    handleFetchSlides,
} from "../../courses/-services/getAllSlides";
import { useQueries, useSuspenseQuery } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { handleGetSlideCountDetails } from "../-services/get-slides-count";
import {
    CourseDetailsRatingsComponent,
    getIdByLevelAndSession,
} from "./course-details-ratings-page";
import { transformApiDataToCourseData } from "../-utils/helper";
import { handleGetAllCourseDetails } from "../-services/get-course-details";
import axios from "axios";
import { urlInstituteDetails } from "@/constants/urls";
import { getInstituteId } from "@/constants/helper";
import { Preferences } from "@capacitor/preferences";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";

type DialogType = "subject" | "module" | "chapter" | "slide" | null;

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

type LevelType = {
    id: string;
    name: string;
    duration_in_days: number;
    subjects: SubjectType[];
};

type SessionType = {
    sessionDetails: {
        id: string;
        session_name: string;
        status: string;
        start_date: string;
    };
    levelDetails: LevelType[];
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

    const findIdByPackageId = (data: any) => {
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
            (item) => item.course.id === searchParams.courseId
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

    console.log(form.getValues());

    const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(
        {}
    );

    const [selectedCourse, setSelectedCourse] = useState<Course | undefined>(
        () => {
            const mockCourses = form.getValues("mockCourses");
            const courseStructure =
                form.getValues("courseData").courseStructure;
            return mockCourses.find(
                (course) => course.level === courseStructure
            ) as Course | undefined;
        }
    );
    const [dialogType, setDialogType] = useState<DialogType>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [newItemName, setNewItemName] = useState("");
    const [selectedParentId, setSelectedParentId] = useState<string>("");

    const getInitials = (email: string) => {
        const name = email.split("@")[0];
        return name?.slice(0, 2).toUpperCase();
    };

    const [levelOptions, setLevelOptions] = useState<
        { _id: string; value: string; label: string }[]
    >([]);
    const [isLoadingModules, setIsLoadingModules] = useState(false);
    const [isAddingChapter, setIsAddingChapter] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [formResetKey, setFormResetKey] = useState(0);

    // Reset refreshKey and hasChaptersData on navigation (session/level change)
    useEffect(() => {
        setRefreshKey((k) => k + 1);
    }, [selectedSession, selectedLevel]);

    // Get current session and level IDs
    const currentSession = form
        .getValues("courseData")
        .sessions.find(
            (session) => session.sessionDetails.id === selectedSession
        );
    const currentLevel = currentSession?.levelDetails.find(
        (level) => level.id === selectedLevel
    );

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
        // Clear expanded items when level changes to prevent showing modules from previous level
        setExpandedItems({});
        setIsLoadingModules(false);
    };

    // Handle level change - reset modules and chapters for new level
    useEffect(() => {
        if (selectedLevel && selectedSession) {
            // Clear expanded items when level changes
            setExpandedItems({});
            setIsLoadingModules(false);

            // Only reset if there are no chapters yet
            const sessions = form.getValues("courseData").sessions;
            const currentSession = sessions.find(
                (session) => session.sessionDetails.id === selectedSession
            );
            const currentLevel = currentSession?.levelDetails.find(
                (level) => level.id === selectedLevel
            );
            const hasChapters = currentLevel?.subjects?.some((subject) =>
                subject.modules?.some(
                    (module) => module.chapters && module.chapters.length > 0
                )
            );
            if (hasChapters) {
                return;
            }

            // Reset the subjects' modules for the new level to ensure clean state
            // But preserve DEFAULT modules for course structure 3
            const courseStructure =
                form.getValues("courseData").courseStructure;
            const updatedSessions = sessions.map((session) => {
                if (session.sessionDetails.id === selectedSession) {
                    return {
                        ...session,
                        levelDetails: session.levelDetails.map((level) => {
                            if (level.id === selectedLevel) {
                                return {
                                    ...level,
                                    subjects:
                                        level.subjects?.map((subject) => {
                                            if (courseStructure === 3) {
                                                // Preserve DEFAULT modules for course structure 3
                                                return {
                                                    ...subject,
                                                    modules:
                                                        subject.modules || [],
                                                };
                                            } else {
                                                // Reset modules for other subjects
                                                return {
                                                    ...subject,
                                                    modules: [],
                                                };
                                            }
                                        }) || [],
                                };
                            }
                            return level;
                        }),
                    };
                }
                return session;
            });

            form.setValue("courseData.sessions", updatedSessions);
        }
    }, [selectedLevel, selectedSession]);

    // Move query logic outside useEffect
    const moduleQueries = useQueries({
        queries: (() => {
            const subjects =
                (currentLevel?.subjects as unknown as SubjectType[]) || [];
            // For other course structures, query all subjects
            return subjects.map((subject) => ({
                ...handleFetchModulesWithChapters(
                    subject.id,
                    packageSessionIds || ""
                ),
                queryKey: [
                    "GET_MODULES_WITH_CHAPTERS",
                    subject.id,
                    packageSessionIds,
                    refreshKey,
                ],
                enabled: !!subject.id && !!packageSessionIds,
                refetchOnMount: true,
            }));
        })(),
    });

    // Add chapter queries for each module
    const chapterQueries = useQueries({
        queries: moduleQueries.flatMap((moduleQuery) => {
            const modules = (moduleQuery.data as ModuleType[]) || [];
            if (!modules || !packageSessionIds) return [];
            return modules
                .filter((module) => module && module.id) // Only include modules with valid IDs
                .map((module) => ({
                    ...handleFetchChaptersWithSlides(
                        module.id,
                        packageSessionIds || ""
                    ),
                    queryKey: [
                        "GET_CHAPTERS_WITH_SLIDES",
                        module.id,
                        packageSessionIds,
                        refreshKey,
                    ],
                    enabled: !!module.id && !!packageSessionIds,
                    refetchOnMount: true,
                    refetchOnWindowFocus: true,
                }));
        }),
    });

    // Extract stable data from queries
    const moduleData = useMemo(() => {
        return moduleQueries.map((query) => query.data).filter(Boolean);
    }, [moduleQueries.map((q) => q.data).join(",")]);

    const chapterData = useMemo(() => {
        return chapterQueries.map((query) => query.data).filter(Boolean);
    }, [chapterQueries.map((q) => q.data).join(",")]);

    // Memoize the loading state using stable references
    const isLoading = useMemo(() => {
        return (
            moduleQueries.some((query) => query.isLoading) ||
            chapterQueries.some((query) => query.isLoading)
        );
    }, [
        moduleQueries.map((q) => q.isLoading).join(","),
        chapterQueries.map((q) => q.isLoading).join(","),
    ]);

    useEffect(() => {
        const fetchModulesAndChapters = async () => {
            // Only update if chapterQueries[0]?.data is present and non-empty
            if (
                currentLevel?.subjects &&
                packageSessionIds &&
                !isLoadingModules &&
                !isLoading &&
                chapterQueries[0]?.data &&
                Array.isArray(chapterQueries[0]?.data) &&
                chapterQueries[0]?.data.length > 0
            ) {
                setIsLoadingModules(true);
                try {
                    const currentCourseStructure =
                        form.getValues("courseData").courseStructure;

                    // For course structure 3, only update the DEFAULT subject's DEFAULT module with chapters from chapterQueries[0].data
                    if (currentCourseStructure === 3) {
                        const chaptersWithSlides =
                            chapterQueries[0]?.data || [];
                        // Only update the chapters for the DEFAULT module in the DEFAULT subject for the selected session and level
                        const updatedSessions = form
                            .getValues("courseData")
                            .sessions.map((session) => {
                                if (
                                    session.sessionDetails.id !==
                                    selectedSession
                                )
                                    return session;
                                return {
                                    ...session,
                                    levelDetails: session.levelDetails.map(
                                        (level) => {
                                            if (level.id !== selectedLevel)
                                                return level;
                                            return {
                                                ...level,
                                                subjects: (
                                                    level.subjects || []
                                                ).map((subject) => {
                                                    return {
                                                        ...subject,
                                                        modules: (
                                                            subject.modules ||
                                                            []
                                                        ).map((module) => {
                                                            return {
                                                                ...module,
                                                                chapters:
                                                                    chaptersWithSlides.map(
                                                                        (
                                                                            chapterWithSlides: ChapterWithSlides
                                                                        ) => ({
                                                                            id: chapterWithSlides
                                                                                .chapter
                                                                                .id,
                                                                            name: chapterWithSlides
                                                                                .chapter
                                                                                .chapter_name,
                                                                            status: chapterWithSlides
                                                                                .chapter
                                                                                .status,
                                                                            file_id:
                                                                                chapterWithSlides
                                                                                    .chapter
                                                                                    .file_id,
                                                                            description:
                                                                                chapterWithSlides
                                                                                    .chapter
                                                                                    .description,
                                                                            chapter_order:
                                                                                chapterWithSlides
                                                                                    .chapter
                                                                                    .chapter_order,
                                                                            slides: (
                                                                                chapterWithSlides.slides ||
                                                                                []
                                                                            ).map(
                                                                                (
                                                                                    slide
                                                                                ) => ({
                                                                                    id: slide.id,
                                                                                    name: slide.name,
                                                                                    type: slide.type,
                                                                                    description:
                                                                                        slide.description ||
                                                                                        "",
                                                                                    status:
                                                                                        slide.status ||
                                                                                        "",
                                                                                    order:
                                                                                        slide.order ||
                                                                                        0,
                                                                                    videoSlide:
                                                                                        slide.videoSlide ||
                                                                                        null,
                                                                                    documentSlide:
                                                                                        slide.documentSlide ||
                                                                                        null,
                                                                                    questionSlide:
                                                                                        slide.questionSlide ||
                                                                                        null,
                                                                                    assignmentSlide:
                                                                                        slide.assignmentSlide ||
                                                                                        null,
                                                                                })
                                                                            ),
                                                                            isOpen: false,
                                                                        })
                                                                    ),
                                                            };
                                                        }),
                                                    };
                                                }),
                                            };
                                        }
                                    ),
                                };
                            });
                        form.setValue("courseData.sessions", updatedSessions);
                    } else if (
                        currentCourseStructure === 5 &&
                        moduleData.length > 0 &&
                        currentLevel &&
                        currentLevel.subjects
                    ) {
                        // Merge fetched modules into each subject for course structure 5
                        const subjectModulesMap: Record<string, ModuleType[]> =
                            {};
                        moduleData.forEach(
                            (modulesArr: ModuleType[], idx: number) => {
                                const subject = currentLevel.subjects![idx];
                                if (!subject) return;
                                subjectModulesMap[subject.id] = modulesArr.map(
                                    (moduleRes) => ({
                                        id: moduleRes.id,
                                        name: moduleRes.name,
                                        description: moduleRes.description,
                                        status: moduleRes.status,
                                        thumbnail_id: moduleRes.thumbnail_id,
                                        chapters: [], // Will be filled in by chapter queries if needed
                                        isOpen: false,
                                    })
                                );
                            }
                        );
                        // --- Fix: assign chapters to each module ---
                        const updatedSubjects = currentLevel.subjects!.map(
                            (subject: SubjectType, subjectIdx: number) => {
                                const modules = (
                                    subjectModulesMap[subject.id] || []
                                ).map(
                                    (module: ModuleType, moduleIdx: number) => {
                                        // Calculate the flat index for this module in chapterData
                                        let idx = 0;
                                        for (let i = 0; i < subjectIdx; i++) {
                                            idx +=
                                                subjectModulesMap[
                                                    currentLevel.subjects![i].id
                                                ]?.length || 0;
                                        }
                                        idx += moduleIdx;
                                        const chaptersWithSlides: ChapterWithSlides[] =
                                            chapterData[idx] || [];
                                        return {
                                            ...module,
                                            chapters: chaptersWithSlides.map(
                                                (
                                                    chapterWithSlides: ChapterWithSlides
                                                ) => ({
                                                    id: chapterWithSlides
                                                        .chapter.id,
                                                    name: chapterWithSlides
                                                        .chapter.chapter_name,
                                                    status: chapterWithSlides
                                                        .chapter.status,
                                                    file_id:
                                                        chapterWithSlides
                                                            .chapter.file_id,
                                                    description:
                                                        chapterWithSlides
                                                            .chapter
                                                            .description,
                                                    chapter_order:
                                                        chapterWithSlides
                                                            .chapter
                                                            .chapter_order,
                                                    slides: Array.isArray(
                                                        chapterWithSlides.slides
                                                    )
                                                        ? chapterWithSlides.slides.map(
                                                              (slide: any) => ({
                                                                  id: slide.id,
                                                                  name: slide.name,
                                                                  type: slide.type,
                                                                  description:
                                                                      slide.description ||
                                                                      "",
                                                                  status:
                                                                      slide.status ||
                                                                      "",
                                                                  order:
                                                                      slide.order ||
                                                                      0,
                                                                  videoSlide:
                                                                      slide.videoSlide ||
                                                                      null,
                                                                  documentSlide:
                                                                      slide.documentSlide ||
                                                                      null,
                                                                  questionSlide:
                                                                      slide.questionSlide ||
                                                                      null,
                                                                  assignmentSlide:
                                                                      slide.assignmentSlide ||
                                                                      null,
                                                              })
                                                          )
                                                        : [],
                                                    isOpen: false,
                                                })
                                            ),
                                        };
                                    }
                                );
                                return {
                                    ...subject,
                                    modules,
                                };
                            }
                        );
                        const updatedSessions = form
                            .getValues("courseData")
                            .sessions.map((session) => {
                                if (
                                    session.sessionDetails.id !==
                                    selectedSession
                                )
                                    return session;
                                return {
                                    ...session,
                                    levelDetails: session.levelDetails.map(
                                        (level) => {
                                            if (level.id !== selectedLevel)
                                                return level;
                                            return {
                                                ...level,
                                                subjects: updatedSubjects,
                                            };
                                        }
                                    ),
                                };
                            });
                        form.setValue("courseData.sessions", updatedSessions);
                    }

                    if (currentCourseStructure === 4) {
                        // For course structure 4, update the mockCourse with modules from DEFAULT subject
                        const currentMockCourses =
                            form.getValues("mockCourses");
                        const updatedMockCourses = currentMockCourses.map(
                            (mockCourse) => {
                                if (mockCourse.level === 4) {
                                    return {
                                        ...mockCourse,
                                    };
                                }
                                return mockCourse;
                            }
                        );
                        form.setValue("mockCourses", updatedMockCourses);
                    } else if (currentCourseStructure === 3) {
                        // For course structure 3, update the mockCourse with chapters from DEFAULT module
                        const currentMockCourses =
                            form.getValues("mockCourses");
                        const updatedMockCourses = currentMockCourses.map(
                            (mockCourse) => {
                                if (mockCourse.level === 3) {
                                    return {
                                        ...mockCourse,
                                    };
                                }
                                return mockCourse;
                            }
                        );
                        form.setValue("mockCourses", updatedMockCourses);
                    }

                    // Replace the code that sets chapters for the selected session/level/module with a merge update
                    if (
                        chapterQueries[0]?.data &&
                        Array.isArray(chapterQueries[0]?.data) &&
                        chapterQueries[0]?.data.length > 0
                    ) {
                        const mappedChapters = chapterQueries[0].data.map(
                            (item) => ({
                                id: item.chapter.id,
                                name: item.chapter.chapter_name,
                                status: item.chapter.status,
                                file_id: item.chapter.file_id,
                                description: item.chapter.description,
                                chapter_order: item.chapter.chapter_order,
                                slides: Array.isArray(item.slides)
                                    ? item.slides.map((slide: SlideType) => ({
                                          id: slide.id,
                                          name: slide.name,
                                          type: slide.type,
                                          description: slide.description || "",
                                          status: slide.status || "",
                                          order: slide.order || 0,
                                          videoSlide: slide.videoSlide || null,
                                          documentSlide:
                                              slide.documentSlide || null,
                                          questionSlide:
                                              slide.questionSlide || null,
                                          assignmentSlide:
                                              slide.assignmentSlide || null,
                                      }))
                                    : [],
                                isOpen: false,
                            })
                        );
                        // Merge chapters into the correct session/level/subject/module
                        const sessions = form.getValues("courseData").sessions;
                        const updatedSessions = sessions.map((session) => {
                            if (session.sessionDetails.id !== selectedSession)
                                return session;
                            return {
                                ...session,
                                levelDetails: session.levelDetails.map(
                                    (level) => {
                                        if (level.id !== selectedLevel)
                                            return level;
                                        return {
                                            ...level,
                                            subjects: (
                                                level.subjects || []
                                            ).map((subject) => {
                                                return {
                                                    ...subject,
                                                    modules: (
                                                        subject.modules || []
                                                    ).map((module) => {
                                                        return {
                                                            ...module,
                                                            chapters:
                                                                mappedChapters,
                                                        };
                                                    }),
                                                };
                                            }),
                                        };
                                    }
                                ),
                            };
                        });
                        form.setValue("courseData.sessions", updatedSessions);
                    }
                } catch (error) {
                    console.error(
                        "Error fetching modules and chapters:",
                        error
                    );
                } finally {
                    setIsLoadingModules(false);
                }
            }
        };

        fetchModulesAndChapters();
    }, [
        selectedSession,
        selectedLevel,
        moduleData,
        chapterData,
        packageSessionIds,
        isLoading,
    ]);

    // Modified toggle function to handle hierarchical closing
    const toggleExpand = (id: string) => {
        setExpandedItems((prev) => {
            const newState = { ...prev };
            const isExpanding = !prev[id];

            if (!isExpanding) {
                // When closing, only close children of the current item
                Object.keys(prev).forEach((key) => {
                    if (key.startsWith(`${id}-`)) {
                        newState[key] = false;
                    }
                });
            }
            newState[id] = !prev[id];
            return newState;
        });
    };

    const handleAddClick = (type: DialogType, parentId?: string) => {
        setDialogType(type);
        setSelectedParentId(parentId || "");
        setDialogOpen(true);
        setNewItemName("");
    };

    const updateSelectedCourseAndForm = useCallback(
        (newCourse: Course | undefined) => {
            if (!newCourse) {
                setSelectedCourse(undefined);
                return;
            }

            // Update local state
            setSelectedCourse(newCourse);

            // Update form immediately
            const currentMockCourses = form.getValues("mockCourses");
            const updatedMockCourses = currentMockCourses.map((mockCourse) => {
                if (mockCourse.level === newCourse.level) {
                    return { ...newCourse };
                }
                return mockCourse;
            });

            form.setValue("mockCourses", updatedMockCourses);
        },
        [form]
    );

    const handleAddItem = async () => {
        if (!newItemName.trim() || !selectedCourse) return;

        switch (dialogType) {
            case "subject": {
                try {
                    const newSubject: SubjectType = {
                        id: crypto.randomUUID(),
                        subject_name: newItemName,
                        subject_code: "",
                        credit: 0,
                        thumbnail_id: "",
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        modules: [], // Add empty modules array
                    };

                    const response = await addSubjectMutation.mutateAsync({
                        subject: newSubject,
                        packageSessionIds,
                    });

                    if (response) {
                        const updatedCourse: Course = {
                            ...selectedCourse,
                            structure: {
                                ...selectedCourse.structure,
                                items: [
                                    ...(selectedCourse.structure
                                        .items as SubjectType[]),
                                    {
                                        id: response.data.id,
                                        subject_name:
                                            response.data.subject_name,
                                        subject_code: "",
                                        credit: 0,
                                        thumbnail_id: "",
                                        created_at: new Date().toISOString(),
                                        updated_at: new Date().toISOString(),
                                        modules: [],
                                    },
                                ],
                            },
                        };

                        updateSelectedCourseAndForm(updatedCourse);
                    }
                } catch (error) {
                    console.error("Error adding subject:", error);
                }
                break;
            }

            case "module": {
                try {
                    const newModule = {
                        id: crypto.randomUUID(),
                        module_name: newItemName,
                        description: "",
                        status: "",
                        thumbnail_id: "",
                    };

                    if (selectedCourse.level === 4) {
                        const response = await addModuleMutation.mutateAsync({
                            subjectId: crypto.randomUUID(),
                            packageSessionIds: packageSessionIds,
                            module: newModule,
                        });

                        if (response) {
                            // Fetch the latest modules for the DEFAULT subject
                            const moduleQuery = handleFetchModulesWithChapters(
                                crypto.randomUUID(),
                                packageSessionIds || ""
                            );
                            const modulesResponse = await moduleQuery.queryFn();

                            // Map the modules to ModuleType[]
                            const modules: ModuleType[] = modulesResponse.map(
                                (moduleRes: ModuleType) => ({
                                    id: moduleRes.id,
                                    name: moduleRes.name,
                                    description: moduleRes.description,
                                    status: moduleRes.status,
                                    thumbnail_id: moduleRes.thumbnail_id,
                                    chapters: [],
                                    isOpen: false,
                                })
                            );

                            // Update the form state for the DEFAULT subject
                            const currentSession = form
                                .getValues("courseData")
                                .sessions.find(
                                    (session) =>
                                        session.sessionDetails.id ===
                                        selectedSession
                                );
                            const currentLevel =
                                currentSession?.levelDetails.find(
                                    (level) => level.id === selectedLevel
                                );
                            if (currentLevel) {
                                const updatedSubjects =
                                    currentLevel?.subjects?.map((subject) => {
                                        return subject;
                                    });

                                const updatedSessions = form
                                    .getValues("courseData")
                                    .sessions.map((session) => {
                                        if (
                                            session.sessionDetails.id ===
                                            selectedSession
                                        ) {
                                            return {
                                                ...session,
                                                levelDetails:
                                                    session.levelDetails.map(
                                                        (level) => {
                                                            if (
                                                                level.id ===
                                                                selectedLevel
                                                            ) {
                                                                return {
                                                                    ...level,
                                                                    subjects:
                                                                        updatedSubjects,
                                                                };
                                                            }
                                                            return level;
                                                        }
                                                    ),
                                            };
                                        }
                                        return session;
                                    });

                                form.setValue(
                                    "courseData.sessions",
                                    updatedSessions
                                );

                                // Also update selectedCourse for immediate UI update
                                const updatedCourse = {
                                    ...selectedCourse,
                                    structure: {
                                        ...selectedCourse.structure,
                                        items: modules,
                                    },
                                };
                                updateSelectedCourseAndForm(updatedCourse);
                            }
                        }
                    } else if (selectedCourse.level === 5 && selectedParentId) {
                        // For level 5, selectedParentId is the subject ID
                        const response = await addModuleMutation.mutateAsync({
                            subjectId: selectedParentId,
                            packageSessionIds: packageSessionIds,
                            module: newModule,
                        });

                        if (response) {
                            // Update the current level's subjects
                            const currentSession = form
                                .getValues("courseData")
                                .sessions.find(
                                    (session) =>
                                        session.sessionDetails.id ===
                                        selectedSession
                                );
                            const currentLevel =
                                currentSession?.levelDetails.find(
                                    (level) => level.id === selectedLevel
                                );

                            if (currentLevel) {
                                const updatedSubjects =
                                    currentLevel.subjects.map((subject) => {
                                        if (subject.id === selectedParentId) {
                                            return {
                                                ...subject,
                                                modules: [
                                                    ...(subject.modules || []),
                                                    {
                                                        id: response.data.id,
                                                        name: newItemName,
                                                        chapters: [],
                                                        isOpen: false,
                                                    },
                                                ],
                                            };
                                        }
                                        return subject;
                                    });

                                // Update the form with new subjects
                                const updatedSessions = form
                                    .getValues("courseData")
                                    .sessions.map((session) => {
                                        if (
                                            session.sessionDetails.id ===
                                            selectedSession
                                        ) {
                                            return {
                                                ...session,
                                                levelDetails:
                                                    session.levelDetails.map(
                                                        (level) => {
                                                            if (
                                                                level.id ===
                                                                selectedLevel
                                                            ) {
                                                                return {
                                                                    ...level,
                                                                    subjects:
                                                                        updatedSubjects,
                                                                };
                                                            }
                                                            return level;
                                                        }
                                                    ),
                                            };
                                        }
                                        return session;
                                    });

                                form.setValue(
                                    "courseData.sessions",
                                    updatedSessions
                                );
                            }
                        }
                    }
                } catch (error) {
                    console.error("Error adding module:", error);
                }
                break;
            }

            case "chapter": {
                // For course structure 3, we don't need selectedParentId since we always use 'DEFAULT' module
                if (selectedParentId || selectedCourse.level === 3) {
                    try {
                        setIsAddingChapter(true);
                        const newChapter = {
                            id: crypto.randomUUID(),
                            chapter_name: newItemName,
                            status: "ACTIVE",
                            file_id: "",
                            description:
                                "Click to view and access eBooks and video lectures for this chapter.",
                            chapter_order: 0,
                        };

                        if (selectedCourse.level === 5) {
                            const [subjectId, moduleId] =
                                selectedParentId.split("|");
                            const response =
                                await addChapterMutation.mutateAsync({
                                    subjectId: subjectId || "",
                                    moduleId: moduleId || "",
                                    commaSeparatedPackageSessionIds:
                                        packageSessionIds,
                                    chapter: newChapter,
                                });

                            if (response) {
                                // Get current form data
                                const formData = form.getValues("courseData");
                                const currentSession = formData.sessions.find(
                                    (session) =>
                                        session.sessionDetails.id ===
                                        selectedSession
                                );
                                const currentLevel =
                                    currentSession?.levelDetails.find(
                                        (level) => level.id === selectedLevel
                                    );

                                if (currentLevel && currentLevel.subjects) {
                                    // Fetch fresh module data for all subjects
                                    const modulePromises =
                                        currentLevel.subjects.map(
                                            async (subject) => {
                                                const moduleQuery =
                                                    handleFetchModulesWithChapters(
                                                        subject.id,
                                                        packageSessionIds || ""
                                                    );
                                                const moduleResponse =
                                                    await moduleQuery.queryFn();
                                                return {
                                                    subjectId: subject.id,
                                                    modules: moduleResponse,
                                                };
                                            }
                                        );

                                    const moduleResults =
                                        await Promise.all(modulePromises);

                                    // Fetch fresh chapter data for all modules
                                    const chapterPromises =
                                        moduleResults.flatMap(
                                            ({ subjectId, modules }) =>
                                                modules.map(async (module) => {
                                                    const chapterQuery =
                                                        handleFetchChaptersWithSlides(
                                                            module.id,
                                                            packageSessionIds ||
                                                                ""
                                                        );
                                                    const chapterResponse =
                                                        await chapterQuery.queryFn();
                                                    return {
                                                        subjectId,
                                                        moduleId: module.id,
                                                        chapters:
                                                            chapterResponse,
                                                    };
                                                })
                                        );

                                    const chapterResults =
                                        await Promise.all(chapterPromises);

                                    // Update subjects with fresh module and chapter data
                                    const updatedSubjects =
                                        currentLevel.subjects.map((subject) => {
                                            const subjectModules =
                                                moduleResults.find(
                                                    (result) =>
                                                        result.subjectId ===
                                                        subject.id
                                                )?.modules || [];

                                            return {
                                                ...subject,
                                                modules: subjectModules.map(
                                                    (moduleData) => {
                                                        const moduleChapters =
                                                            chapterResults.find(
                                                                (result) =>
                                                                    result.subjectId ===
                                                                        subject.id &&
                                                                    result.moduleId ===
                                                                        moduleData
                                                                            .module
                                                                            .id
                                                            )?.chapters || [];

                                                        return {
                                                            id: moduleData
                                                                .module.id,
                                                            name: moduleData
                                                                .module
                                                                .module_name,
                                                            description:
                                                                moduleData
                                                                    .module
                                                                    .description,
                                                            status: moduleData
                                                                .module.status,
                                                            thumbnail_id:
                                                                moduleData
                                                                    .module
                                                                    .thumbnail_id,
                                                            chapters:
                                                                moduleChapters.map(
                                                                    (
                                                                        chapterWithSlides
                                                                    ) => ({
                                                                        id: chapterWithSlides
                                                                            .chapter
                                                                            .id,
                                                                        name: chapterWithSlides
                                                                            .chapter
                                                                            .chapter_name,
                                                                        status: chapterWithSlides
                                                                            .chapter
                                                                            .status,
                                                                        file_id:
                                                                            chapterWithSlides
                                                                                .chapter
                                                                                .file_id,
                                                                        description:
                                                                            chapterWithSlides
                                                                                .chapter
                                                                                .description,
                                                                        chapter_order:
                                                                            chapterWithSlides
                                                                                .chapter
                                                                                .chapter_order,
                                                                        slides: (
                                                                            chapterWithSlides.slides ||
                                                                            []
                                                                        ).map(
                                                                            (
                                                                                slide
                                                                            ) => ({
                                                                                id: slide.id,
                                                                                name: slide.name,
                                                                                type: slide.type,
                                                                                description:
                                                                                    slide.description ||
                                                                                    "",
                                                                                status:
                                                                                    slide.status ||
                                                                                    "",
                                                                                order:
                                                                                    slide.order ||
                                                                                    0,
                                                                                videoSlide:
                                                                                    slide.videoSlide ||
                                                                                    null,
                                                                                documentSlide:
                                                                                    slide.documentSlide ||
                                                                                    null,
                                                                                questionSlide:
                                                                                    slide.questionSlide ||
                                                                                    null,
                                                                                assignmentSlide:
                                                                                    slide.assignmentSlide ||
                                                                                    null,
                                                                            })
                                                                        ),
                                                                        isOpen: false,
                                                                    })
                                                                ),
                                                            isOpen: false,
                                                        };
                                                    }
                                                ),
                                            };
                                        });

                                    // Update the form with the new subjects
                                    const updatedSessions =
                                        formData.sessions.map((session) => {
                                            if (
                                                session.sessionDetails.id ===
                                                selectedSession
                                            ) {
                                                return {
                                                    ...session,
                                                    levelDetails:
                                                        session.levelDetails.map(
                                                            (level) => {
                                                                if (
                                                                    level.id ===
                                                                    selectedLevel
                                                                ) {
                                                                    return {
                                                                        ...level,
                                                                        subjects:
                                                                            updatedSubjects,
                                                                    };
                                                                }
                                                                return level;
                                                            }
                                                        ),
                                                };
                                            }
                                            return session;
                                        });

                                    // Update the form with the new sessions
                                    form.setValue(
                                        "courseData.sessions",
                                        updatedSessions
                                    );
                                }
                            }
                        } else if (selectedCourse.level === 4) {
                            const moduleId = selectedParentId;
                            const response =
                                await addChapterMutation.mutateAsync({
                                    subjectId: "",
                                    moduleId,
                                    commaSeparatedPackageSessionIds:
                                        packageSessionIds,
                                    chapter: newChapter,
                                });

                            if (response) {
                                // Fetch fresh chapter data using the module ID
                                const chapterQuery =
                                    handleFetchChaptersWithSlides(
                                        moduleId,
                                        packageSessionIds || ""
                                    );
                                const chapterResponse =
                                    await chapterQuery.queryFn();

                                const updatedCourse = {
                                    ...selectedCourse,
                                    structure: {
                                        ...selectedCourse.structure,
                                        items: (
                                            selectedCourse.structure
                                                .items as ModuleType[]
                                        ).map((module) => {
                                            if (module.id === moduleId) {
                                                return {
                                                    ...module,
                                                    chapters:
                                                        chapterResponse.map(
                                                            (
                                                                chapterWithSlides: ChapterWithSlides
                                                            ) => ({
                                                                id: chapterWithSlides
                                                                    .chapter.id,
                                                                name: chapterWithSlides
                                                                    .chapter
                                                                    .chapter_name,
                                                                status: chapterWithSlides
                                                                    .chapter
                                                                    .status,
                                                                file_id:
                                                                    chapterWithSlides
                                                                        .chapter
                                                                        .file_id,
                                                                description:
                                                                    chapterWithSlides
                                                                        .chapter
                                                                        .description,
                                                                chapter_order:
                                                                    chapterWithSlides
                                                                        .chapter
                                                                        .chapter_order,
                                                                slides: (
                                                                    chapterWithSlides.slides ||
                                                                    []
                                                                ).map(
                                                                    (
                                                                        slide
                                                                    ) => ({
                                                                        id: slide.id,
                                                                        name: slide.name,
                                                                        type: slide.type,
                                                                        description:
                                                                            slide.description ||
                                                                            "",
                                                                        status:
                                                                            slide.status ||
                                                                            "",
                                                                        order:
                                                                            slide.order ||
                                                                            0,
                                                                        videoSlide:
                                                                            slide.videoSlide ||
                                                                            null,
                                                                        documentSlide:
                                                                            slide.documentSlide ||
                                                                            null,
                                                                        questionSlide:
                                                                            slide.questionSlide ||
                                                                            null,
                                                                        assignmentSlide:
                                                                            slide.assignmentSlide ||
                                                                            null,
                                                                    })
                                                                ),
                                                                isOpen: false,
                                                            })
                                                        ),
                                                };
                                            }
                                            return module;
                                        }),
                                    },
                                };
                                updateSelectedCourseAndForm(updatedCourse);
                            }
                        } else if (selectedCourse.level === 3) {
                            const response =
                                await addChapterMutation.mutateAsync({
                                    subjectId: crypto.randomUUID(),
                                    moduleId: crypto.randomUUID(),
                                    commaSeparatedPackageSessionIds:
                                        packageSessionIds,
                                    chapter: newChapter,
                                });

                            if (response) {
                                // Fetch fresh chapter data using the DEFAULT module ID
                                const chapterQuery =
                                    handleFetchChaptersWithSlides(
                                        crypto.randomUUID(),
                                        packageSessionIds || ""
                                    );
                                const chapterResponse =
                                    await chapterQuery.queryFn();

                                // Update the mockCourse structure with the new chapters
                                const currentMockCourses =
                                    form.getValues("mockCourses");
                                const updatedMockCourses =
                                    currentMockCourses.map((mockCourse) => {
                                        if (mockCourse.level === 3) {
                                            return {
                                                ...mockCourse,
                                                structure: {
                                                    ...mockCourse.structure,
                                                    items: chapterResponse.map(
                                                        (
                                                            chapterWithSlides: ChapterWithSlides
                                                        ) => ({
                                                            id: chapterWithSlides
                                                                .chapter.id,
                                                            title: chapterWithSlides
                                                                .chapter
                                                                .chapter_name,
                                                            status: chapterWithSlides
                                                                .chapter.status,
                                                            file_id:
                                                                chapterWithSlides
                                                                    .chapter
                                                                    .file_id,
                                                            description:
                                                                chapterWithSlides
                                                                    .chapter
                                                                    .description,
                                                            chapter_order:
                                                                chapterWithSlides
                                                                    .chapter
                                                                    .chapter_order,
                                                            slides: (
                                                                chapterWithSlides.slides ||
                                                                []
                                                            ).map((slide) => ({
                                                                id: slide.id,
                                                                name: slide.name,
                                                                type: slide.type,
                                                                description:
                                                                    slide.description ||
                                                                    "",
                                                                status:
                                                                    slide.status ||
                                                                    "",
                                                                order:
                                                                    slide.order ||
                                                                    0,
                                                                videoSlide:
                                                                    slide.videoSlide ||
                                                                    null,
                                                                documentSlide:
                                                                    slide.documentSlide ||
                                                                    null,
                                                                questionSlide:
                                                                    slide.questionSlide ||
                                                                    null,
                                                                assignmentSlide:
                                                                    slide.assignmentSlide ||
                                                                    null,
                                                            })),
                                                            isOpen: false,
                                                        })
                                                    ),
                                                },
                                            };
                                        }
                                        return mockCourse;
                                    });

                                // Update the form with the new mockCourses
                                form.setValue(
                                    "mockCourses",
                                    updatedMockCourses
                                );

                                // Also update the selectedCourse for immediate UI update
                                const updatedCourse = {
                                    ...selectedCourse,
                                    structure: {
                                        ...selectedCourse.structure,
                                        items: chapterResponse.map(
                                            (
                                                chapterWithSlides: ChapterWithSlides
                                            ) => ({
                                                id: chapterWithSlides.chapter
                                                    .id,
                                                name: chapterWithSlides.chapter
                                                    .chapter_name,
                                                status: chapterWithSlides
                                                    .chapter.status,
                                                file_id:
                                                    chapterWithSlides.chapter
                                                        .file_id,
                                                description:
                                                    chapterWithSlides.chapter
                                                        .description,
                                                chapter_order:
                                                    chapterWithSlides.chapter
                                                        .chapter_order,
                                                slides: (
                                                    chapterWithSlides.slides ||
                                                    []
                                                ).map((slide) => ({
                                                    id: slide.id,
                                                    name: slide.name,
                                                    type: slide.type,
                                                    description:
                                                        slide.description || "",
                                                    status: slide.status || "",
                                                    order: slide.order || 0,
                                                    videoSlide:
                                                        slide.videoSlide ||
                                                        null,
                                                    documentSlide:
                                                        slide.documentSlide ||
                                                        null,
                                                    questionSlide:
                                                        slide.questionSlide ||
                                                        null,
                                                    assignmentSlide:
                                                        slide.assignmentSlide ||
                                                        null,
                                                })),
                                                isOpen: false,
                                            })
                                        ),
                                    },
                                };
                                updateSelectedCourseAndForm(updatedCourse);
                            }
                        }
                    } catch (error) {
                        console.error("Error adding chapter:", error);
                    } finally {
                        setIsAddingChapter(false);
                    }
                }
                break;
            }

            case "slide": {
                if (selectedParentId) {
                    const parts = selectedParentId.split("|");
                    let moduleId = "";

                    if (selectedCourse?.level === 5) {
                        [moduleId = ""] = parts;
                    } else if (selectedCourse?.level === 4) {
                        [moduleId = ""] = parts;
                    }

                    try {
                        if (selectedCourse.level === 5) {
                            // Get current form data
                            const formData = form.getValues("courseData");
                            const currentSession = formData.sessions.find(
                                (session) =>
                                    session.sessionDetails.id ===
                                    selectedSession
                            );
                            const currentLevel =
                                currentSession?.levelDetails.find(
                                    (level) => level.id === selectedLevel
                                );

                            if (currentLevel && currentLevel.subjects) {
                                // Fetch fresh module data for all subjects
                                const modulePromises =
                                    currentLevel.subjects.map(
                                        async (subject) => {
                                            const moduleQuery =
                                                handleFetchModulesWithChapters(
                                                    subject.id,
                                                    packageSessionIds || ""
                                                );
                                            const moduleResponse =
                                                await moduleQuery.queryFn();
                                            return {
                                                subjectId: subject.id,
                                                modules: moduleResponse,
                                            };
                                        }
                                    );

                                const moduleResults =
                                    await Promise.all(modulePromises);
                                if (!moduleResults) return [];

                                // Fetch fresh chapter data for all modules
                                const chapterPromises = moduleResults.flatMap(
                                    ({ subjectId, modules }) =>
                                        modules.map(async (module) => {
                                            const chapterQuery =
                                                handleFetchChaptersWithSlides(
                                                    module.id,
                                                    packageSessionIds || ""
                                                );
                                            const chapterResponse =
                                                await chapterQuery.queryFn();
                                            return {
                                                subjectId,
                                                moduleId: module.id,
                                                chapters: chapterResponse,
                                            };
                                        })
                                );

                                const chapterResults =
                                    await Promise.all(chapterPromises);

                                if (!chapterResults) return [];

                                // Update subjects with fresh module and chapter data
                                const updatedSubjects =
                                    currentLevel.subjects.map((subject) => {
                                        const subjectModules =
                                            moduleResults.find(
                                                (result) =>
                                                    result.subjectId ===
                                                    subject.id
                                            )?.modules || [];

                                        return {
                                            ...subject,
                                            modules: subjectModules.map(
                                                (moduleData) => {
                                                    const moduleChapters =
                                                        chapterResults.find(
                                                            (result) =>
                                                                result.subjectId ===
                                                                    subject.id &&
                                                                result.moduleId ===
                                                                    moduleData
                                                                        .module
                                                                        .id
                                                        )?.chapters || [];

                                                    return {
                                                        id: moduleData.module
                                                            .id,
                                                        name: moduleData.module
                                                            .module_name,
                                                        description:
                                                            moduleData.module
                                                                .description,
                                                        status: moduleData
                                                            .module.status,
                                                        thumbnail_id:
                                                            moduleData.module
                                                                .thumbnail_id,
                                                        chapters:
                                                            moduleChapters.map(
                                                                (
                                                                    chapterWithSlides
                                                                ) => ({
                                                                    id: chapterWithSlides
                                                                        .chapter
                                                                        .id,
                                                                    name: chapterWithSlides
                                                                        .chapter
                                                                        .chapter_name,
                                                                    status: chapterWithSlides
                                                                        .chapter
                                                                        .status,
                                                                    file_id:
                                                                        chapterWithSlides
                                                                            .chapter
                                                                            .file_id,
                                                                    description:
                                                                        chapterWithSlides
                                                                            .chapter
                                                                            .description,
                                                                    chapter_order:
                                                                        chapterWithSlides
                                                                            .chapter
                                                                            .chapter_order,
                                                                    slides: (
                                                                        chapterWithSlides.slides ||
                                                                        []
                                                                    ).map(
                                                                        (
                                                                            slide
                                                                        ) => ({
                                                                            id: slide.id,
                                                                            name: slide.name,
                                                                            type: slide.type,
                                                                            description:
                                                                                slide.description ||
                                                                                "",
                                                                            status:
                                                                                slide.status ||
                                                                                "",
                                                                            order:
                                                                                slide.order ||
                                                                                0,
                                                                            videoSlide:
                                                                                slide.videoSlide ||
                                                                                null,
                                                                            documentSlide:
                                                                                slide.documentSlide ||
                                                                                null,
                                                                            questionSlide:
                                                                                slide.questionSlide ||
                                                                                null,
                                                                            assignmentSlide:
                                                                                slide.assignmentSlide ||
                                                                                null,
                                                                        })
                                                                    ),
                                                                    isOpen: false,
                                                                })
                                                            ),
                                                        isOpen: false,
                                                    };
                                                }
                                            ),
                                        };
                                    });

                                // Update the form with the new subjects
                                const updatedSessions = formData.sessions.map(
                                    (session) => {
                                        if (
                                            session.sessionDetails.id ===
                                            selectedSession
                                        ) {
                                            return {
                                                ...session,
                                                levelDetails:
                                                    session.levelDetails.map(
                                                        (level) => {
                                                            if (
                                                                level.id ===
                                                                selectedLevel
                                                            ) {
                                                                return {
                                                                    ...level,
                                                                    subjects:
                                                                        updatedSubjects,
                                                                };
                                                            }
                                                            return level;
                                                        }
                                                    ),
                                            };
                                        }
                                        return session;
                                    }
                                );

                                // Update the form with the new sessions
                                form.setValue(
                                    "courseData.sessions",
                                    updatedSessions
                                );
                            }
                        } else if (selectedCourse.level === 4) {
                            const chapterQuery = handleFetchChaptersWithSlides(
                                moduleId,
                                packageSessionIds || ""
                            );
                            const chapterResponse =
                                await chapterQuery.queryFn();

                            const updatedCourse = {
                                ...selectedCourse,
                                structure: {
                                    ...selectedCourse.structure,
                                    items: (
                                        selectedCourse.structure
                                            .items as ModuleType[]
                                    ).map((module) => {
                                        if (module.id === moduleId) {
                                            return {
                                                ...module,
                                                chapters: chapterResponse.map(
                                                    (
                                                        chapterWithSlides: ChapterWithSlides
                                                    ) => ({
                                                        id: chapterWithSlides
                                                            .chapter.id,
                                                        name: chapterWithSlides
                                                            .chapter
                                                            .chapter_name,
                                                        status: chapterWithSlides
                                                            .chapter.status,
                                                        file_id:
                                                            chapterWithSlides
                                                                .chapter
                                                                .file_id,
                                                        description:
                                                            chapterWithSlides
                                                                .chapter
                                                                .description,
                                                        chapter_order:
                                                            chapterWithSlides
                                                                .chapter
                                                                .chapter_order,
                                                        slides: (
                                                            chapterWithSlides.slides ||
                                                            []
                                                        ).map((slide) => ({
                                                            id: slide.id,
                                                            name: slide.name,
                                                            type: slide.type,
                                                            description:
                                                                slide.description ||
                                                                "",
                                                            status:
                                                                slide.status ||
                                                                "",
                                                            order:
                                                                slide.order ||
                                                                0,
                                                            videoSlide:
                                                                slide.videoSlide ||
                                                                null,
                                                            documentSlide:
                                                                slide.documentSlide ||
                                                                null,
                                                            questionSlide:
                                                                slide.questionSlide ||
                                                                null,
                                                            assignmentSlide:
                                                                slide.assignmentSlide ||
                                                                null,
                                                        })),
                                                        isOpen: false,
                                                    })
                                                ),
                                            };
                                        }
                                        return module;
                                    }),
                                },
                            };
                            updateSelectedCourseAndForm(updatedCourse);
                        } else if (selectedCourse.level === 3) {
                            const chapterQuery = handleFetchChaptersWithSlides(
                                selectedParentId,
                                packageSessionIds || ""
                            );
                            const chapterResponse =
                                await chapterQuery.queryFn();

                            const updatedCourse = {
                                ...selectedCourse,
                                structure: {
                                    ...selectedCourse.structure,
                                    items: chapterResponse.map(
                                        (
                                            chapterWithSlides: ChapterWithSlides
                                        ) => ({
                                            id: chapterWithSlides.chapter.id,
                                            name: chapterWithSlides.chapter
                                                .chapter_name,
                                            status: chapterWithSlides.chapter
                                                .status,
                                            file_id:
                                                chapterWithSlides.chapter
                                                    .file_id,
                                            description:
                                                chapterWithSlides.chapter
                                                    .description,
                                            chapter_order:
                                                chapterWithSlides.chapter
                                                    .chapter_order,
                                            slides: (
                                                chapterWithSlides.slides || []
                                            ).map((slide) => ({
                                                id: slide.id,
                                                name: slide.name,
                                                type: slide.type,
                                                description:
                                                    slide.description || "",
                                                status: slide.status || "",
                                                order: slide.order || 0,
                                                videoSlide:
                                                    slide.videoSlide || null,
                                                documentSlide:
                                                    slide.documentSlide || null,
                                                questionSlide:
                                                    slide.questionSlide || null,
                                                assignmentSlide:
                                                    slide.assignmentSlide ||
                                                    null,
                                            })),
                                            isOpen: false,
                                        })
                                    ),
                                },
                            };
                            updateSelectedCourseAndForm(updatedCourse);
                        }
                    } catch (error) {
                        console.error(
                            "Error fetching updated chapter data:",
                            error
                        );
                    }
                }
                break;
            }
        }

        setDialogOpen(false);
        setNewItemName("");
    };

    const getDialogContent = () => {
        let title = "";
        let description = "";

        switch (dialogType) {
            case "subject":
                title = "Add New Subject";
                description = "Create a new subject for your course.";
                break;
            case "module":
                title = "Add New Module";
                description = "Create a new module within the course.";
                break;
            case "chapter":
                title = "Add New Chapter";
                description = "Create a new chapter."; // More generic
                break;
            case "slide":
                title = "Add New Slide";
                description = "Create a new slide."; // More generic
                break;
            default:
                return null;
        }

        return (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>{description}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                placeholder={`Enter ${dialogType} name`}
                                disabled={isAddingChapter}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                            disabled={isAddingChapter}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddItem}
                            disabled={isAddingChapter}
                        >
                            {isAddingChapter ? (
                                <div className="flex items-center gap-2">
                                    <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    Adding...
                                </div>
                            ) : (
                                `Add ${dialogType}`
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    };

    const renderTreeItem = (
        label: string,
        id: string,
        hasChildren: boolean,
        level: number,
        isAddButton = false,
        type?: "subject" | "module" | "chapter" | "slide",
        parentIds?: {
            subjectId?: string;
            moduleId?: string;
            chapterId?: string;
            slideId?: string;
        }
    ) => {
        const handleSlideClick = (e: React.MouseEvent) => {
            e.stopPropagation(); // Prevent event bubbling

            const chapterId = parentIds?.chapterId ?? "";
            const subjectId = parentIds?.subjectId ?? "";
            const moduleId = parentIds?.moduleId ?? "";
            const slideId = parentIds?.slideId ?? "";

            router.navigate({
                to: "/study-library/course-details/subjects/modules/chapters/slides",
                search: {
                    courseId: router.state.location.search.courseId ?? "",
                    levelId: selectedLevel,
                    subjectId,
                    moduleId,
                    chapterId,
                    slideId,
                    sessionId: selectedSession,
                },
            });
        };

        const handleExportClick = (e: React.MouseEvent) => {
            e.stopPropagation(); // Prevent event bubbling

            const chapterId = parentIds?.chapterId ?? "";
            const subjectId = parentIds?.subjectId ?? "";
            const moduleId = parentIds?.moduleId ?? "";
            const slideId = parentIds?.slideId ?? "";

            router.navigate({
                to: "/study-library/course-details/subjects/modules/chapters/slides",
                search: {
                    courseId: router.state.location.search.courseId ?? "",
                    levelId: selectedLevel,
                    subjectId,
                    moduleId,
                    chapterId,
                    slideId,
                    sessionId: selectedSession,
                },
            });
        };
        return (
            <div className="flex items-center">
                <div
                    className={`flex items-center gap-2 py-1 ${type === "slide" ? "cursor-pointer hover:text-blue-600" : ""}`}
                >
                    {!isAddButton && hasChildren && type && (
                        <button
                            onClick={() => toggleExpand(id)}
                            className="p-1"
                        >
                            {expandedItems[id] ? (
                                <CaretDown className="size-4" />
                            ) : (
                                <CaretRight className="size-4" />
                            )}
                        </button>
                    )}
                </div>
                <div
                    className={`flex w-full pr-4 items-center justify-between ${type === "slide" ? "cursor-pointer hover:text-blue-600" : ""}`}
                >
                    <span
                        className="flex items-center gap-2"
                        onClick={
                            type === "slide"
                                ? (e) => handleSlideClick(e)
                                : undefined
                        }
                    >
                        {!hasChildren && <div className="size-4" />}
                        {label}
                    </span>
                    {type === "slide" && (
                        <button
                            onClick={(e) => handleExportClick(e)}
                            className="ml-2 rounded-full p-1 hover:bg-gray-100"
                            title="Export Slide"
                        >
                            <Export className="size-4 text-gray-600" />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    // Add state for slidesResult and loading
    const [slidesResult, setSlidesResult] = useState([]);
    const [slidesLoading, setSlidesLoading] = useState(false);
    const [idsContainerStructure2, setIdsContainerStructure2] = useState({
        subjectId: "",
        moduleId: "",
        chapterId: "",
    });

    useEffect(() => {
        const fetchSlides = async () => {
            if (selectedCourse?.level === 2 && currentLevel?.subjects) {
                setSlidesLoading(true);
                try {
                    const modulePromises = currentLevel.subjects.map(
                        async (subject) => {
                            const moduleQuery = handleFetchModulesWithChapters(
                                subject.id,
                                packageSessionIds || ""
                            );
                            const moduleResponse = await moduleQuery.queryFn();
                            return {
                                subjectId: subject.id,
                                modules: moduleResponse,
                            };
                        }
                    );
                    const moduleResults = await Promise.all(modulePromises);

                    const chapterPromises = moduleResults.flatMap(
                        ({ subjectId, modules }) =>
                            modules.map(async (module) => {
                                if (!module || !module.module.id) return [];
                                const chapterQuery =
                                    handleFetchChaptersWithSlides(
                                        module.module.id,
                                        packageSessionIds || ""
                                    );
                                const chapterResponse =
                                    await chapterQuery.queryFn();
                                return {
                                    subjectId,
                                    moduleId: module.module.id,
                                    chapters: chapterResponse,
                                };
                            })
                    );
                    const chapterResults = await Promise.all(chapterPromises);

                    const slidePromises = chapterResults.flatMap(
                        ({ subjectId, moduleId, chapters }) =>
                            chapters.flatMap(({ chapter }) => {
                                if (!chapter || !chapter.id) return [];
                                setIdsContainerStructure2({
                                    subjectId,
                                    moduleId,
                                    chapterId: chapter.id,
                                });
                                const slideQuery = handleFetchSlides(
                                    chapter.id
                                );
                                return slideQuery.queryFn().then((slides) =>
                                    slides.map((slide: any) => ({
                                        ...slide,
                                        name: slide.name || slide.title || "",
                                        type:
                                            slide.type ||
                                            slide.source_type ||
                                            "",
                                        order:
                                            slide.order ||
                                            slide.slide_order ||
                                            0,
                                        videoSlide:
                                            slide.videoSlide ||
                                            slide.video_slide ||
                                            null,
                                        documentSlide:
                                            slide.documentSlide ||
                                            slide.document_slide ||
                                            null,
                                        questionSlide:
                                            slide.questionSlide ||
                                            slide.question_slide ||
                                            null,
                                        assignmentSlide:
                                            slide.assignmentSlide ||
                                            slide.assignment_slide ||
                                            null,
                                        subjectId,
                                        moduleId,
                                        chapterId: chapter.id,
                                    }))
                                );
                            })
                    );
                    // Flatten the array of arrays
                    const slidesNested = await Promise.all(slidePromises);
                    setSlidesResult(slidesNested.flat());
                } catch (e) {
                    setSlidesResult([]);
                } finally {
                    setSlidesLoading(false);
                }
            }
        };
        fetchSlides();
        // Only run when course structure 2 and dependencies change
    }, [selectedCourse?.level, currentLevel, packageSessionIds]);

    // Synchronous renderCourseStructure
    const renderCourseStructure = () => {
        if (!selectedCourse) return null;
        const currentSession = (
            form.getValues("courseData").sessions as SessionType[]
        ).find((session) => session.sessionDetails.id === selectedSession);
        const currentLevel = currentSession?.levelDetails.find(
            (level) => level.id === selectedLevel
        );
        switch (selectedCourse.level) {
            case 2: {
                if (slidesLoading)
                    return <div className="p-4">Loading slides...</div>;
                return (
                    <div className="rounded-lg border p-4 px-0">
                        {slidesResult?.map((slide) => (
                            <div key={slide.id}>
                                {renderTreeItem(
                                    slide.title,
                                    `${idsContainerStructure2.subjectId}|${idsContainerStructure2.moduleId}|${idsContainerStructure2.chapterId}`,
                                    false,
                                    0,
                                    false,
                                    "slide",
                                    {
                                        subjectId:
                                            idsContainerStructure2.subjectId,
                                        moduleId:
                                            idsContainerStructure2.moduleId,
                                        chapterId:
                                            idsContainerStructure2.chapterId,
                                        slideId: slide.id,
                                    }
                                )}
                            </div>
                        ))}
                    </div>
                );
            }
            case 3: {
                // Chapters with slides - use actual form data for course structure 3
                const defaultSubjectForLevel3 = currentLevel?.subjects;
                const defaultModuleForLevel3 = defaultSubjectForLevel3?.modules;
                const chapters = defaultModuleForLevel3?.chapters || [];

                return (
                    <div className="rounded-lg border p-4">
                        {chapters.map((chapter) => (
                            <div key={chapter.id}>
                                {renderTreeItem(
                                    chapter.name,
                                    chapter.id,
                                    true,
                                    0,
                                    false,
                                    "chapter"
                                )}
                                {expandedItems[chapter.id] && (
                                    <>
                                        {chapter.slides.map((slide) => (
                                            <div key={slide.id}>
                                                {renderTreeItem(
                                                    slide.name,
                                                    slide.id,
                                                    false,
                                                    1,
                                                    false,
                                                    "slide",
                                                    { chapterId: chapter.id }
                                                )}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                );
            }
            case 4: {
                // Modules with chapters and slides - use actual form data
                const defaultSubject = currentLevel?.subjects;
                const modules = defaultSubject?.modules || [];

                return (
                    <div className="rounded-lg border p-4">
                        {modules.map((module) => (
                            <div key={module.id}>
                                {renderTreeItem(
                                    module.name,
                                    module.id,
                                    true,
                                    0,
                                    false,
                                    "module"
                                )}
                                {expandedItems[module.id] && (
                                    <>
                                        {module.chapters?.map((chapter) => (
                                            <div key={chapter.id}>
                                                {renderTreeItem(
                                                    chapter.name,
                                                    `${module.id}|${chapter.id}`,
                                                    true,
                                                    1,
                                                    false,
                                                    "chapter"
                                                )}
                                                {expandedItems[
                                                    `${module.id}|${chapter.id}`
                                                ] && (
                                                    <>
                                                        {chapter.slides.map(
                                                            (slide) => (
                                                                <div
                                                                    key={
                                                                        slide.id
                                                                    }
                                                                >
                                                                    {renderTreeItem(
                                                                        slide.name,
                                                                        slide.id,
                                                                        false,
                                                                        2,
                                                                        false,
                                                                        "slide",
                                                                        {
                                                                            moduleId:
                                                                                module.id,
                                                                            chapterId:
                                                                                chapter.id,
                                                                        }
                                                                    )}
                                                                </div>
                                                            )
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                );
            }
            case 5:
                // Subjects with modules, chapters, and slides
                return (
                    <div className="rounded-lg border p-4">
                        {currentLevel?.subjects?.map((subject) => (
                            <div key={subject.id}>
                                {renderTreeItem(
                                    subject.subject_name,
                                    subject.id,
                                    true,
                                    0,
                                    false,
                                    "subject"
                                )}
                                {expandedItems[subject.id] && (
                                    <>
                                        {subject.modules?.map((module) => (
                                            <div key={module.id}>
                                                {renderTreeItem(
                                                    module.name,
                                                    `${subject.id}|${module.id}`,
                                                    true,
                                                    1,
                                                    false,
                                                    "module"
                                                )}
                                                {expandedItems[
                                                    `${subject.id}|${module.id}`
                                                ] && (
                                                    <>
                                                        {module.chapters?.map(
                                                            (chapter) => (
                                                                <div
                                                                    key={
                                                                        chapter.id
                                                                    }
                                                                >
                                                                    {expandedItems[
                                                                        `${subject.id}|${module.id}|${chapter.id}`
                                                                    ] && (
                                                                        <>
                                                                            {chapter.slides.map(
                                                                                (
                                                                                    slide
                                                                                ) => (
                                                                                    <div
                                                                                        key={
                                                                                            slide.id
                                                                                        }
                                                                                    >
                                                                                        {renderTreeItem(
                                                                                            slide.name,
                                                                                            slide.id,
                                                                                            false,
                                                                                            3,
                                                                                            false,
                                                                                            "slide",
                                                                                            {
                                                                                                subjectId:
                                                                                                    subject.id,
                                                                                                moduleId:
                                                                                                    module.id,
                                                                                                chapterId:
                                                                                                    chapter.id,
                                                                                            }
                                                                                        )}
                                                                                    </div>
                                                                                )
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                );
        }
    };

    useEffect(() => {
        const mockCourses = form.getValues("mockCourses");
        const courseStructure = form.getValues("courseData").courseStructure;
        const course = mockCourses.find(
            (course) => course.level === courseStructure
        ) as Course;
        setSelectedCourse(course || undefined);
    }, [form.watch("courseData.courseStructure")]);

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

    useEffect(() => {
        const courseStructure = form.getValues("courseData").courseStructure;
        if (courseStructure === 3) {
            const sessions = form.getValues("courseData").sessions;
            let hasChanges = false;

            const updatedSessions = sessions.map((session) => {
                const updatedLevelDetails = session.levelDetails.map(
                    (level) => {
                        // Check if this level needs DEFAULT subject
                        const defaultSubject = level.subjects || [];
                        if (!defaultSubject) {
                            hasChanges = true;
                            return {
                                ...level,
                            };
                        } else {
                            // DEFAULT subject exists, check for DEFAULT module
                            const defaultModule = defaultSubject.modules || [];
                            if (!defaultModule) {
                                hasChanges = true;
                                const updatedSubjects = level.subjects || [];
                                return {
                                    ...level,
                                    subjects: updatedSubjects,
                                };
                            }
                        }
                        // If both DEFAULT subject and module exist, do nothing
                        return level;
                    }
                );

                return {
                    ...session,
                    levelDetails: updatedLevelDetails,
                };
            });

            if (hasChanges) {
                form.setValue("courseData.sessions", updatedSessions);
            }
        }
    }, [
        form.watch("courseData.sessions"),
        form.watch("courseData.courseStructure"),
    ]);

    // Add logs to form.reset and form.setValue
    const originalReset = form.reset.bind(form);
    form.reset = (...args: Parameters<typeof form.reset>) => {
        const result = originalReset(...args);
        setFormResetKey((k) => k + 1);
        return result;
    };
    const originalSetValue = form.setValue.bind(form);
    form.setValue = (...args: unknown[]) => {
        return originalSetValue(...args);
    };

    // Add a useEffect to always merge chapters after a form.reset if chapterQueries[0]?.data is available
    useEffect(() => {
        // Only run if chapters data is available
        if (
            chapterQueries[0]?.data &&
            Array.isArray(chapterQueries[0]?.data) &&
            chapterQueries[0]?.data.length > 0 &&
            selectedSession &&
            selectedLevel
        ) {
            const mappedChapters = chapterQueries[0].data.map(
                (item: ChapterWithSlides) => ({
                    id: item.chapter.id,
                    name: item.chapter.chapter_name,
                    status: item.chapter.status,
                    file_id: item.chapter.file_id,
                    description: item.chapter.description,
                    chapter_order: item.chapter.chapter_order,
                    slides: Array.isArray(item.slides)
                        ? item.slides.map((slide: SlideType) => ({
                              id: slide.id,
                              name: slide.name,
                              type: slide.type,
                              description: slide.description || "",
                              status: slide.status || "",
                              order: slide.order || 0,
                              videoSlide: slide.videoSlide || null,
                              documentSlide: slide.documentSlide || null,
                              questionSlide: slide.questionSlide || null,
                              assignmentSlide: slide.assignmentSlide || null,
                          }))
                        : [],
                    isOpen: false,
                })
            );
            // Merge chapters into the correct session/level/subject/module
            const sessions = form.getValues("courseData").sessions;
            const updatedSessions = sessions.map((session) => {
                if (session.sessionDetails.id !== selectedSession)
                    return session;
                return {
                    ...session,
                    levelDetails: session.levelDetails.map((level) => {
                        if (level.id !== selectedLevel) return level;
                        return {
                            ...level,
                            subjects: (level.subjects || []).map((subject) => {
                                return {
                                    ...subject,
                                    modules: (subject.modules || []).map(
                                        (module) => {
                                            return {
                                                ...module,
                                                chapters: mappedChapters,
                                            };
                                        }
                                    ),
                                };
                            }),
                        };
                    }),
                };
            });
            form.setValue("courseData.sessions", updatedSessions);
        }
    }, [chapterQueries[0]?.data, selectedSession, selectedLevel, formResetKey]);

    // Add this with other queries at the top level of the component
    const slideCountQuery = useQuery({
        ...handleGetSlideCountDetails(packageSessionIds || ""),
        enabled: !!packageSessionIds,
    });

    useEffect(() => {
        if (packageSessionIds) {
            const fetchAllModulesAndChapters = async () => {
                const sessions = form.getValues("courseData").sessions;
                const currentSession = sessions.find(
                    (session) => session.sessionDetails.id === selectedSession
                );
                const currentLevel = currentSession?.levelDetails.find(
                    (level) => level.id === selectedLevel
                );
                if (!currentLevel || !packageSessionIds) return;
                const subjects = currentLevel.subjects || [];
                if (!subjects) return [];
                // Fetch modules for all subjects
                const moduleResults: {
                    subjectId: string;
                    modules: ModuleType[];
                }[] = await Promise.all(
                    subjects.map(async (subject) => {
                        const moduleQuery = handleFetchModulesWithChapters(
                            subject.id,
                            packageSessionIds
                        );
                        const moduleResponse: ModuleType[] =
                            await moduleQuery.queryFn();
                        return {
                            subjectId: subject.id,
                            modules: moduleResponse,
                        };
                    })
                );
                // Fetch chapters for all modules
                const chapterResults = await Promise.all(
                    moduleResults.flatMap(({ subjectId, modules }) =>
                        modules.map(async (module) => {
                            if (!module || !module.module.id) return;
                            const chapterQuery = handleFetchChaptersWithSlides(
                                module.module.id,
                                packageSessionIds
                            );
                            const chapterResponse: ChapterWithSlides[] =
                                await chapterQuery.queryFn();
                            return {
                                subjectId,
                                moduleId: module.module.id,
                                chapters: chapterResponse,
                            };
                        })
                    )
                );
                // Assign modules and chapters into form state
                const updatedSubjects = subjects.map((subject) => {
                    const subjectModules =
                        moduleResults.find((r) => r.subjectId === subject.id)
                            ?.modules || [];
                    return {
                        ...subject,
                        modules: subjectModules.map((moduleData) => {
                            const moduleChapters =
                                chapterResults.find(
                                    (r) =>
                                        r.subjectId === subject.id &&
                                        r.moduleId === moduleData.module.id
                                )?.chapters || [];
                            return {
                                id: moduleData.module.id,
                                name: moduleData.module.module_name,
                                description: moduleData.module.description,
                                status: moduleData.module.status,
                                thumbnail_id: moduleData.module.thumbnail_id,
                                chapters: moduleChapters.map(
                                    (chapterWithSlides) => ({
                                        id: chapterWithSlides.chapter.id,
                                        name: chapterWithSlides.chapter
                                            .chapter_name,
                                        status: chapterWithSlides.chapter
                                            .status,
                                        file_id:
                                            chapterWithSlides.chapter.file_id,
                                        description:
                                            chapterWithSlides.chapter
                                                .description,
                                        chapter_order:
                                            chapterWithSlides.chapter
                                                .chapter_order,
                                        slides: Array.isArray(
                                            chapterWithSlides.slides
                                        )
                                            ? chapterWithSlides.slides.map(
                                                  (slide) => ({
                                                      id: slide.id,
                                                      name: slide.name,
                                                      type: slide.type,
                                                      description:
                                                          slide.description ||
                                                          "",
                                                      status:
                                                          slide.status || "",
                                                      order: slide.order || 0,
                                                      videoSlide:
                                                          slide.videoSlide ||
                                                          null,
                                                      documentSlide:
                                                          slide.documentSlide ||
                                                          null,
                                                      questionSlide:
                                                          slide.questionSlide ||
                                                          null,
                                                      assignmentSlide:
                                                          slide.assignmentSlide ||
                                                          null,
                                                  })
                                              )
                                            : [],
                                        isOpen: false,
                                    })
                                ),
                                isOpen: false,
                            };
                        }),
                    };
                });
                // Update form state
                const updatedSessions = sessions.map((session) => {
                    if (session.sessionDetails.id !== selectedSession)
                        return session;
                    return {
                        ...session,
                        levelDetails: session.levelDetails.map((level) => {
                            if (level.id !== selectedLevel) return level;
                            return {
                                ...level,
                                subjects: updatedSubjects,
                            };
                        }),
                    };
                });
                form.setValue("courseData.sessions", updatedSessions);
            };
            // Call on mount
            fetchAllModulesAndChapters();
            // Call on navigation
            const unsubscribe = router.subscribe(() => {
                if (
                    router.state.location.pathname.includes(
                        "/study-library/courses/course-details"
                    )
                ) {
                    fetchAllModulesAndChapters();
                }
            });
            return () => unsubscribe();
        }
    }, [router, selectedSession, selectedLevel, packageSessionIds]);

    return (
        <>
            <div className="flex min-h-screen flex-col bg-white w-full">
                {/* Top Banner */}
                <div className="relative h-[300px]">
                    {/* Transparent black overlay */}
                    {form.watch("courseData").courseBannerMediaId && (
                        <div className="pointer-events-none absolute inset-0 z-10 bg-black/50" />
                    )}
                    {!form.watch("courseData").courseBannerMediaId ? (
                        <div className="absolute inset-0 z-0 bg-primary-500" />
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
                    <div className="container relative z-20 mx-auto px-4 py-12 text-white">
                        <div className="flex items-start justify-between gap-8">
                            {/* Left side - Title and Description */}
                            <div className="max-w-2xl">
                                {!form.watch("courseData").title ? (
                                    <div className="space-y-4">
                                        <div className="h-8 w-32 animate-pulse rounded bg-white/20" />
                                        <div className="h-12 w-3/4 animate-pulse rounded bg-white/20" />
                                        <div className="h-4 w-full animate-pulse rounded bg-white/20" />
                                        <div className="h-4 w-2/3 animate-pulse rounded bg-white/20" />
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-4 flex gap-2">
                                            {form
                                                .getValues("courseData")
                                                .tags.map((tag, index) => (
                                                    <span
                                                        key={index}
                                                        className="rounded-full bg-blue-600 px-3 py-1 text-sm"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                        </div>
                                        <h1 className="mb-4 text-4xl font-bold">
                                            {form.getValues("courseData").title}
                                        </h1>
                                        <p className="text-lg opacity-90">
                                            {
                                                form.getValues("courseData")
                                                    .description
                                            }
                                        </p>
                                    </>
                                )}
                            </div>

                            {/* Right side - Video Player */}
                            <div className="w-[400px] overflow-hidden rounded-lg shadow-xl">
                                <div className="relative aspect-video bg-black">
                                    {!form.watch("courseData").courseMediaId ? (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="flex size-16 items-center justify-center rounded-full bg-white/20">
                                                <svg
                                                    className="size-8 text-white"
                                                    fill="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path d="M8 5v14l11-7z" />
                                                </svg>
                                            </div>
                                        </div>
                                    ) : (
                                        <video
                                            src={
                                                form.watch("courseData")
                                                    .courseMediaId
                                            }
                                            controls
                                            className="size-full rounded-lg object-contain"
                                            onError={(e) => {
                                                e.currentTarget.style.display =
                                                    "none";
                                                e.currentTarget.parentElement?.classList.add(
                                                    "bg-black"
                                                );
                                            }}
                                        >
                                            Your browser does not support the
                                            video tag.
                                        </video>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="container mx-auto px-4 py-8">
                    <div className="flex gap-8">
                        {/* Left Column - 2/3 width */}
                        <div className="w-2/3 grow">
                            {/* Session and Level Selectors */}
                            <div className="container mx-auto px-0 pb-6">
                                <div className="flex items-center gap-6">
                                    {sessionOptions.length === 1 ? (
                                        sessionOptions[0].label !==
                                            "default" && (
                                            <div className="flex flex-col gap-2">
                                                <label className="text-sm font-medium">
                                                    Session
                                                </label>
                                                <Select
                                                    value={selectedSession}
                                                    onValueChange={
                                                        handleSessionChange
                                                    }
                                                >
                                                    <SelectTrigger className="w-48">
                                                        <SelectValue placeholder="Select Session" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {sessionOptions.map(
                                                            (option) => (
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
                                        )
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-medium">
                                                Session
                                            </label>
                                            <Select
                                                value={selectedSession}
                                                onValueChange={
                                                    handleSessionChange
                                                }
                                            >
                                                <SelectTrigger className="w-48">
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
                                    )}

                                    {levelOptions.length === 1 ? (
                                        levelOptions[0].label !== "default" && (
                                            <div className="flex flex-col gap-2">
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
                                                    <SelectTrigger className="w-48">
                                                        <SelectValue placeholder="Select Level" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {levelOptions.map(
                                                            (option) => (
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
                                        )
                                    ) : (
                                        <div className="flex flex-col gap-2">
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
                                                <SelectTrigger className="w-48">
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
                                    )}
                                </div>
                            </div>

                            {/* Course Structure */}
                            <div className="mb-8">
                                <h2 className="mb-4 text-xl font-semibold">
                                    Course Structure
                                </h2>
                                {selectedCourse && renderCourseStructure()}
                            </div>

                            {/* What You'll Learn Section */}
                            <div className="mb-8">
                                <h2 className="mb-4 text-2xl font-bold">
                                    What you&apos;ll learn?
                                </h2>
                                <div className="rounded-lg">
                                    <p
                                        dangerouslySetInnerHTML={{
                                            __html:
                                                form.getValues("courseData")
                                                    .whatYoullLearn || "",
                                        }}
                                    />
                                </div>
                            </div>

                            {/* About Content Section */}
                            <div className="mb-8">
                                <h2 className="mb-4 text-2xl font-bold">
                                    About this course
                                </h2>
                                <div className="rounded-lg">
                                    <p
                                        dangerouslySetInnerHTML={{
                                            __html:
                                                form.getValues("courseData")
                                                    .aboutTheCourse || "",
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Who Should Join Section */}
                            <div className="mb-8">
                                <h2 className="mb-4 text-2xl font-bold">
                                    Who should join?
                                </h2>
                                <div className="rounded-lg">
                                    <p
                                        dangerouslySetInnerHTML={{
                                            __html:
                                                form.getValues("courseData")
                                                    .whoShouldLearn || "",
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Instructors Section */}
                            <div className="mb-8">
                                <h2 className="mb-4 text-2xl font-bold">
                                    Instructors
                                </h2>
                                {form
                                    .getValues("courseData")
                                    .instructors.map((instructor, index) => (
                                        <div
                                            key={index}
                                            className="flex gap-4 rounded-lg bg-gray-50 p-4"
                                        >
                                            <Avatar className="size-8">
                                                <AvatarImage
                                                    src=""
                                                    alt={instructor.email}
                                                />
                                                <AvatarFallback className="bg-[#3B82F6] text-xs font-medium text-white">
                                                    {getInitials(
                                                        instructor.email
                                                    )}
                                                </AvatarFallback>
                                            </Avatar>
                                            <h3 className="text-lg">
                                                {instructor.name}
                                            </h3>
                                        </div>
                                    ))}
                            </div>
                        </div>

                        {/* Right Column - 1/3 width */}
                        <div className="w-1/3">
                            <div className="sticky top-4 rounded-lg border bg-white p-6 shadow-lg">
                                {/* Course Stats */}
                                <h2 className="mb-4 text-lg font-bold">
                                    Scratch Programming Language
                                </h2>
                                <div className="space-y-4">
                                    {levelOptions[0]?.label !== "default" && (
                                        <div className="flex items-center gap-2">
                                            <Steps size={18} />
                                            <span>
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
                                    {slideCountQuery.isLoading ? (
                                        <div className="space-y-2">
                                            {[1, 2, 3, 4, 5].map((i) => (
                                                <div
                                                    key={i}
                                                    className="h-6 w-32 animate-pulse rounded bg-gray-200"
                                                />
                                            ))}
                                        </div>
                                    ) : slideCountQuery.error ? (
                                        <div className="text-sm text-red-500">
                                            Error loading slide counts
                                        </div>
                                    ) : (
                                        <>
                                            {slideCountQuery.data?.map(
                                                (count: SlideCountType) => (
                                                    <div
                                                        key={count.source_type}
                                                        className="flex items-center gap-2"
                                                    >
                                                        {count.source_type ===
                                                            "VIDEO" && (
                                                            <>
                                                                <PlayCircle
                                                                    size={18}
                                                                />
                                                                <span>
                                                                    {
                                                                        count.slide_count
                                                                    }{" "}
                                                                    Video slides
                                                                </span>
                                                            </>
                                                        )}
                                                        {count.source_type ===
                                                            "CODE" && (
                                                            <>
                                                                <Code
                                                                    size={18}
                                                                />
                                                                <span>
                                                                    {
                                                                        count.slide_count
                                                                    }{" "}
                                                                    Code slides
                                                                </span>
                                                            </>
                                                        )}
                                                        {count.source_type ===
                                                            "PDF" && (
                                                            <>
                                                                <FilePdf
                                                                    size={18}
                                                                />
                                                                <span>
                                                                    {
                                                                        count.slide_count
                                                                    }{" "}
                                                                    PDF slides
                                                                </span>
                                                            </>
                                                        )}
                                                        {count.source_type ===
                                                            "DOCUMENT" && (
                                                            <>
                                                                <FileDoc
                                                                    size={18}
                                                                />
                                                                <span>
                                                                    {
                                                                        count.slide_count
                                                                    }{" "}
                                                                    Doc slides
                                                                </span>
                                                            </>
                                                        )}
                                                        {count.source_type ===
                                                            "QUESTION" && (
                                                            <>
                                                                <Question
                                                                    size={18}
                                                                />
                                                                <span>
                                                                    {
                                                                        count.slide_count
                                                                    }{" "}
                                                                    Question
                                                                    slides
                                                                </span>
                                                            </>
                                                        )}
                                                        {count.source_type ===
                                                            "ASSIGNMENT" && (
                                                            <>
                                                                <File
                                                                    size={18}
                                                                />
                                                                <span>
                                                                    {
                                                                        count.slide_count
                                                                    }{" "}
                                                                    Assignment
                                                                    slides
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                )
                                            )}
                                            {form.getValues("courseData")
                                                .instructors.length > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <ChalkboardTeacher
                                                        size={18}
                                                    />
                                                    <span>
                                                        {form
                                                            .getValues(
                                                                "courseData"
                                                            )
                                                            .instructors.map(
                                                                (i) => i.name
                                                            )
                                                            .join(", ")}
                                                    </span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <CourseDetailsRatingsComponent
                        packageSessionId={packageSessionIdForCurrentLevel}
                    />
                </div>
                {getDialogContent()}
            </div>
        </>
    );
};
