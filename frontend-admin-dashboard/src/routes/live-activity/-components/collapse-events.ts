import type { LiveActivityEvent } from '../-services/live-activity-service';

export interface CollapsedActivity {
    /** The newest event in the group -- what the row renders as its current state. */
    latest: LiveActivityEvent;
    /** Every event in the group, newest first. Length 1 means nothing was collapsed. */
    transitions: LiveActivityEvent[];
    key: string;
}

/**
 * Collapse a call's transitions into one row.
 *
 * <p>A single call emits QUEUED, RINGING, CONNECTED and ENDED, so a busy afternoon would
 * otherwise produce four or five rows per call and the feed becomes unreadable. Every
 * transition is still stored server-side -- the table is the audit trail and the history
 * view shows them all -- but the live list shows one row per call that updates in place and
 * settles at "ended". This mirrors the single-in-place-toast behaviour the per-call
 * telephony stream already uses.
 *
 * <p>Only CALL collapses. Payments, leads and enrolments are discrete moments where two
 * events for the same entity genuinely mean two different things (reached payment, then
 * paid), and folding those together would hide the funnel rather than tidy it.
 */
export function collapseEvents(events: LiveActivityEvent[]): CollapsedActivity[] {
    const out: CollapsedActivity[] = [];
    const callGroupIndex = new Map<string, number>();

    for (const event of events) {
        const collapsible = event.category === 'CALL' && !!event.entityId;

        if (!collapsible) {
            out.push({ latest: event, transitions: [event], key: event.eventId });
            continue;
        }

        const groupKey = `CALL:${event.entityId}`;
        const existing = callGroupIndex.get(groupKey);

        if (existing === undefined) {
            callGroupIndex.set(groupKey, out.length);
            out.push({ latest: event, transitions: [event], key: groupKey });
            continue;
        }

        const group = out[existing];
        if (!group) continue;

        group.transitions.push(event);
        // The list arrives newest-first, so the first event seen for a call is already the
        // latest. Guard on the timestamp anyway rather than assuming order, because a
        // replayed batch after a reconnect can merge in out of order.
        if (event.occurredAtEpochMillis > group.latest.occurredAtEpochMillis) {
            group.latest = event;
        }
    }

    return out;
}
