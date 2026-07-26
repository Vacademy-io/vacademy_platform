// Course Pulse — live teacher view. Types mirror the backend
// PulseSummaryResponse (admin_core_service/features/course_pulse/dto).

export type PulseState = 'NEEDS_HELP' | 'ACTIVE' | 'IDLE';

export interface PulseCounts {
    active: number;
    idle: number;
    offline: number;
    needHelp: number;
    enrolled: number;
}

export interface PulseRosterRow {
    userId: string;
    fullName: string | null;
    slideId: string;
    slideTitle: string | null;
    slideType: string;
    chapterId: string;
    /** Server-computed seconds on the current slide; the client ticks this up between polls. */
    onSlideSeconds: number;
    state: PulseState;
}

export interface PulseSummaryResponse {
    counts: PulseCounts;
    roster: PulseRosterRow[];
    returned: number;
    totalPresent: number;
}

// ---- Content Map (subject → module → chapter → slide tree of active branches) ----

export interface ContentMapSlideNode {
    id: string;
    title: string | null;
    slideType: string;
    headsNow: number;
    avgOnSlideSeconds: number;
    friction: boolean;
    baselineMedianSeconds: number | null;
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

export interface ContentMapResponse {
    subjects: ContentMapSubjectNode[];
    totalHeads: number;
}

// ---- Live Feed ----

export type PulseEventType =
    | 'SUBMITTED_ASSIGNMENT'
    | 'SUBMITTED_ASSESSMENT'
    | 'CODE_SUBMISSION'
    | 'ANSWERED_QUESTION'
    | 'ANSWERED_QUIZ';

export interface PulseFeedEvent {
    occurredAtEpoch: number;
    userId: string;
    fullName: string | null;
    slideId: string;
    slideTitle: string | null;
    slideType: string;
    eventType: PulseEventType;
    detail: string | null;
}

export interface PulseFeedResponse {
    events: PulseFeedEvent[];
    windowMinutes: number;
}
