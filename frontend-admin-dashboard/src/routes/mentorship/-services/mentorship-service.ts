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
    MENTORSHIP_MENTOR_BY_ID,
    MENTORSHIP_MY_MENTEES,
} from '@/constants/urls';
import type {
    AssignMentorRequest,
    AssignmentResult,
    BookingInstance,
    BulkRoundRobinRequest,
    CreateMentorRequest,
    CreateNoteRequest,
    MenteeDTO,
    MentorDTO,
    MentorDashboard,
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

export const fetchMyMentees = async (instituteId: string): Promise<MenteeDTO[]> => {
    const res = await authenticatedAxiosInstance({
        method: 'GET',
        url: MENTORSHIP_MY_MENTEES,
        params: { instituteId },
    });
    return res.data as MenteeDTO[];
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
