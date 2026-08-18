import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    CREATE_TIMELINE_EVENT,
    GET_CROSS_STAGE_TIMELINE,
    GET_STUDENTS,
    MEETINGS_BY_LEAD,
    MENTORSHIP_ASSIGNMENTS,
    MENTORSHIP_ASSIGNMENTS_BULK,
    MENTORSHIP_ASSIGNMENT_BY_ID,
    MENTORSHIP_DASHBOARD,
    MENTORSHIP_MENTORS,
    MENTORSHIP_MENTOR_BOOKING_PAGE,
    MEETINGS_MY_CALENDAR,
    MENTORSHIP_MENTOR_BY_ID,
    MENTORSHIP_MY_BOOKING_PAGE,
    MENTORSHIP_MY_GOOGLE_INITIATE,
    MENTORSHIP_MY_MENTEES,
    MENTORSHIP_MY_MENTOR_PROFILE,
    MENTORSHIP_REQUESTS,
    MENTORSHIP_REQUEST_APPROVE,
    MENTORSHIP_REQUEST_DECLINE,
    MENTORSHIP_MENTOR_FEEDBACK,
} from '@/constants/urls';
import type {
    AssignMentorRequest,
    AssignmentResult,
    BookingInstance,
    BulkRoundRobinRequest,
    CreateMentorRequest,
    CreateNoteRequest,
    MenteeDTO,
    MentorAvailabilityRequest,
    MentorBookingPage,
    MentorDTO,
    MentorDashboard,
    MentorFeedbackDTO,
    MentorRequestDTO,
    MentorRequestDecision,
    PageResponse,
    StudentRow,
    TimelineEvent,
    UpdateMentorRequest,
} from '../-types/mentorship-types';

export const fetchMentors = async (instituteId: string): Promise<MentorDTO[]> => {
    const res = await authenticatedAxiosInstance({
        method: 'GET',
        url: MENTORSHIP_MENTORS,
        params: { instituteId },
    });
    return res.data as MentorDTO[];
};

export const fetchMentorsPaged = async (
    instituteId: string,
    pageNo: number,
    pageSize: number
): Promise<PageResponse<MentorDTO>> => {
    const res = await authenticatedAxiosInstance({
        method: 'GET',
        url: MENTORSHIP_MENTORS,
        params: { instituteId, pageNo, pageSize },
    });
    return res.data as PageResponse<MentorDTO>;
};

export const fetchDashboard = async (instituteId: string): Promise<MentorDashboard> => {
    const res = await authenticatedAxiosInstance({
        method: 'GET',
        url: MENTORSHIP_DASHBOARD,
        params: { instituteId },
    });
    return res.data as MentorDashboard;
};

export const createMentor = async (data: CreateMentorRequest): Promise<MentorDTO> => {
    const res = await authenticatedAxiosInstance({ method: 'POST', url: MENTORSHIP_MENTORS, data });
    return res.data as MentorDTO;
};

export const updateMentor = async (
    id: string,
    instituteId: string,
    data: UpdateMentorRequest
): Promise<MentorDTO> => {
    const res = await authenticatedAxiosInstance({
        method: 'PUT',
        url: MENTORSHIP_MENTOR_BY_ID(id),
        params: { instituteId },
        data,
    });
    return res.data as MentorDTO;
};

export const deleteMentor = async (id: string, instituteId: string): Promise<string> => {
    const res = await authenticatedAxiosInstance({
        method: 'DELETE',
        url: MENTORSHIP_MENTOR_BY_ID(id),
        params: { instituteId },
    });
    return res.data as string;
};

export const assignMentees = async (data: AssignMentorRequest): Promise<AssignmentResult> => {
    const res = await authenticatedAxiosInstance({ method: 'POST', url: MENTORSHIP_ASSIGNMENTS, data });
    return res.data as AssignmentResult;
};

export const bulkRoundRobin = async (data: BulkRoundRobinRequest): Promise<AssignmentResult> => {
    const res = await authenticatedAxiosInstance({
        method: 'POST',
        url: MENTORSHIP_ASSIGNMENTS_BULK,
        data,
    });
    return res.data as AssignmentResult;
};

export const unassignMentee = async (id: string, instituteId: string): Promise<string> => {
    const res = await authenticatedAxiosInstance({
        method: 'DELETE',
        url: MENTORSHIP_ASSIGNMENT_BY_ID(id),
        params: { instituteId },
    });
    return res.data as string;
};

export const provisionMentorBookingPage = async (
    id: string,
    instituteId: string
): Promise<MentorDTO> => {
    const res = await authenticatedAxiosInstance({
        method: 'POST',
        url: MENTORSHIP_MENTOR_BOOKING_PAGE(id),
        params: { instituteId },
    });
    return res.data as MentorDTO;
};

/**
 * The admin review queue for learner mentor requests. Defaults to PENDING;
 * pass a status for the decided history.
 */
export const fetchMentorRequests = async (
    instituteId: string,
    status: string,
    pageNo: number,
    pageSize: number
): Promise<PageResponse<MentorRequestDTO>> => {
    const res = await authenticatedAxiosInstance({
        method: 'GET',
        url: MENTORSHIP_REQUESTS,
        params: { instituteId, status, pageNo, pageSize },
    });
    return res.data as PageResponse<MentorRequestDTO>;
};

/** Approve a request — creates the mentor↔student assignment server-side. */
export const approveMentorRequest = async (
    id: string,
    instituteId: string,
    decision?: MentorRequestDecision
): Promise<MentorRequestDTO> => {
    const res = await authenticatedAxiosInstance({
        method: 'POST',
        url: MENTORSHIP_REQUEST_APPROVE(id),
        params: { instituteId },
        data: decision ?? {},
    });
    return res.data as MentorRequestDTO;
};

/** Decline a request, optionally with a reason the learner sees. */
export const declineMentorRequest = async (
    id: string,
    instituteId: string,
    decision?: MentorRequestDecision
): Promise<MentorRequestDTO> => {
    const res = await authenticatedAxiosInstance({
        method: 'POST',
        url: MENTORSHIP_REQUEST_DECLINE(id),
        params: { instituteId },
        data: decision ?? {},
    });
    return res.data as MentorRequestDTO;
};

/** One mentor's session ratings, newest first. The average itself rides on the mentor DTO. */
export const fetchMentorFeedback = async (
    id: string,
    instituteId: string
): Promise<MentorFeedbackDTO[]> => {
    const res = await authenticatedAxiosInstance({
        method: 'GET',
        url: MENTORSHIP_MENTOR_FEEDBACK(id),
        params: { instituteId },
    });
    return (res.data ?? []) as MentorFeedbackDTO[];
};

/** The caller's own mentor profile (incl. Google-connected status). */
export const fetchMyMentorProfile = async (instituteId: string): Promise<MentorDTO> => {
    const res = await authenticatedAxiosInstance({
        method: 'GET',
        url: MENTORSHIP_MY_MENTOR_PROFILE,
        params: { instituteId },
    });
    return res.data as MentorDTO;
};

/** Start the mentor's own Google connect — returns the consent URL to redirect to. */
export const initiateMyGoogle = async (
    instituteId: string
): Promise<{ oauth_url: string; session_key: string }> => {
    const res = await authenticatedAxiosInstance({
        method: 'POST',
        url: MENTORSHIP_MY_GOOGLE_INITIATE,
        params: { instituteId },
    });
    return res.data as { oauth_url: string; session_key: string };
};

/** The caller's own booking page (availability, duration, buffers) — auto-provisions if missing. */
export const fetchMyBookingPage = async (instituteId: string): Promise<MentorBookingPage> => {
    const res = await authenticatedAxiosInstance({
        method: 'GET',
        url: MENTORSHIP_MY_BOOKING_PAGE,
        params: { instituteId },
    });
    return res.data as MentorBookingPage;
};

/** Mentor updates their own availability / duration / buffers. */
export const updateMyBookingPage = async (
    instituteId: string,
    data: MentorAvailabilityRequest
): Promise<MentorBookingPage> => {
    const res = await authenticatedAxiosInstance({
        method: 'PUT',
        url: MENTORSHIP_MY_BOOKING_PAGE,
        params: { instituteId },
        data,
    });
    return res.data as MentorBookingPage;
};

/**
 * The mentor's own sessions (as host) in [startDate, endDate] (yyyy-MM-dd). Reuses
 * the meetings /my-calendar endpoint — a mentor IS the host on their booking page.
 */
export const fetchMySchedule = async (
    instituteId: string,
    startDate: string,
    endDate: string
): Promise<BookingInstance[]> => {
    const res = await authenticatedAxiosInstance({
        method: 'GET',
        url: MEETINGS_MY_CALENDAR,
        params: { instituteId, startDate, endDate },
    });
    return (res.data as BookingInstance[]) ?? [];
};

export const fetchMyMentees = async (instituteId: string): Promise<MenteeDTO[]> => {
    const res = await authenticatedAxiosInstance({
        method: 'GET',
        url: MENTORSHIP_MY_MENTEES,
        params: { instituteId },
    });
    return res.data as MenteeDTO[];
};

export const fetchMyMenteesPaged = async (
    instituteId: string,
    pageNo: number,
    pageSize: number
): Promise<PageResponse<MenteeDTO>> => {
    const res = await authenticatedAxiosInstance({
        method: 'GET',
        url: MENTORSHIP_MY_MENTEES,
        params: { instituteId, pageNo, pageSize },
    });
    return res.data as PageResponse<MenteeDTO>;
};

/** A mentee's notes/activity from the shared timeline system (pinned first). */
export const fetchStudentTimeline = async (studentUserId: string): Promise<TimelineEvent[]> => {
    const res = await authenticatedAxiosInstance({
        method: 'GET',
        url: `${GET_CROSS_STAGE_TIMELINE}/${studentUserId}`,
        params: { page: 0, size: 20 },
    });
    return (res.data?.content ?? []) as TimelineEvent[];
};

/** Add a mentorship note against a mentee (writes to timeline_event, category ACTIVITY). */
export const createMentorNote = async (req: CreateNoteRequest): Promise<TimelineEvent> => {
    const res = await authenticatedAxiosInstance({
        method: 'POST',
        url: CREATE_TIMELINE_EVENT,
        data: {
            type: 'MENTORSHIP',
            type_id: req.studentUserId,
            action_type: 'NOTE',
            title: req.title,
            description: req.description,
            student_user_id: req.studentUserId,
            category: 'ACTIVITY',
        },
    });
    return res.data as TimelineEvent;
};

/** A mentee's scheduled calls (booking instances matched by invitee user id). */
export const fetchMenteeCalls = async (
    instituteId: string,
    studentUserId: string
): Promise<BookingInstance[]> => {
    const res = await authenticatedAxiosInstance({
        method: 'GET',
        url: MEETINGS_BY_LEAD,
        params: { instituteId, inviteeUserId: studentUserId },
    });
    return (res.data ?? []) as BookingInstance[];
};

/**
 * Enrolled-student search for the mentee picker — reuses the learner-list
 * filter-search endpoint (ACTIVE students, scoped to the institute).
 */
export const searchStudents = async (params: {
    instituteId: string;
    name: string;
    pageNo?: number;
    pageSize?: number;
}): Promise<{ content: StudentRow[]; total_pages: number; total_elements: number }> => {
    const { instituteId, name, pageNo = 0, pageSize = 15 } = params;
    const res = await authenticatedAxiosInstance.post(
        `${GET_STUDENTS}?pageNo=${pageNo}&pageSize=${pageSize}`,
        { name, statuses: ['ACTIVE'], institute_ids: [instituteId] }
    );
    return res.data as { content: StudentRow[]; total_pages: number; total_elements: number };
};
