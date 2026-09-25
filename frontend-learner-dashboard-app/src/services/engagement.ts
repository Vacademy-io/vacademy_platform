import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { BASE_URL } from "@/constants/urls";
import { getInstituteId } from "@/constants/helper";

/**
 * Daily engagement: the teacher-scheduled tasks a learner sees on their home page.
 * Backend: admin_core_service /engagement/learner/v1/**.
 *
 * Design doc: docs/engagement/DAILY_ENGAGEMENT_PLATFORM.md
 */

export type EngagementItemType =
  | "READING_HTML"
  | "VISUAL_NOTE"
  | "QUESTION_OF_DAY"
  | "QUIZ"
  | "GAME"
  | "POLL"
  /** An existing slide from the course library. */
  | "COURSE_SLIDE";

export type EngagementState = "UPCOMING" | "OPEN" | "CATCH_UP" | "CLOSED";

export interface EngagementItem {
  id: string;
  slotId: string;
  planId: string;
  packageSessionId: string;
  packageSessionName?: string | null;
  itemType: EngagementItemType;
  title: string;
  version: number;
  sortOrder: number;
  isRequired: boolean;

  /** Absent on UPCOMING items — the server withholds locked content entirely. */
  contentHtml?: string | null;
  slideId?: string | null;
  questionId?: string | null;
  assessmentId?: string | null;
  /** Answer keys are stripped from this until the reveal time passes. */
  payloadJson?: string | null;

  completionPoints: number;
  correctPoints: number;
  maxScore?: number | null;

  state: EngagementState;
  runDate?: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
  revealAt?: string | null;
  isRevealed?: boolean | null;
  /** Points kept on a late completion; 100 while the task is open. */
  pointsPercent?: number | null;
  /** The outcome is withheld until revealAt. */
  hideResultUntilReveal?: boolean | null;

  attemptStatus?: string | null;
  isCorrect?: boolean | null;
  /** True when isCorrect is withheld until revealAt (hide-result questions). */
  resultPending?: boolean | null;
  pointsAwarded?: number | null;

  completedCount?: number | null;

  /** Present only on revealed entries. */
  correctOptionId?: string | null;
  explanation?: string | null;
  selectedOptionId?: string | null;

  // History entries only.
  isLate?: boolean | null;
  completedAt?: string | null;
  historyStatus?: EngagementHistoryStatus | null;
}

export type EngagementHistoryStatus = "DONE" | "MISSED" | "CATCH_UP";

/** Past occurrences, newest first. Today's open tasks are not here. */
export interface EngagementHistory {
  from: string;
  to: string;
  items: EngagementItem[];
  done: number;
  /** Closed and no longer doable. */
  missed: number;
  /** Missed but still inside the catch-up window. */
  catchUp: number;
  pointsEarned: number;
}

export interface EngagementFeed {
  items: EngagementItem[];
  upcoming: EngagementItem[];
  totalToday: number;
  completedToday: number;
  capApplied: boolean;
  /** Recently revealed tasks the learner completed — answer, explanation, result. */
  revealed: EngagementItem[];
  /** Consecutive days with a completion, ending today or yesterday. */
  streakDays: number;
}

/**
 * Where a COURSE_SLIDE task points. Carried in payloadJson because the learner app
 * needs the whole path — course, session, subject, module, chapter — to open a slide,
 * not just its id.
 */
export interface EngagementSlideTarget {
  slideId: string;
  slideTitle?: string;
  slideType?: string;
  courseId?: string;
  sessionId?: string;
  levelId?: string;
  subjectId?: string;
  moduleId?: string;
  chapterId?: string;
}

/** MCQ unless the item says otherwise — older items carry no format. */
export function questionFormatOf(item: EngagementItem): QuestionFormat {
  return (parseQuestionPayload(item)?.format ?? "MCQ") as QuestionFormat;
}

/** Parse a COURSE_SLIDE item's target; null when the payload is absent or broken. */
export function parseSlideTarget(item: EngagementItem): EngagementSlideTarget | null {
  if (!item.payloadJson) return null;
  try {
    const parsed = JSON.parse(item.payloadJson) as EngagementSlideTarget;
    return parsed?.slideId ? parsed : null;
  } catch {
    return null;
  }
}

/** Options as authored by the teacher. `correctOptionId` only arrives after reveal. */
/** How a question of the day is answered. */
export type QuestionFormat = "MCQ" | "TEXT" | "UPLOAD";

export interface EngagementQuestionPayload {
  /** Absent on older items, which were all multiple choice. */
  format?: QuestionFormat;
  options?: { id: string; text: string }[];
  correctOptionId?: string;
  explanation?: string;
  prompt?: string;
}

export interface EngagementSubmitRequest {
  selectedOptionId?: string;
  /** Written-answer format. */
  textAnswer?: string;
  /** Upload format: ids returned by the file upload. */
  fileIds?: string[];
  score?: number;
  responseJson?: string;
  timeSpentMs?: number;
  scrollPercent?: number;
}

export interface EngagementSubmitResponse {
  attemptId: string;
  status: string;
  isCorrect?: boolean | null;
  pointsAwarded: number;
  isLate: boolean;
  isVerified: boolean;
  isRevealed: boolean;
  correctOptionId?: string | null;
  explanation?: string | null;
  newTotalPoints: number;
  /** Answer accepted, but correctness is being held back until the reveal. */
  resultPending?: boolean | null;
}

const EMPTY_FEED: EngagementFeed = {
  items: [],
  upcoming: [],
  totalToday: 0,
  completedToday: 0,
  capApplied: false,
  revealed: [],
  streakDays: 0,
};

/** Today's tasks across every batch. Returns an empty feed on any failure. */
export async function fetchEngagementFeed(): Promise<EngagementFeed> {
  try {
    const instituteId = await getInstituteId();
    if (!instituteId) return EMPTY_FEED;
    const { data } = await authenticatedAxiosInstance.get(
      `${BASE_URL}/admin-core-service/engagement/learner/v1/feed`,
      { params: { instituteId } }
    );
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      upcoming: Array.isArray(data?.upcoming) ? data.upcoming : [],
      totalToday: data?.totalToday ?? 0,
      completedToday: data?.completedToday ?? 0,
      capApplied: Boolean(data?.capApplied),
      revealed: Array.isArray(data?.revealed) ? data.revealed : [],
      streakDays: Number(data?.streakDays ?? 0),
    };
  } catch (error) {
    console.error("[engagement] feed fetch failed:", error);
    return EMPTY_FEED;
  }
}

/** Past tasks over the last `days` days. Throws; the page shows its own error state. */
export async function fetchEngagementHistory(days = 30): Promise<EngagementHistory> {
  const instituteId = await getInstituteId();
  const { data } = await authenticatedAxiosInstance.get(
    `${BASE_URL}/admin-core-service/engagement/learner/v1/history`,
    { params: { instituteId, days } }
  );
  return {
    from: String(data?.from ?? ""),
    to: String(data?.to ?? ""),
    items: Array.isArray(data?.items) ? data.items : [],
    done: Number(data?.done ?? 0),
    missed: Number(data?.missed ?? 0),
    catchUp: Number(data?.catchUp ?? 0),
    pointsEarned: Number(data?.pointsEarned ?? 0),
  };
}

/** Full payload for one task. Throws so the UI can show the server's reason. */
export async function fetchEngagementItem(itemId: string): Promise<EngagementItem> {
  const instituteId = await getInstituteId();
  const { data } = await authenticatedAxiosInstance.get(
    `${BASE_URL}/admin-core-service/engagement/learner/v1/item/${itemId}`,
    { params: { instituteId } }
  );
  return data as EngagementItem;
}

/** Complete a task. The server grades it, clamps any score and awards the points. */
export async function submitEngagementItem(
  itemId: string,
  request: EngagementSubmitRequest
): Promise<EngagementSubmitResponse> {
  const instituteId = await getInstituteId();
  const { data } = await authenticatedAxiosInstance.post(
    `${BASE_URL}/admin-core-service/engagement/learner/v1/item/${itemId}/submit`,
    request,
    { params: { instituteId } }
  );
  return data as EngagementSubmitResponse;
}

/** Parse an item's payload, tolerating the server having withheld or redacted it. */
export function parseQuestionPayload(
  item: EngagementItem
): EngagementQuestionPayload | null {
  if (!item.payloadJson) return null;
  try {
    return JSON.parse(item.payloadJson) as EngagementQuestionPayload;
  } catch {
    return null;
  }
}
