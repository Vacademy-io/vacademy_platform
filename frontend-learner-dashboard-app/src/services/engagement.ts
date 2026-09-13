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
  | "POLL";

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

  attemptStatus?: string | null;
  isCorrect?: boolean | null;
  pointsAwarded?: number | null;

  completedCount?: number | null;
}

export interface EngagementFeed {
  items: EngagementItem[];
  upcoming: EngagementItem[];
  totalToday: number;
  completedToday: number;
  capApplied: boolean;
}

/** Options as authored by the teacher. `correctOptionId` only arrives after reveal. */
export interface EngagementQuestionPayload {
  options?: { id: string; text: string }[];
  correctOptionId?: string;
  explanation?: string;
  prompt?: string;
}

export interface EngagementSubmitRequest {
  selectedOptionId?: string;
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
}

const EMPTY_FEED: EngagementFeed = {
  items: [],
  upcoming: [],
  totalToday: 0,
  completedToday: 0,
  capApplied: false,
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
    };
  } catch (error) {
    console.error("[engagement] feed fetch failed:", error);
    return EMPTY_FEED;
  }
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
