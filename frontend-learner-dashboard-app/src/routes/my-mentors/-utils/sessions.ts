import type { MyMentorSession } from "../-services/my-mentors-service";

/** Lifecycles that mean the session is still ahead of the learner. */
const LIVE_LIFECYCLES = new Set(["UPCOMING"]);

/**
 * Split the learner's sessions into what they can still act on and what has already
 * happened. Upcoming runs soonest-first (the next thing is the thing you care about);
 * past runs newest-first (recent history first).
 *
 * A cancelled or rescheduled session is history even if its clock time is in the
 * future — offering "Reschedule" on a booking that no longer exists is worse than
 * not showing it at all.
 */
export function splitSessions(sessions: MyMentorSession[]): {
    upcoming: MyMentorSession[];
    past: MyMentorSession[];
} {
    const upcoming = sessions
        .filter((s) => LIVE_LIFECYCLES.has(s.lifecycle))
        .sort((a, b) => (a.scheduled_start_utc ?? 0) - (b.scheduled_start_utc ?? 0));
    const past = sessions
        .filter((s) => !LIVE_LIFECYCLES.has(s.lifecycle))
        .sort((a, b) => (b.scheduled_start_utc ?? 0) - (a.scheduled_start_utc ?? 0));
    return { upcoming, past };
}

/** Learner-facing wording for a session's state. */
export function sessionStatusLabel(lifecycle: string): string {
    switch (lifecycle) {
        case "UPCOMING":
            return "Upcoming";
        case "AWAITING_REVIEW":
            return "Waiting on your mentor";
        case "COMPLETED":
            return "Completed";
        case "NO_SHOW":
            return "Marked as missed";
        case "CANCELLED":
            return "Cancelled";
        case "RESCHEDULED":
            return "Moved";
        default:
            return lifecycle;
    }
}

/**
 * Whether the learner may still cancel or move this session.
 *
 * Only future, live bookings — the server enforces the same rule, so this is purely
 * about not offering an action that will be refused.
 */
export function isManageable(session: MyMentorSession, now: number = Date.now()): boolean {
    if (session.lifecycle !== "UPCOMING") return false;
    return (session.scheduled_start_utc ?? 0) > now;
}

/** "Thu 14 Aug, 2:30 PM" — one line, no seconds, no ambiguous numeric dates. */
export function sessionWhen(epochMillis?: number | null): string {
    if (!epochMillis) return "—";
    const d = new Date(epochMillis);
    if (Number.isNaN(d.getTime())) return "—";
    const sameYear = d.getFullYear() === new Date().getFullYear();
    const date = d.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        ...(sameYear ? {} : { year: "numeric" }),
    });
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${date}, ${time}`;
}
