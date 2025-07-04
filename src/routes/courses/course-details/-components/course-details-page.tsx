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
import { DialogTrigger, Dialog, DialogContent } from "@/components/ui/dialog";
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
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { CourseDetailsRatingsComponent } from "./course-details-ratings-page";
import {
    getIdByLevelAndSession,
    transformApiDataToCourseData,
} from "../-utils/helper";
import { handleGetAllCourseDetails } from "../-services/get-course-details";
import axios from "axios";
import { urlInstituteDetails } from "@/constants/urls";
import CourseListHeader from "../../-component/CourseListHeader";
import { MyButton } from "@/components/design-system/button";
import { LoginForm } from "@/components/common/LoginPages/sections/login-form";
import { CourseStructureDetails } from "./course-structure-details";
import { handleGetSlideCountDetails } from "../-services/get-slides-count";
import {
    BatchForSessionType,
    InstituteDetailsType,
} from "@/types/institute-details/institute-details-interface";
import { CourseStructureResponse } from "@/types/institute-details/course-details-interface";

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

export const CourseDetailsPage = () => {
    const [selectedSession, setSelectedSession] = useState<string>("");
    const [selectedLevel, setSelectedLevel] = useState<string>("");
    const router = useRouter();
    const searchParams = router.state.location.search;

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

    const [instituteDetails, setInstituteDetails] =
        useState<InstituteDetailsType | null>(null);

    // ✅ Fetch institute details
    useEffect(() => {
        const FetchInstituteDetails = async () => {
            try {
                const response = await axios.get(
                    `${urlInstituteDetails}/${searchParams.instituteId}`
                );
                setPackageSessionIds(
                    findIdByPackageId(response.data.batches_for_sessions)
                );
                setInstituteDetails(response?.data);
                setPackageSessionIdForCurrentLevel(
                    getIdByLevelAndSession(
                        response?.data?.batches_for_sessions,
                        selectedSession,
                        selectedLevel
                    )
                );
            } catch (error) {
                console.log(error);
            }
        };

        FetchInstituteDetails();
    }, [searchParams.instituteId, selectedSession, selectedLevel]);

    // Only run the query if instituteId is available
    const { data: studyLibraryData } = useSuspenseQuery(
        handleGetAllCourseDetails({
            instituteId: searchParams.instituteId || "",
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
            <div className="flex min-h-screen flex-col bg-white w-full">
                <CourseListHeader
                    fileId={instituteDetails?.institute_logo_file_id || ""}
                    instituteId={instituteDetails?.id}
                />
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
                                        <p
                                            className="text-lg opacity-90"
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

                            {/* What You'll Learn Section */}
                            {form.getValues("courseData").whatYoullLearn && (
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
                            )}

                            {/* About Content Section */}
                            {form.getValues("courseData").aboutTheCourse && (
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
                            )}

                            {/* Who Should Join Section */}
                            {form.getValues("courseData").whoShouldLearn && (
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
                            )}

                            {/* Instructors Section */}
                            {form.getValues("courseData").instructors &&
                                form.getValues("courseData").instructors
                                    .length > 0 && (
                                    <div className="mb-8">
                                        <h2 className="mb-4 text-2xl font-bold">
                                            Instructors
                                        </h2>
                                        {form
                                            .getValues("courseData")
                                            .instructors.map(
                                                (instructor, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex gap-4 rounded-lg bg-gray-50 p-4"
                                                    >
                                                        <Avatar className="size-8">
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
                                                        <h3 className="text-lg">
                                                            {instructor.name}
                                                        </h3>
                                                    </div>
                                                )
                                            )}
                                    </div>
                                )}
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
                                <Dialog>
                                    <DialogTrigger className="w-full">
                                        <MyButton
                                            type="button"
                                            scale="large"
                                            buttonType="primary"
                                            layoutVariant="default"
                                            className="mt-4 !min-w-full !w-full"
                                        >
                                            Enroll
                                        </MyButton>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <LoginForm />
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>
                    </div>
                    <CourseDetailsRatingsComponent
                        packageSessionId={packageSessionIdForCurrentLevel}
                    />
                </div>
            </div>
        </>
    );
};
