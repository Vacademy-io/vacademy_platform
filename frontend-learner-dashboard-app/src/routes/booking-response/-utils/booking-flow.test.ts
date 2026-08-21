import { describe, expect, it } from "vitest";
import { buildBookPayload, shouldSkipDetails } from "./booking-flow";

describe("booking flow", () => {
    describe("shouldSkipDetails", () => {
        it("books straight from the slot when the learner is signed in and nothing is asked", () => {
            expect(shouldSkipDetails(true, 0)).toBe(true);
        });

        it("still shows the step when the page has its own questions", () => {
            expect(shouldSkipDetails(true, 1)).toBe(false);
        });

        it("always asks on a public link, where the form is the only identity", () => {
            expect(shouldSkipDetails(false, 0)).toBe(false);
            expect(shouldSkipDetails(false, 3)).toBe(false);
        });
    });

    describe("buildBookPayload", () => {
        const base = { startTime: "2026-09-01T10:00:00+05:30", inviteeTimezone: "Asia/Kolkata" };

        it("omits identity entirely when the learner is signed in", () => {
            const payload = buildBookPayload({ identity: {}, ...base });
            expect(payload).not.toHaveProperty("name");
            expect(payload).not.toHaveProperty("email");
            expect(payload).not.toHaveProperty("phone");
            expect(payload.start_time).toBe(base.startTime);
            expect(payload.invitee_timezone).toBe("Asia/Kolkata");
        });

        it("omits rather than blanks an empty field, so the server falls back to the account", () => {
            const payload = buildBookPayload({
                identity: { name: "Ravi", email: "", phone: "   " },
                ...base,
            });
            expect(payload.name).toBe("Ravi");
            expect(payload).not.toHaveProperty("email");
            expect(payload).not.toHaveProperty("phone");
        });

        it("carries the full identity a public booking supplies", () => {
            const payload = buildBookPayload({
                identity: { name: " Ravi Kumar ", email: "ravi@example.com", phone: "9998887776" },
                ...base,
            });
            expect(payload.name).toBe("Ravi Kumar");
            expect(payload.email).toBe("ravi@example.com");
            expect(payload.phone).toBe("9998887776");
        });

        it("leaves custom fields out when there are none, rather than sending an empty map", () => {
            expect(buildBookPayload({ identity: {}, customFieldValues: {}, ...base }))
                .not.toHaveProperty("custom_field_values");
        });

        it("includes custom field answers when there are any", () => {
            const payload = buildBookPayload({
                identity: {},
                customFieldValues: { goal: "Board revision" },
                ...base,
            });
            expect(payload.custom_field_values).toEqual({ goal: "Board revision" });
        });

        it("only sends a duration when a session type was chosen", () => {
            expect(buildBookPayload({ identity: {}, ...base })).not.toHaveProperty("duration_minutes");
            expect(buildBookPayload({ identity: {}, durationMinutes: 45, ...base }).duration_minutes)
                .toBe(45);
        });
    });
});
