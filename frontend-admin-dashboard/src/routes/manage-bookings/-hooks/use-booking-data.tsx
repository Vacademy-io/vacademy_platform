import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createBooking,
    createBookingType,
    CreateBookingTypeRequest,
    fetchBookingTypes,
    fetchUserCalendar,
    searchBookings,
    autoSuggestUsers,
    fetchUserBasicDetails,
} from '../-services/booking-service';
import {
    BookingSearchParams,
    CreateBookingRequest,
    PaginatedBookingTypeResponse,
    UserBasicDetail,
} from '../-types/booking-types';

export const useBookingTypes = (instituteId: string | undefined, page: number, size: number) => {
    return useQuery<PaginatedBookingTypeResponse>({
        queryKey: ['bookingTypes', instituteId, page, size],
        queryFn: () =>
            instituteId
                ? fetchBookingTypes(instituteId, page, size)
                : Promise.reject('No institute ID'),
        enabled: !!instituteId,
    });
};

export const useUserCalendar = (userId: string, startDate: string, endDate: string) => {
    return useQuery({
        queryKey: ['userCalendar', userId, startDate, endDate],
        queryFn: () => fetchUserCalendar(userId, startDate, endDate),
        enabled: !!userId && !!startDate && !!endDate,
    });
};

export const useSearchBookings = (params: BookingSearchParams) => {
    return useQuery({
        queryKey: ['searchBookings', params],
        queryFn: () => searchBookings(params),
        enabled: !!params.institute_id,
    });
};

export const useCreateBookingType = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateBookingTypeRequest) => createBookingType(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bookingTypes'] });
        },
    });
};

export const useCreateBooking = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateBookingRequest) => createBooking(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userCalendar'] });
            queryClient.invalidateQueries({ queryKey: ['searchBookings'] });
        },
    });
};

export const useAutoSuggestUsers = (
    instituteId: string | undefined,
    query: string,
    roles?: string[]
) => {
    return useQuery({
        queryKey: ['autoSuggestUsers', instituteId, query, roles],
        queryFn: () =>
            instituteId ? autoSuggestUsers({ instituteId, query, roles }) : Promise.resolve([]),
        enabled: !!instituteId && query.length >= 3,
        staleTime: 1000 * 60, // 1 minute
    });
};

export const useUserBasicDetails = (userIds: string[]) => {
    return useQuery<UserBasicDetail[]>({
        queryKey: ['userBasicDetails', userIds],
        queryFn: () => fetchUserBasicDetails(userIds),
        enabled: userIds.length > 0,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};
