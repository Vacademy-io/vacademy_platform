import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import {
    MEETINGS_BY_LEAD,
    MENTORSHIP_DIRECTORY,
    MENTORSHIP_MY_MENTORS,
    MENTORSHIP_MY_REQUESTS,
    MENTORSHIP_MY_FEEDBACK,
    MENTORSHIP_MY_PENDING_FEEDBACK,
    MENTORSHIP_MY_REQUEST_BY_ID,
    MENTORSHIP_MY_MENTOR_SESSIONS,
    MENTORSHIP_MY_MENTOR_SESSION_CANCEL,
    MENTORSHIP_MY_MENTOR_SESSION_RESCHEDULE,
} from "@/constants/urls";

// snake_case — mirrors admin-core-service MentorDTO.
export interface MyMentor {
    id: string;
    user_id: string;
    display_name?: string | null;
    title?: string | null;
    profile_image_file_id?: string | null;
    bio?: string | null;
    /** Topics this mentor covers — the same tags the Find-a-mentor directory shows. */
    expertise_tags?: string[] | null;
    booking_page_id?: string | null;
    booking_page_slug?: string | null;
    status: string;
    name?: string | null;
    email?: string | null;
    mobile_number?: string | null;
    profile_pic_file_id?: string | null;
}

export const getMyMentors = async ({
    instituteId,
}: {
    instituteId: string;
}): Promise<MyMentor[]> => {
    const response = await authenticatedAxiosInstance({
        method: "GET",
        url: MENTORSHIP_MY_MENTORS,
        params: { instituteId },
    });
    return response.data as MyMentor[];
};

export const handleGetMyMentors = (instituteId: string | undefined) => ({
    queryKey: ["GET_MY_MENTORS", instituteId],
    queryFn: () => getMyMentors({ instituteId: instituteId ?? "" }),
    staleTime: 60 * 1000,
    enabled: !!instituteId,
});

// A learner's own bookings (mentor sessions). snake_case — mirrors BookingInstanceDTO.
export interface MyBooking {
    id: string;
    booking_page_title?: string | null;
    host_user_id?: string | null;
    host_name?: string | null;
    invitee_user_id?: string | null;
    scheduled_start_utc?: string | number | null;
    scheduled_end_utc?: string | number | null;
    status: string;
    meet_link?: string | null;
}

export const getMyBookings = async ({
    instituteId,
    userId,
}: {
    instituteId: string;
    userId: string;
}): Promise<MyBooking[]> => {
    const response = await authenticatedAxiosInstance({
        method: "GET",
        url: MEETINGS_BY_LEAD,
        params: { instituteId, inviteeUserId: userId },
    });
    return (response.data ?? []) as MyBooking[];
};

export const handleGetMyBookings = (
    instituteId: string | undefined,
    userId: string | undefined
) => ({
    queryKey: ["GET_MY_BOOKINGS", instituteId, userId],
    queryFn: () => getMyBookings({ instituteId: instituteId ?? "", userId: userId ?? "" }),
    staleTime: 60 * 1000,
    enabled: !!instituteId && !!userId,
});

// ---------------------------------------------------------------- Find a mentor

/**
 * A mentor as the directory shows them. Deliberately narrower than the admin
 * MentorDTO — the API never sends a mentor's email or phone to a learner.
 */
export interface DirectoryMentor {
    id: string;
    name?: string | null;
    title?: string | null;
    bio?: string | null;
    profile_image_file_id?: string | null;
    expertise_tags?: string[] | null;
    /** True when the mentor has hit their mentee limit. */
    at_capacity?: boolean | null;
    available_slots?: number | null;
    /** True when this mentor already mentors the caller. */
    already_mentor?: boolean | null;
    /** The caller's own request against this mentor, if any. */
    request_status?: string | null;
    request_id?: string | null;
}

/** The caller's own mentor request. */
export interface MyMentorRequest {
    id: string;
    mentor_id?: string | null;
    message?: string | null;
    status: "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED" | string;
    decision_note?: string | null;
    created_at?: number | null;
    decided_at?: number | null;
    mentor_name?: string | null;
    mentor_title?: string | null;
    mentor_profile_image_file_id?: string | null;
    mentor_expertise_tags?: string[] | null;
}

export const getMentorDirectory = async ({
    instituteId,
    search,
}: {
    instituteId: string;
    search?: string;
}): Promise<DirectoryMentor[]> => {
    const response = await authenticatedAxiosInstance({
        method: "GET",
        url: MENTORSHIP_DIRECTORY,
        params: { instituteId, ...(search ? { search } : {}) },
    });
    return (response.data ?? []) as DirectoryMentor[];
};

/**
 * The directory rarely changes, so it is cached for a minute. Search is done
 * client-side off this one payload — an institute's mentor list is small, and
 * per-keystroke requests would be wasteful.
 */
export const handleGetMentorDirectory = (instituteId: string | undefined) => ({
    queryKey: ["GET_MENTOR_DIRECTORY", instituteId],
    queryFn: () => getMentorDirectory({ instituteId: instituteId ?? "" }),
    staleTime: 60 * 1000,
    enabled: !!instituteId,
});

export const requestMentor = async ({
    instituteId,
    mentorId,
    message,
}: {
    instituteId: string;
    mentorId?: string;
    message?: string;
}): Promise<MyMentorRequest> => {
    const response = await authenticatedAxiosInstance({
        method: "POST",
        url: MENTORSHIP_MY_REQUESTS,
        params: { instituteId },
        data: { mentor_id: mentorId, message },
    });
    return response.data as MyMentorRequest;
};

export const getMyMentorRequests = async ({
    instituteId,
}: {
    instituteId: string;
}): Promise<MyMentorRequest[]> => {
    const response = await authenticatedAxiosInstance({
        method: "GET",
        url: MENTORSHIP_MY_REQUESTS,
        params: { instituteId },
    });
    return (response.data ?? []) as MyMentorRequest[];
};

export const handleGetMyMentorRequests = (instituteId: string | undefined) => ({
    queryKey: ["GET_MY_MENTOR_REQUESTS", instituteId],
    queryFn: () => getMyMentorRequests({ instituteId: instituteId ?? "" }),
    staleTime: 30 * 1000,
    enabled: !!instituteId,
});

export const cancelMentorRequest = async ({
    instituteId,
    requestId,
}: {
    instituteId: string;
    requestId: string;
}): Promise<string> => {
    const response = await authenticatedAxiosInstance({
        method: "DELETE",
        url: MENTORSHIP_MY_REQUEST_BY_ID(requestId),
        params: { instituteId },
    });
    return response.data as string;
};

// ---------------------------------------------------------------- Session feedback

/** A finished mentor session the learner hasn't rated yet. */
export interface PendingFeedback {
    booking_instance_id: string;
    mentor_id: string;
    mentor_name?: string | null;
    mentor_profile_image_file_id?: string | null;
    session_title?: string | null;
    session_start_utc?: number | null;
}

/** A submitted rating. */
export interface SessionFeedback {
    id: string;
    booking_instance_id: string;
    mentor_id: string;
    mentor_name?: string | null;
    rating: number;
    comment?: string | null;
    created_at?: number | null;
}

export const getPendingFeedback = async ({
    instituteId,
}: {
    instituteId: string;
}): Promise<PendingFeedback[]> => {
    const response = await authenticatedAxiosInstance({
        method: "GET",
        url: MENTORSHIP_MY_PENDING_FEEDBACK,
        params: { instituteId },
    });
    return (response.data ?? []) as PendingFeedback[];
};

/**
 * Kept short-lived: the list changes the moment a session ends or gets rated, and
 * a stale prompt for an already-rated session is the one thing that would annoy.
 */
export const handleGetPendingFeedback = (instituteId: string | undefined) => ({
    queryKey: ["GET_PENDING_MENTOR_FEEDBACK", instituteId],
    queryFn: () => getPendingFeedback({ instituteId: instituteId ?? "" }),
    staleTime: 30 * 1000,
    enabled: !!instituteId,
});

export const submitSessionFeedback = async ({
    instituteId,
    bookingInstanceId,
    rating,
    comment,
}: {
    instituteId: string;
    bookingInstanceId: string;
    rating: number;
    comment?: string;
}): Promise<SessionFeedback> => {
    const response = await authenticatedAxiosInstance({
        method: "POST",
        url: MENTORSHIP_MY_FEEDBACK,
        params: { instituteId },
        data: { booking_instance_id: bookingInstanceId, rating, comment },
    });
    return response.data as SessionFeedback;
};

// ---------------------------------------------------------------- My 1:1 sessions

/**
 * One of the learner's own mentor sessions. Mirrors the admin MentorSessionDTO minus
 * the mentor's private notes, which the API strips before a learner ever sees it.
 */
export interface MyMentorSession {
    booking_instance_id: string;
    title?: string | null;
    scheduled_start_utc?: number | null;
    scheduled_end_utc?: number | null;
    duration_minutes?: number | null;
    booking_status?: string | null;
    meet_link?: string | null;
    mentor_id?: string | null;
    mentor_name?: string | null;
    topic?: string | null;
    rating?: number | null;
    feedback_comment?: string | null;
    /** UPCOMING | AWAITING_REVIEW | COMPLETED | NO_SHOW | CANCELLED | RESCHEDULED */
    lifecycle: string;
}

export const getMyMentorSessions = async ({
    instituteId,
}: {
    instituteId: string;
}): Promise<MyMentorSession[]> => {
    const response = await authenticatedAxiosInstance({
        method: "GET",
        url: MENTORSHIP_MY_MENTOR_SESSIONS,
        params: { instituteId },
    });
    return (response.data ?? []) as MyMentorSession[];
};

/**
 * Kept short-lived: this list is what the learner acts on, and a stale row offering
 * "Reschedule" on a session the mentor just cancelled is the worst kind of wrong.
 */
export const handleGetMyMentorSessions = (instituteId: string | undefined) => ({
    queryKey: ["GET_MY_MENTOR_SESSIONS", instituteId],
    queryFn: () => getMyMentorSessions({ instituteId: instituteId ?? "" }),
    staleTime: 15 * 1000,
    enabled: !!instituteId,
});

export const cancelMyMentorSession = async ({
    instituteId,
    bookingInstanceId,
    reason,
}: {
    instituteId: string;
    bookingInstanceId: string;
    reason?: string;
}): Promise<MyMentorSession> => {
    const response = await authenticatedAxiosInstance({
        method: "POST",
        url: MENTORSHIP_MY_MENTOR_SESSION_CANCEL,
        params: { instituteId },
        data: { booking_instance_id: bookingInstanceId, reason },
    });
    return response.data as MyMentorSession;
};

export const rescheduleMyMentorSession = async ({
    instituteId,
    bookingInstanceId,
    startTime,
    inviteeTimezone,
}: {
    instituteId: string;
    bookingInstanceId: string;
    startTime: string;
    inviteeTimezone?: string;
}): Promise<MyMentorSession> => {
    const response = await authenticatedAxiosInstance({
        method: "POST",
        url: MENTORSHIP_MY_MENTOR_SESSION_RESCHEDULE,
        params: { instituteId },
        data: {
            booking_instance_id: bookingInstanceId,
            start_time: startTime,
            ...(inviteeTimezone ? { invitee_timezone: inviteeTimezone } : {}),
        },
    });
    return response.data as MyMentorSession;
};
