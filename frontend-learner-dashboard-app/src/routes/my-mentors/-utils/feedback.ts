import type { PendingFeedback } from "../-services/my-mentors-service";

/** Wording shown under the stars, so a rating means the same thing to everyone. */
export const RATING_LABELS: Record<number, string> = {
    1: "Not helpful",
    2: "Could be better",
    3: "Okay",
    4: "Helpful",
    5: "Excellent",
};

export const MAX_FEEDBACK_COMMENT = 2000;

/**
 * The session to prompt about when several are outstanding: the most recent one,
 * which is the one the learner can actually remember. The rest stay in the list
 * and surface as they become the newest unrated session.
 */
export function nextSessionToRate(pending: PendingFeedback[]): PendingFeedback | undefined {
    if (!pending.length) return undefined;
    return [...pending].sort((a, b) => (b.session_start_utc ?? 0) - (a.session_start_utc ?? 0))[0];
}

/** Human-readable rating, e.g. "4.6" — one decimal, matching what the API rounds to. */
export function formatRating(average: number | null | undefined): string {
    if (average == null || Number.isNaN(average)) return "—";
    return average.toFixed(1);
}
