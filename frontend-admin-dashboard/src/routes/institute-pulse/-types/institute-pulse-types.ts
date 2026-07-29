// Institute Pulse — institute-wide live view. Types mirror the backend DTOs in
// admin_core_service/features/institute_pulse/dto and
// assessment_service/features/institute_pulse/dto.

export type PulseState = 'NEEDS_HELP' | 'ACTIVE' | 'IDLE';

// ---- Summary (presence) ----

export interface InstitutePulseCounts {
    active: number;
    idle: number;
    offline: number;
    needHelp: number;
    enrolled: number;
}

export interface InstituteRosterRow {
    userId: string;
    fullName: string | null;
    slideId: string;
    slideTitle: string | null;
    slideType: string;
    /** Server-computed seconds on the current slide; the client ticks this up between polls. */
    onSlideSeconds: number;
    state: PulseState;
}

export interface InstitutePulseSummaryResponse {
    /** Institute-wide window aggregates, NOT page sums — correct on any page. */
    counts: InstitutePulseCounts;
    roster: InstituteRosterRow[];
    returned: number;
    totalPresent: number;
    /** 0-based roster page. */
    page: number;
    /** More present learners exist beyond this page. */
    hasMore: boolean;
}

// ---- Content map (course → subject → module → chapter → slide) ----

export interface ContentMapSlideNode {
    id: string;
    title: string | null;
    slideType: string;
    headsNow: number;
    avgOnSlideSeconds: number;
}

export interface ContentMapChapterNode {
    id: string;
    name: string | null;
    headsNow: number;
    slides: ContentMapSlideNode[];
}

export interface ContentMapModuleNode {
    id: string;
    name: string | null;
    headsNow: number;
    chapters: ContentMapChapterNode[];
}

export interface ContentMapSubjectNode {
    id: string;
    name: string | null;
    headsNow: number;
    modules: ContentMapModuleNode[];
}

export interface ContentMapCourseNode {
    id: string;
    name: string | null;
    headsNow: number;
    subjects: ContentMapSubjectNode[];
}

export interface InstituteContentMapResponse {
    courses: ContentMapCourseNode[];
    totalHeads: number;
}

// ---- Live classes ----

export interface LiveClassCard {
    sessionId: string;
    scheduleId: string;
    title: string | null;
    subject: string | null;
    startEpoch: number | null;
    endEpoch: number | null;
    provider: string | null;
    invited: number;
    /**
     * Distinct learners who joined at ANY point — not current occupancy. Provider leave events
     * are discarded server-side, so "in the room now" is not knowable. Label accordingly.
     */
    joined: number;
    absent: number;
    turnoutPercent: number;
    /** False when the scheduled window is open but nobody has turned up yet. */
    started: boolean;
    /**
     * Past its scheduled last-entry time but still shown. `last_entry_time` is a last-ENTRY
     * cutoff, not an end time, and the schema has no real end time — so classes that run long
     * stay on air for a grace period rather than vanishing mid-lesson.
     */
    runningOver: boolean;
    /**
     * Live occupancy from the provider — who is in the room RIGHT NOW. Null when the provider
     * hasn't reported this meeting (non-BBB, or the poller has no data yet); the UI must not
     * claim to know occupancy in that case.
     */
    inRoomNow: number | null;
    /** Provider reports this meeting as actually running. */
    providerLive: boolean;
    /**
     * True for providers whose attendance arrives via a post-hoc sync (Zoom/Google) rather than
     * at join time. Counts are as-of `lastSyncEpoch`, not live.
     */
    attendanceSynced: boolean;
    lastSyncEpoch: number | null;
}

export interface InstituteLiveClassesResponse {
    onAir: LiveClassCard[];
    upcoming: LiveClassCard[];
    /** Institute-wide counts, NOT the size of the returned page. */
    onAirCount: number;
    upcomingCount: number;
    onAirHasMore: boolean;
    upcomingHasMore: boolean;
    invitedNow: number;
    joinedNow: number;
}

// ---- Assessments (served by assessment_service) ----

export interface AssessmentFunnel {
    assessmentId: string;
    assessmentName: string | null;
    startEpoch: number | null;
    endEpoch: number | null;
    enrolled: number;
    notStarted: number;
    inPreview: number;
    inProgress: number;
    submitted: number;
}

/**
 * Institute-wide, NOT page-scoped. Deliberately only two numbers — enrolled/submitted totals
 * would require aggregating every registration across every live assessment, which is exactly
 * what pagination avoids.
 */
export interface AssessmentTotals {
    liveAssessments: number;
    inProgress: number;
}

export type AttemptRiskReason = 'OVERRUN' | 'AUTO_SUBMIT_SOON' | 'STALLED';

export interface AttemptRisk {
    attemptId: string;
    assessmentId: string;
    assessmentName: string | null;
    userId: string;
    participantName: string | null;
    secondsSinceSync: number | null;
    secondsRemaining: number | null;
    reasons: AttemptRiskReason[];
    primaryReason: AttemptRiskReason | null;
}

export interface RecentSubmission {
    attemptId: string;
    assessmentId: string;
    assessmentName: string | null;
    userId: string;
    participantName: string | null;
    submittedAtEpoch: number | null;
}

export interface EvaluationPipelineRow {
    assessmentId: string;
    assessmentName: string | null;
    endedAtEpoch: number | null;
    /** Submitted attempts. awaiting + evaluating + evaluated + failed sums to this. */
    submitted: number;
    awaiting: number;
    evaluating: number;
    evaluated: number;
    failed: number;
    /** Subset of evaluated, NOT a further disjoint stage. */
    released: number;
}

export interface InstituteAssessmentsResponse {
    assessments: AssessmentFunnel[];
    totals: AssessmentTotals;
    risks: AttemptRisk[];
    /** 0-based index of the assessment page in `assessments`. */
    page: number;
    /** More live assessments exist beyond this page. */
    hasMore: boolean;
    returnedRisks: number;
    riskCapped: boolean;
    /**
     * Standalone assessment submissions inside the feed window. Merged into the live feed
     * client-side — the admin_core feed cannot see these, since assessments live in a different
     * service and database.
     */
    recentSubmissions: RecentSubmission[];
    /**
     * Assessments that ENDED recently and where their results have got to. Scoped backwards in
     * time, unlike the live funnel — evaluation only starts once a window closes.
     */
    evaluationPipeline: EvaluationPipelineRow[];
    /** Results pipeline hit its cap — it is capped, not paged. */
    evaluationCapped: boolean;
}

// ---- Live feed ----

export type FeedRail = 'CONTENT' | 'LIVE_CLASS' | 'ASSESSMENT';

export type InstituteFeedEventType =
    | 'SUBMITTED_ASSIGNMENT'
    | 'SUBMITTED_ASSESSMENT'
    | 'CODE_SUBMISSION'
    | 'ANSWERED_QUESTION'
    | 'ANSWERED_QUIZ'
    | 'JOINED_CLASS'
    | 'SUBMITTED_ASSESSMENT_ATTEMPT'
    | 'JOINED_ROOM'
    | 'LEFT_ROOM';

export interface InstituteFeedEvent {
    occurredAtEpoch: number;
    userId: string;
    fullName: string | null;
    slideId: string | null;
    slideTitle: string | null;
    slideType: string | null;
    rail: FeedRail;
    eventType: InstituteFeedEventType;
    detail: string | null;
    /** 'HOST' when the actor was hosting the class, else null. */
    actorRole: string | null;
}

export interface InstitutePulseFeedResponse {
    events: InstituteFeedEvent[];
    windowMinutes: number;
    /** More events exist in the window than were returned. */
    hasMore: boolean;
}
