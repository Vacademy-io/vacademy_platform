import type { DirectoryMentor, MyMentorRequest } from "../-services/my-mentors-service";

/**
 * What a directory card can offer the learner right now. Kept out of the card
 * component so the precedence is testable and stated once: an existing pairing
 * beats a pending request, which beats capacity, which beats "you can ask".
 */
export type MentorCta = "ALREADY_MENTOR" | "REQUEST_PENDING" | "FULL" | "REQUESTABLE";

export function mentorCta(mentor: DirectoryMentor): MentorCta {
    if (mentor.already_mentor) return "ALREADY_MENTOR";
    if (mentor.request_status === "PENDING") return "REQUEST_PENDING";
    if (mentor.at_capacity) return "FULL";
    return "REQUESTABLE";
}

/**
 * Directory search. Matches name, title, bio and expertise tags so a learner can
 * type what they need ("physics") rather than having to know a mentor's name.
 * An empty query returns the list untouched.
 */
export function filterDirectory(mentors: DirectoryMentor[], query: string): DirectoryMentor[] {
    const q = query.trim().toLowerCase();
    if (!q) return mentors;
    return mentors.filter((m) =>
        [m.name, m.title, m.bio, ...(m.expertise_tags ?? [])].some((field) =>
            (field ?? "").toLowerCase().includes(q),
        ),
    );
}

/** Learner-facing wording for a request's state. */
export function requestStatusLabel(status: string): string {
    switch (status) {
        case "PENDING":
            return "Awaiting approval";
        case "APPROVED":
            return "Approved";
        case "DECLINED":
            return "Not approved";
        case "CANCELLED":
            return "Withdrawn";
        default:
            return status;
    }
}

/** Requests the learner can still withdraw. */
export function isWithdrawable(request: MyMentorRequest): boolean {
    return request.status === "PENDING";
}
