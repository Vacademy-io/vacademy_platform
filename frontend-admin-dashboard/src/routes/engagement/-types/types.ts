/**
 * Daily engagement authoring types.
 * Backend: admin_core_service /engagement/admin/v1/**
 * Design doc: docs/engagement/DAILY_ENGAGEMENT_PLATFORM.md
 */

export type EngagementItemType =
    | 'READING_HTML'
    | 'VISUAL_NOTE'
    | 'QUESTION_OF_DAY'
    | 'QUIZ'
    | 'GAME'
    | 'POLL';

export type PlanStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'DELETED';

/** What happens to an item a learner never opened while it was live. */
export type MissPolicy = 'EXPIRES' | 'CATCH_UP_FULL' | 'CATCH_UP_REDUCED';

export interface EngagementItemRequest {
    id?: string;
    itemType: EngagementItemType;
    title: string;
    sortOrder?: number;
    isRequired?: boolean;
    contentHtml?: string;
    slideId?: string;
    questionId?: string;
    assessmentId?: string;
    /**
     * QUESTION_OF_DAY carries its options AND answer key here:
     * {"prompt":"…","options":[{"id":"a","text":"…"}],"correctOptionId":"a","explanation":"…"}
     * The key never reaches a learner — the server strips it until reveal time.
     */
    payloadJson?: string;
    completionPoints?: number;
    correctPoints?: number;
    maxScore?: number;
    missPolicy?: MissPolicy;
    catchUpDays?: number;
    catchUpPercent?: number;
}

export interface EngagementSlotRequest {
    id?: string;
    title?: string;
    /** yyyy-MM-dd, institute-local. */
    startDate: string;
    endDate?: string;
    /** HH:mm, institute-local wall clock. */
    startTime: string;
    endTime: string;
    /** Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64. Null/0 = every day. */
    dowMask?: number;
    revealTime?: string;
    notifyTime?: string;
    sortOrder?: number;
    items?: EngagementItemRequest[];
}

export interface EngagementPlanRequest {
    title: string;
    description?: string;
    packageSessionId?: string;
    /** Create the same plan for several batches; the server writes one plan per id. */
    packageSessionIds?: string[];
    subjectId?: string;
    status?: PlanStatus;
    defaultMissPolicy?: MissPolicy;
    defaultCatchUpDays?: number;
    defaultCatchUpPercent?: number;
    slots?: EngagementSlotRequest[];
}

export interface EngagementItemDTO {
    id: string;
    slotId: string;
    planId: string;
    packageSessionId: string;
    itemType: EngagementItemType;
    title: string;
    version: number;
    sortOrder: number;
    isRequired: boolean;
    contentHtml?: string | null;
    slideId?: string | null;
    questionId?: string | null;
    assessmentId?: string | null;
    payloadJson?: string | null;
    completionPoints: number;
    correctPoints: number;
    maxScore?: number | null;
    completedCount?: number | null;
}

export interface EngagementSlotDTO {
    id: string;
    planId: string;
    title?: string | null;
    startDate: string;
    endDate?: string | null;
    startTime: string;
    endTime: string;
    dowMask?: number | null;
    revealTime?: string | null;
    notifyTime?: string | null;
    sortOrder: number;
    status: string;
    items: EngagementItemDTO[];
}

export interface EngagementPlanDTO {
    id: string;
    instituteId: string;
    packageSessionId: string;
    title: string;
    description?: string | null;
    subjectId?: string | null;
    status: PlanStatus;
    /** Snapshot of the institute zone at creation — windows resolve against this. */
    timezone: string;
    defaultMissPolicy: MissPolicy;
    defaultCatchUpDays?: number | null;
    defaultCatchUpPercent?: number | null;
    createdByUserId: string;
    createdAt?: string | null;
    slots?: EngagementSlotDTO[];
}

export interface EngagementTrackingRow {
    userId: string;
    /** Hydrated from auth_service; null if that lookup failed. */
    fullName?: string | null;
    username?: string | null;
    email?: string | null;
    status: string;
    isCorrect?: boolean | null;
    score?: number | null;
    pointsAwarded: number;
    isLate: boolean;
    timeSpentMs?: number | null;
    completedAt?: string | null;
}

export interface EngagementTrackingDTO {
    itemId: string;
    title: string;
    itemType: EngagementItemType;
    completedCount: number;
    correctCount: number;
    rows: EngagementTrackingRow[];
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
}
