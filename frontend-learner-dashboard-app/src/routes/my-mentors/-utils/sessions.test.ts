import { describe, expect, it } from "vitest";
import {
    isManageable,
    sessionStatusLabel,
    sessionWhen,
    splitSessions,
} from "./sessions";
import type { MyMentorSession } from "../-services/my-mentors-service";

const HOUR = 60 * 60 * 1000;

const session = (over: Partial<MyMentorSession> = {}): MyMentorSession => ({
    booking_instance_id: "b1",
    mentor_name: "Asha Nair",
    scheduled_start_utc: Date.now() + HOUR,
    lifecycle: "UPCOMING",
    ...over,
});

/**
 * What the learner may act on. The rule that matters: a cancelled session is history
 * even when its clock time is still ahead — offering "Reschedule" on a booking that no
 * longer exists sends the learner into an error they can't do anything about.
 */
describe("learner session lists", () => {
    describe("splitSessions", () => {
        it("puts live future sessions in upcoming, soonest first", () => {
            const later = session({ booking_instance_id: "later", scheduled_start_utc: Date.now() + 5 * HOUR });
            const sooner = session({ booking_instance_id: "sooner", scheduled_start_utc: Date.now() + HOUR });
            const { upcoming } = splitSessions([later, sooner]);
            expect(upcoming.map((s) => s.booking_instance_id)).toEqual(["sooner", "later"]);
        });

        it("orders past sessions newest first", () => {
            const old = session({
                booking_instance_id: "old",
                lifecycle: "COMPLETED",
                scheduled_start_utc: Date.now() - 10 * HOUR,
            });
            const recent = session({
                booking_instance_id: "recent",
                lifecycle: "COMPLETED",
                scheduled_start_utc: Date.now() - HOUR,
            });
            const { past } = splitSessions([old, recent]);
            expect(past.map((s) => s.booking_instance_id)).toEqual(["recent", "old"]);
        });

        it("files a cancelled session under past even though its time is in the future", () => {
            const cancelled = session({ lifecycle: "CANCELLED", scheduled_start_utc: Date.now() + 5 * HOUR });
            const { upcoming, past } = splitSessions([cancelled]);
            expect(upcoming).toHaveLength(0);
            expect(past).toHaveLength(1);
        });

        it.each(["AWAITING_REVIEW", "COMPLETED", "NO_SHOW", "RESCHEDULED"])(
            "treats %s as history, not something still to attend",
            (lifecycle) => {
                const { upcoming } = splitSessions([session({ lifecycle })]);
                expect(upcoming).toHaveLength(0);
            },
        );

        it("handles an empty list", () => {
            expect(splitSessions([])).toEqual({ upcoming: [], past: [] });
        });
    });

    describe("isManageable", () => {
        const now = Date.now();

        it("allows cancel/reschedule on a live future session", () => {
            expect(isManageable(session({ scheduled_start_utc: now + HOUR }), now)).toBe(true);
        });

        it("refuses a session that has already started", () => {
            expect(isManageable(session({ scheduled_start_utc: now - 1 }), now)).toBe(false);
        });

        it("refuses an already-cancelled session", () => {
            expect(
                isManageable(session({ lifecycle: "CANCELLED", scheduled_start_utc: now + HOUR }), now),
            ).toBe(false);
        });

        it("refuses a session with no start time rather than guessing", () => {
            expect(isManageable(session({ scheduled_start_utc: null }), now)).toBe(false);
        });
    });

    describe("sessionStatusLabel", () => {
        it("says who a past-but-unreviewed session is waiting on", () => {
            expect(sessionStatusLabel("AWAITING_REVIEW")).toBe("Waiting on your mentor");
        });

        it("passes an unknown lifecycle through instead of blanking the badge", () => {
            expect(sessionStatusLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
        });
    });

    describe("sessionWhen", () => {
        it("renders a weekday, date and time without seconds", () => {
            const out = sessionWhen(new Date(2026, 7, 14, 14, 30).getTime());
            expect(out).toMatch(/Aug/);
            expect(out).toMatch(/14/);
            expect(out).not.toMatch(/:\d{2}:\d{2}/);
        });

        it("shows an em dash rather than 'Invalid Date' for a missing time", () => {
            expect(sessionWhen(null)).toBe("—");
            expect(sessionWhen(undefined)).toBe("—");
        });
    });
});
