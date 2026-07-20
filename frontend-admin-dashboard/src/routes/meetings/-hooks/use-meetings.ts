import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createBookingPage,
    createMeetingBooking,
    deleteBookingPage,
    fetchBookingPages,
    fetchMeetingsScope,
    fetchMyCalendar,
    fetchTeamCalendar,
    updateBookingPage,
} from '../-services/meetings-services';
import { BookingPageDTO, CreateMeetingBookingRequest } from '../-types/meetings-types';

// Query keys — kept flat so mutations can invalidate whole families.
export const MEETINGS_KEYS = {
    myCalendar: 'meetings-my-calendar',
    teamCalendar: 'meetings-team-calendar',
    scope: 'meetings-scope',
    bookingPages: 'meetings-booking-pages',
} as const;

export const useMyCalendar = (
    instituteId: string | undefined,
    startDate: string,
    endDate: string
) =>
    useQuery({
        queryKey: [MEETINGS_KEYS.myCalendar, instituteId, startDate, endDate],
        queryFn: () => fetchMyCalendar({ instituteId: instituteId ?? '', startDate, endDate }),
        enabled: !!instituteId,
        staleTime: 30 * 1000,
    });

export const useTeamCalendar = (
    instituteId: string | undefined,
    startDate: string,
    endDate: string,
    enabled: boolean = true
) =>
    useQuery({
        queryKey: [MEETINGS_KEYS.teamCalendar, instituteId, startDate, endDate],
        queryFn: () => fetchTeamCalendar({ instituteId: instituteId ?? '', startDate, endDate }),
        enabled: !!instituteId && enabled,
        staleTime: 30 * 1000,
    });

export const useMeetingsScope = (instituteId: string | undefined) =>
    useQuery({
        queryKey: [MEETINGS_KEYS.scope, instituteId],
        queryFn: () => fetchMeetingsScope(instituteId ?? ''),
        enabled: !!instituteId,
        staleTime: 5 * 60 * 1000,
    });

export const useBookingPages = (params: {
    instituteId: string | undefined;
    audienceId?: string;
    hostUserId?: string;
    enabled?: boolean;
}) =>
    useQuery({
        queryKey: [
            MEETINGS_KEYS.bookingPages,
            params.instituteId,
            params.audienceId ?? null,
            params.hostUserId ?? null,
        ],
        queryFn: () =>
            fetchBookingPages({
                instituteId: params.instituteId ?? '',
                audienceId: params.audienceId,
                hostUserId: params.hostUserId,
            }),
        enabled: !!params.instituteId && (params.enabled ?? true),
    });

const useInvalidateBookingPages = () => {
    const queryClient = useQueryClient();
    return () => queryClient.invalidateQueries({ queryKey: [MEETINGS_KEYS.bookingPages] });
};

export const useCreateBookingPage = () => {
    const invalidate = useInvalidateBookingPages();
    return useMutation({
        mutationFn: (data: BookingPageDTO) => createBookingPage(data),
        onSuccess: invalidate,
    });
};

export const useUpdateBookingPage = () => {
    const invalidate = useInvalidateBookingPages();
    return useMutation({
        mutationFn: ({
            id,
            instituteId,
            data,
        }: {
            id: string;
            instituteId: string;
            data: Partial<BookingPageDTO>;
        }) => updateBookingPage(id, instituteId, data),
        onSuccess: invalidate,
    });
};

export const useDeleteBookingPage = () => {
    const invalidate = useInvalidateBookingPages();
    return useMutation({
        mutationFn: ({ id, instituteId }: { id: string; instituteId: string }) =>
            deleteBookingPage(id, instituteId),
        onSuccess: invalidate,
    });
};

export const useCreateMeetingBooking = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateMeetingBookingRequest) => createMeetingBooking(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [MEETINGS_KEYS.myCalendar] });
            queryClient.invalidateQueries({ queryKey: [MEETINGS_KEYS.teamCalendar] });
        },
    });
};
