import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    assignMentees,
    bulkRoundRobin,
    createMentor,
    createMentorNote,
    deleteMentor,
    fetchDashboard,
    fetchMenteeCalls,
    fetchMentors,
    fetchMentorsPaged,
    fetchMyBookingPage,
    fetchMyMentees,
    fetchMyMenteesPaged,
    fetchMyMentorProfile,
    fetchMySchedule,
    fetchStudentTimeline,
    provisionMentorBookingPage,
    unassignMentee,
    updateMentor,
    updateMyBookingPage,
} from '../-services/mentorship-service';
import type {
    AssignMentorRequest,
    BulkRoundRobinRequest,
    CreateMentorRequest,
    CreateNoteRequest,
    MentorAvailabilityRequest,
    UpdateMentorRequest,
} from '../-types/mentorship-types';

export const MENTORSHIP_KEYS = {
    mentors: 'mentorship-mentors',
    dashboard: 'mentorship-dashboard',
    myMentees: 'mentorship-my-mentees',
    timeline: 'mentorship-timeline',
    calls: 'mentorship-calls',
} as const;

export const useStudentTimeline = (studentUserId: string | undefined) =>
    useQuery({
        queryKey: [MENTORSHIP_KEYS.timeline, studentUserId],
        queryFn: () => fetchStudentTimeline(studentUserId ?? ''),
        enabled: !!studentUserId,
        staleTime: 15 * 1000,
    });

export const useMenteeCalls = (instituteId: string | undefined, studentUserId: string | undefined) =>
    useQuery({
        queryKey: [MENTORSHIP_KEYS.calls, instituteId, studentUserId],
        queryFn: () => fetchMenteeCalls(instituteId ?? '', studentUserId ?? ''),
        enabled: !!instituteId && !!studentUserId,
        staleTime: 30 * 1000,
    });

export const useCreateNote = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (req: CreateNoteRequest) => createMentorNote(req),
        onSuccess: (_data, req) =>
            queryClient.invalidateQueries({ queryKey: [MENTORSHIP_KEYS.timeline, req.studentUserId] }),
    });
};

export const useMentorDashboard = (instituteId: string | undefined) =>
    useQuery({
        queryKey: [MENTORSHIP_KEYS.dashboard, instituteId],
        queryFn: () => fetchDashboard(instituteId ?? ''),
        enabled: !!instituteId,
        staleTime: 30 * 1000,
    });

export const useMentors = (instituteId: string | undefined) =>
    useQuery({
        queryKey: [MENTORSHIP_KEYS.mentors, instituteId],
        queryFn: () => fetchMentors(instituteId ?? ''),
        enabled: !!instituteId,
        staleTime: 30 * 1000,
    });

export const useMentorsPaged = (instituteId: string | undefined, pageNo: number, pageSize: number) =>
    useQuery({
        queryKey: [MENTORSHIP_KEYS.mentors, instituteId, 'paged', pageNo, pageSize],
        queryFn: () => fetchMentorsPaged(instituteId ?? '', pageNo, pageSize),
        enabled: !!instituteId,
        staleTime: 30 * 1000,
    });

export const useMyMentees = (instituteId: string | undefined) =>
    useQuery({
        queryKey: [MENTORSHIP_KEYS.myMentees, instituteId],
        queryFn: () => fetchMyMentees(instituteId ?? ''),
        enabled: !!instituteId,
        staleTime: 30 * 1000,
    });

export const useMyMenteesPaged = (
    instituteId: string | undefined,
    pageNo: number,
    pageSize: number
) =>
    useQuery({
        queryKey: [MENTORSHIP_KEYS.myMentees, instituteId, 'paged', pageNo, pageSize],
        queryFn: () => fetchMyMenteesPaged(instituteId ?? '', pageNo, pageSize),
        enabled: !!instituteId,
        staleTime: 30 * 1000,
    });

export const useMyMentorProfile = (instituteId: string | undefined) =>
    useQuery({
        queryKey: ['mentorship-my-mentor-profile', instituteId],
        queryFn: () => fetchMyMentorProfile(instituteId ?? ''),
        enabled: !!instituteId,
        staleTime: 30 * 1000,
        retry: false,
    });

export const useMySchedule = (
    instituteId: string | undefined,
    startDate: string,
    endDate: string
) =>
    useQuery({
        queryKey: ['mentorship-my-schedule', instituteId, startDate, endDate],
        queryFn: () => fetchMySchedule(instituteId ?? '', startDate, endDate),
        enabled: !!instituteId,
        staleTime: 30 * 1000,
    });

export const useMyBookingPage = (instituteId: string | undefined) =>
    useQuery({
        queryKey: ['mentorship-my-booking-page', instituteId],
        queryFn: () => fetchMyBookingPage(instituteId ?? ''),
        enabled: !!instituteId,
        staleTime: 30 * 1000,
        retry: false,
    });

export const useUpdateMyBookingPage = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (v: { instituteId: string; data: MentorAvailabilityRequest }) =>
            updateMyBookingPage(v.instituteId, v.data),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: ['mentorship-my-booking-page'] }),
    });
};

const useInvalidateMentorship = () => {
    const queryClient = useQueryClient();
    return () => {
        queryClient.invalidateQueries({ queryKey: [MENTORSHIP_KEYS.mentors] });
        queryClient.invalidateQueries({ queryKey: [MENTORSHIP_KEYS.dashboard] });
    };
};

export const useCreateMentor = () => {
    const invalidate = useInvalidateMentorship();
    return useMutation({ mutationFn: (data: CreateMentorRequest) => createMentor(data), onSuccess: invalidate });
};

export const useUpdateMentor = () => {
    const invalidate = useInvalidateMentorship();
    return useMutation({
        mutationFn: (v: { id: string; instituteId: string; data: UpdateMentorRequest }) =>
            updateMentor(v.id, v.instituteId, v.data),
        onSuccess: invalidate,
    });
};

export const useDeleteMentor = () => {
    const invalidate = useInvalidateMentorship();
    return useMutation({
        mutationFn: (v: { id: string; instituteId: string }) => deleteMentor(v.id, v.instituteId),
        onSuccess: invalidate,
    });
};

export const useProvisionBookingPage = () => {
    const invalidate = useInvalidateMentorship();
    return useMutation({
        mutationFn: (v: { id: string; instituteId: string }) => provisionMentorBookingPage(v.id, v.instituteId),
        onSuccess: invalidate,
    });
};

export const useAssignMentees = () => {
    const invalidate = useInvalidateMentorship();
    return useMutation({ mutationFn: (data: AssignMentorRequest) => assignMentees(data), onSuccess: invalidate });
};

export const useBulkRoundRobin = () => {
    const invalidate = useInvalidateMentorship();
    return useMutation({ mutationFn: (data: BulkRoundRobinRequest) => bulkRoundRobin(data), onSuccess: invalidate });
};

export const useUnassignMentee = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (v: { id: string; instituteId: string }) => unassignMentee(v.id, v.instituteId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [MENTORSHIP_KEYS.myMentees] }),
    });
};
