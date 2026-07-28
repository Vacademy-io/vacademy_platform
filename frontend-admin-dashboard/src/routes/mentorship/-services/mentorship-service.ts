import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    GET_STUDENTS,
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
    BulkRoundRobinRequest,
    CreateMentorRequest,
    MenteeDTO,
    MentorDTO,
    MentorDashboard,
    StudentRow,
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
