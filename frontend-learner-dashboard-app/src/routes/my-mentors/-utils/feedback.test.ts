import { describe, expect, it } from "vitest";
import { formatRating, nextSessionToRate, RATING_LABELS } from "./feedback";
import type { PendingFeedback } from "../-services/my-mentors-service";

const session = (id: string, startUtc: number | null): PendingFeedback => ({
    booking_instance_id: id,
    mentor_id: "m1",
    mentor_name: "Asha",
    session_start_utc: startUtc,
});

describe("nextSessionToRate", () => {
    it("returns nothing when there is nothing to rate", () => {
        expect(nextSessionToRate([])).toBeUndefined();
    });

    it("prompts for the most recent session, the one a learner can still remember", () => {
        const picked = nextSessionToRate([
            session("old", 1_000),
            session("newest", 9_000),
            session("mid", 5_000),
        ]);
        expect(picked?.booking_instance_id).toBe("newest");
    });

    it("does not mutate the caller's list", () => {
        const list = [session("a", 1_000), session("b", 9_000)];
        nextSessionToRate(list);
        expect(list.map((s) => s.booking_instance_id)).toEqual(["a", "b"]);
    });

    it("treats a missing start time as oldest rather than crashing", () => {
        const picked = nextSessionToRate([session("nodate", null), session("dated", 5_000)]);
        expect(picked?.booking_instance_id).toBe("dated");
    });

    it("returns the single session when only one is outstanding", () => {
        expect(nextSessionToRate([session("only", 42)])?.booking_instance_id).toBe("only");
    });
});

describe("formatRating", () => {
    it("shows one decimal, matching what the API rounds to", () => {
        expect(formatRating(4.6)).toBe("4.6");
        expect(formatRating(5)).toBe("5.0");
    });

    it("renders an em dash for an unrated mentor instead of 0", () => {
        expect(formatRating(null)).toBe("—");
        expect(formatRating(undefined)).toBe("—");
        expect(formatRating(Number.NaN)).toBe("—");
    });
});

describe("RATING_LABELS", () => {
    it("labels every star value, so no rating renders without wording", () => {
        for (const star of [1, 2, 3, 4, 5]) {
            expect(RATING_LABELS[star]).toBeTruthy();
        }
    });
});
