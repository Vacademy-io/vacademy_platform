// Small read helpers over loosely-typed API payloads (course-init and the
// package-detail endpoint). Kept as pure functions so the page component
// doesn't need inline structural casts.

export type CourseInitSubject = {
  id: string;
  subject_name?: string;
  subject_code?: string;
  credit?: number;
  thumbnail_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  subject_order?: number;
};

export function getCourseDepthFromInit(
  courseDetailsData: unknown,
): number | undefined {
  return (courseDetailsData as { course?: { course_depth?: number } } | null)
    ?.course?.course_depth;
}

// Subjects of the first session's first level — used to call
// modules-with-chapters (and show content) before the form is populated.
export function getFirstLevelSubjectsFromInit(
  courseDetailsData: unknown,
): CourseInitSubject[] | undefined {
  const data = courseDetailsData as
    | {
        sessions?: Array<{
          level_with_details?: Array<{ subjects?: CourseInitSubject[] }>;
        }>;
      }
    | null
    | undefined;
  const subjects = data?.sessions?.[0]?.level_with_details?.[0]?.subjects;
  return Array.isArray(subjects) && subjects.length > 0 ? subjects : undefined;
}

// read_time_in_minutes lives either at the top level or under `data`
// depending on which service shape responded.
export function extractReadTimeMinutes(data: unknown): number | undefined {
  if (!data) return undefined;
  const rawData = data as Record<string, unknown>;

  if (
    "read_time_in_minutes" in rawData &&
    typeof rawData.read_time_in_minutes === "number" &&
    rawData.read_time_in_minutes
  ) {
    return rawData.read_time_in_minutes;
  }

  const nested = rawData.data;
  if (nested && typeof nested === "object" && "read_time_in_minutes" in nested) {
    const value = (nested as Record<string, unknown>).read_time_in_minutes;
    if (typeof value === "number" && value) return value;
  }

  return undefined;
}

type InstructorLike = { full_name?: string; username?: string };
type CourseAuthorLike = {
  course?: {
    created_by_name?: string;
    author_name?: string;
    owner_name?: string;
  };
};

// Author display name, in the order the page has always preferred:
// form instructors → package-detail instructors → course-init author fields →
// package-detail author fields.
export function derivePrimaryInstructorName({
  formInstructors,
  packageDetailData,
  courseInitData,
}: {
  formInstructors: Array<{ name?: string; full_name?: string }> | undefined;
  packageDetailData: unknown;
  courseInitData: unknown;
}): string | undefined {
  const fromForm =
    formInstructors?.[0]?.name || formInstructors?.[0]?.full_name;
  if (fromForm) return fromForm;

  const packageInstructors = (
    packageDetailData as { instructors?: InstructorLike[] } | null | undefined
  )?.instructors;
  const fromPackageInstructors =
    packageInstructors?.[0]?.full_name || packageInstructors?.[0]?.username;
  if (fromPackageInstructors) return fromPackageInstructors;

  const initCourse = (courseInitData as CourseAuthorLike | null | undefined)
    ?.course;
  const fromInit =
    initCourse?.created_by_name ||
    initCourse?.author_name ||
    initCourse?.owner_name;
  if (fromInit) return fromInit;

  const packageCourse = (
    packageDetailData as CourseAuthorLike | null | undefined
  )?.course;
  return (
    packageCourse?.created_by_name ||
    packageCourse?.author_name ||
    packageCourse?.owner_name ||
    undefined
  );
}
