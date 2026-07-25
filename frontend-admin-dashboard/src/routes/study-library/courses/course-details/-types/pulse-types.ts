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
