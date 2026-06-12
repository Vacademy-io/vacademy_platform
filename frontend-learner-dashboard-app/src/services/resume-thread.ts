/**
 * Resume thread (v1, localStorage) — remembers where the learner left off so
 * every surface can offer one-click "Continue".
 *
 * Written by the slides viewer on every slide visit; read by the dashboard
 * hero (and, in later phases, course cards / course details). Storage is
 * per-device for now; swap the storage layer for a backend "last position"
 * API later without changing this module's interface.
 */

const STORAGE_KEY = "vacademy.resumeThread.v1";
const MAX_ENTRIES = 10;

export interface ResumeEntry {
  courseId: string;
  /** levelId is part of the slides route search; optional on older entries. */
  levelId?: string;
  subjectId: string;
  moduleId: string;
  chapterId: string;
  slideId: string;
  sessionId: string;
  /** Display strings captured at visit time so the hero can render without refetching. */
  slideTitle: string;
  chapterName?: string;
  courseName?: string;
  updatedAt: number;
}

/** The slides-viewer route every entry resumes into. */
export const RESUME_ROUTE =
  "/study-library/courses/course-details/subjects/modules/chapters/slides";

function readAll(): ResumeEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ResumeEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: ResumeEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // Storage full/unavailable (private mode) — resume thread is best-effort.
  }
}

/** Record a slide visit. Keyed by course: one entry per course, most recent first. */
export function recordSlideVisit(entry: Omit<ResumeEntry, "updatedAt">): void {
  if (!entry.courseId || !entry.slideId) return;
  const rest = readAll().filter((e) => e.courseId !== entry.courseId);
  writeAll([{ ...entry, updatedAt: Date.now() }, ...rest]);
}

/** Most recent resume point across all courses, or null. */
export function getLatestResume(): ResumeEntry | null {
  return readAll()[0] ?? null;
}

/** Most recent resume point for one course, or null. */
export function getResumeForCourse(courseId: string): ResumeEntry | null {
  return readAll().find((e) => e.courseId === courseId) ?? null;
}

/** Search params for router.navigate({ to: RESUME_ROUTE, search }). */
export function resumeSearchParams(entry: ResumeEntry): Record<string, string> {
  const search: Record<string, string> = {
    courseId: entry.courseId,
    subjectId: entry.subjectId,
    moduleId: entry.moduleId,
    chapterId: entry.chapterId,
    slideId: entry.slideId,
    sessionId: entry.sessionId,
  };
  if (entry.levelId) search.levelId = entry.levelId;
  return search;
}

/** Drop an entry (e.g. course unenrolled or content missing on resume). */
export function clearResumeForCourse(courseId: string): void {
  writeAll(readAll().filter((e) => e.courseId !== courseId));
}
