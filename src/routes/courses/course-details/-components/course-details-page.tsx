import { Steps } from "@phosphor-icons/react";
import { useRouter } from "@tanstack/react-router";
import {
  Code,
  File,
  FilePdf,
  PlayCircle,
  Question,
  Presentation,
  GameController,
  Exam,
  Terminal,
  ClipboardText,
  FileDoc,
  Notebook,
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

export const CourseDetailsPage = () => {
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const router = useRouter();
  const searchParams = router.state.location.search;

  const [packageSessionIdForCurrentLevel, setPackageSessionIdForCurrentLevel] =
    useState<string | null>(null);

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
    const fetchInstituteDetails = async () => {
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

    fetchInstituteDetails();
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
      label: toTitleCase(session.sessionDetails.session_name),
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
      const newLevelOptions = selectedSessionData.levelDetails.map((level) => ({
        _id: level.id,
        value: level.id,
        label: level.name,
      }));
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
          const transformedData = await transformApiDataToCourseData(
            courseDetailsData
          );
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
        <div className="relative h-[300px]">
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
                src={form.watch("courseData").courseBannerMediaId}
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
            className={`container relative z-20 mx-auto px-4 py-12 ${
              !form.watch("courseData").courseBannerMediaId
                ? "text-black"
                : "text-white"
            }`}
          >
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
                      {form.getValues("courseData").tags.map((tag, index) => (
                        <span
                          key={index}
                          className={`rounded-full px-3 py-1 text-sm ${
                            !form.watch("courseData").courseBannerMediaId
                              ? "text-black bg-white"
                              : "text-white bg-blue-500"
                          }`}
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
                        __html: form.getValues("courseData").description || "",
                      }}
                    />
                  </>
                )}
              </div>

              {/* Right side - Video Player */}
              {form.watch("courseData").courseMediaId && (
                <div className="w-[400px] overflow-hidden rounded-lg shadow-xl">
                  <div className="relative aspect-video bg-black">
                    <video
                      src={form.watch("courseData").courseMediaId}
                      controls
                      controlsList="nodownload noremoteplayback"
                      disablePictureInPicture
                      disableRemotePlayback
                      className="size-full rounded-lg object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        e.currentTarget.parentElement?.classList.add(
                          "bg-black"
                        );
                      }}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </div>
              )}
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
                  {/* Session Dropdown Logic */}
                  {sessionOptions.length === 1 &&
                  sessionOptions[0].label ===
                    "default" ? null : sessionOptions.length === 1 ? (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">
                        {sessionOptions[0]?.label}
                      </label>
                    </div>
                  ) : sessionOptions.length > 1 ? (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">Session</label>
                      <Select
                        value={selectedSession}
                        onValueChange={handleSessionChange}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select Session" />
                        </SelectTrigger>
                        <SelectContent>
                          {sessionOptions.map((option) => (
                            <SelectItem key={option._id} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  {/* Level Dropdown Logic */}
                  {levelOptions.length === 1 &&
                  levelOptions[0].label ===
                    "default" ? null : levelOptions.length === 1 ? (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">
                        {/* {levelOptions[0]?.label} */}
                      </label>
                    </div>
                  ) : levelOptions.length > 1 ? (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">Level</label>
                      <Select
                        value={selectedLevel}
                        onValueChange={handleLevelChange}
                        disabled={!selectedSession}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select Level" />
                        </SelectTrigger>
                        <SelectContent>
                          {levelOptions.map((option) => (
                            <SelectItem key={option._id} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
              </div>
              <CourseStructureDetails
                selectedSession={selectedSession}
                selectedLevel={selectedLevel}
                courseStructure={form.getValues("courseData.courseStructure")}
                courseData={form.getValues()}
                packageSessionId={packageSessionIdForCurrentLevel || ""}
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
                          form.getValues("courseData").whatYoullLearn || "",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* About Content Section */}
              {form.getValues("courseData").aboutTheCourse && (
                <div className="mb-8">
                  <h2 className="mb-4 text-2xl font-bold">About this course</h2>
                  <div className="rounded-lg">
                    <p
                      dangerouslySetInnerHTML={{
                        __html:
                          form.getValues("courseData").aboutTheCourse || "",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Who Should Join Section */}
              {form.getValues("courseData").whoShouldLearn && (
                <div className="mb-8">
                  <h2 className="mb-4 text-2xl font-bold">Who should join?</h2>
                  <div className="rounded-lg">
                    <p
                      dangerouslySetInnerHTML={{
                        __html:
                          form.getValues("courseData").whoShouldLearn || "",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Instructors Section */}
              {form.getValues("courseData").instructors &&
                form.getValues("courseData").instructors.length > 0 && (
                  <div className="mb-8">
                    <h2 className="mb-4 text-2xl font-bold">Instructors</h2>
                    {form
                      .getValues("courseData")
                      .instructors.map((instructor, index) => (
                        <div
                          key={index}
                          className="flex gap-4 rounded-lg bg-gray-50 p-4"
                        >
                          <Avatar className="size-8">
                            <AvatarImage src="" alt={instructor.email} />
                            <AvatarFallback className="bg-[#3B82F6] text-xs font-medium text-white">
                              {getInitials(instructor.email)}
                            </AvatarFallback>
                          </Avatar>
                          <h3 className="text-lg">{instructor.name}</h3>
                        </div>
                      ))}
                  </div>
                )}
            </div>

            {/* Right Column - 1/3 width */}
            <div className="w-1/5">
              <div className="sticky top-4 rounded-lg border bg-white p-6 shadow-lg">
                {/* Course Stats */}
                <h2 className="mb-4 text-lg font-bold">
                  {form.getValues("courseData").title}
                </h2>

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
                              {getTerminology(
                                ContentTerms.Level,
                                SystemTerms.Level
                              ).toLocaleLowerCase()}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-primary-800">
                            {
                              levelOptions.find(
                                (option) => option.value === selectedLevel
                              )?.label
                            }
                          </span>
                        </div>
                      )}

                    {/* Slide Counts */}
                    {slideCountQuery.isLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3, 4, 5].map((i) => (
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
                              key={count.source_type}
                              className="flex items-center justify-between p-2.5 bg-gray-50/80 rounded-lg hover:bg-gray-100/80 transition-all duration-300 group/item"
                            >
                              <div className="flex items-center space-x-2">
                                {getSlideTypeIcon(count.source_type)}
                                <span className="text-xs font-medium text-gray-700">
                                  {count.display_name}
                                </span>
                              </div>
                              <span className="text-xs font-bold text-gray-900 bg-white px-2 py-0.5 rounded-md shadow-sm">
                                {count.slide_count}
                              </span>
                            </div>
                          )
                        )}
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
                        className="mt-4 !min-w-full !w-full"
                      >
                        Enroll
                      </MyButton>
                    }
                  />
                </div>
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
