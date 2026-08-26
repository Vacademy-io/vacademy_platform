import { describe, expect, it } from "vitest";
import {
    filterDirectory,
    isWithdrawable,
    mentorCta,
    requestStatusLabel,
} from "./directory";
import type { DirectoryMentor, MyMentorRequest } from "../-services/my-mentors-service";

const mentor = (over: Partial<DirectoryMentor> = {}): DirectoryMentor => ({
    id: "m1",
    name: "Asha Nair",
    title: "Senior Physics Mentor",
    bio: "Helps students crack mechanics.",
    expertise_tags: ["JEE Physics", "Career guidance"],
    ...over,
});

describe("mentorCta", () => {
    it("offers a request when the mentor is free and unasked", () => {
        expect(mentorCta(mentor())).toBe("REQUESTABLE");
    });

    it("an existing pairing outranks everything else", () => {
        expect(
            mentorCta(mentor({ already_mentor: true, request_status: "PENDING", at_capacity: true })),
        ).toBe("ALREADY_MENTOR");
    });

    it("a pending request outranks capacity, so the learner isn't told to re-ask", () => {
        expect(mentorCta(mentor({ request_status: "PENDING", at_capacity: true }))).toBe(
            "REQUEST_PENDING",
        );
    });

    it("a full mentor can't be requested", () => {
        expect(mentorCta(mentor({ at_capacity: true }))).toBe("FULL");
    });

    it("a previously declined request does not block asking again", () => {
        expect(mentorCta(mentor({ request_status: "DECLINED" }))).toBe("REQUESTABLE");
    });

    it("a withdrawn request does not block asking again", () => {
        expect(mentorCta(mentor({ request_status: "CANCELLED" }))).toBe("REQUESTABLE");
    });
});

describe("filterDirectory", () => {
    const list = [
        mentor(),
        mentor({ id: "m2", name: "Bhavya Rao", title: "Biology Mentor", bio: "NEET coach", expertise_tags: ["Biology"] }),
    ];

    it("returns everything for an empty or whitespace query", () => {
        expect(filterDirectory(list, "")).toHaveLength(2);
        expect(filterDirectory(list, "   ")).toHaveLength(2);
    });

    it("matches an expertise tag, which is how learners actually search", () => {
        expect(filterDirectory(list, "physics").map((m) => m.id)).toEqual(["m1"]);
    });

    it("is case-insensitive and matches partial words", () => {
        expect(filterDirectory(list, "BIOL").map((m) => m.id)).toEqual(["m2"]);
    });

    it("matches the bio too", () => {
        expect(filterDirectory(list, "neet").map((m) => m.id)).toEqual(["m2"]);
    });

    it("returns nothing when there is no match", () => {
        expect(filterDirectory(list, "chemistry")).toEqual([]);
    });

    it("tolerates mentors with no tags or bio", () => {
        const sparse = [mentor({ id: "m3", name: "Chetan", title: null, bio: null, expertise_tags: null })];
        expect(filterDirectory(sparse, "chetan").map((m) => m.id)).toEqual(["m3"]);
        expect(filterDirectory(sparse, "physics")).toEqual([]);
    });
});

describe("request status", () => {
    it("uses learner-facing wording, not the raw enum", () => {
        expect(requestStatusLabel("PENDING")).toBe("Awaiting approval");
        expect(requestStatusLabel("DECLINED")).toBe("Not approved");
        expect(requestStatusLabel("CANCELLED")).toBe("Withdrawn");
    });

    it("falls back to the raw value for a status it doesn't know", () => {
        expect(requestStatusLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
    });

    it("only a pending request can be withdrawn", () => {
        const req = (status: string) => ({ id: "r", status }) as MyMentorRequest;
        expect(isWithdrawable(req("PENDING"))).toBe(true);
        expect(isWithdrawable(req("APPROVED"))).toBe(false);
        expect(isWithdrawable(req("DECLINED"))).toBe(false);
    });
});
