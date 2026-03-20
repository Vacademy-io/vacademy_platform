import {
    BOOKING_CALENDAR,
    BOOKING_CREATE,
    BOOKING_GET_BY_ID,
    BOOKING_TYPES_CREATE,
    BOOKING_TYPES_LIST,
    SEARCH_SESSIONS,
    AUTOSUGGEST_USERS,
    GET_USER_BASIC_DETAILS,
} from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    BookingDetail,
    BookingSearchParams,
    CalendarEvent,
    CreateBookingRequest,
    PaginatedBookingTypeResponse,
} from '../-types/booking-types';

export const fetchBookingTypes = async (
    instituteId: string,
    page: number = 0,
    size: number = 20
) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: BOOKING_TYPES_LIST,
        params: {
            instituteId,
            page,
            size,
        },
    });
    return response.data as PaginatedBookingTypeResponse;
};

export const fetchUserCalendar = async (userId: string, startDate: string, endDate: string) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: BOOKING_CALENDAR,
        params: {
            userId,
            startDate,
            endDate,
        },
    });
    return response.data as CalendarEvent[];
};

export const fetchBookingById = async (sessionId: string) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: BOOKING_GET_BY_ID(sessionId),
    });
    return response.data as BookingDetail;
};

export const searchBookings = async (params: BookingSearchParams) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: SEARCH_SESSIONS,
        data: params,
    });
    return response.data;
};

export interface CreateBookingTypeRequest {
    type: string;
    code: string;
    description?: string;
    institute_id: string;
}

export const createBookingType = async (data: CreateBookingTypeRequest) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: BOOKING_TYPES_CREATE,
        data,
    });
    return response.data;
};

export const createBooking = async (data: CreateBookingRequest) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: BOOKING_CREATE,
        data,
    });
    return response.data;
};

export interface UserAutosuggestParams {
    instituteId: string;
    query: string;
    roles?: string[]; // comma separated role names
}

export interface UserAutosuggestResponse {
    id: string;
    username: string;
    email: string;
    fullName: string;
    mobileNumber: string;
    roles: any[];
}

export const autoSuggestUsers = async (params: UserAutosuggestParams) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: AUTOSUGGEST_USERS,
        params: {
            instituteId: params.instituteId,
            query: params.query,
            roles: params.roles ? params.roles.join(',') : undefined,
        },
    });
    return response.data as UserAutosuggestResponse[];
};

export const fetchUserBasicDetails = async (userIds: string[]) => {
    if (!userIds || userIds.length === 0) return [];

    // According to curl, it expects a raw array in body
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_USER_BASIC_DETAILS,
        data: userIds,
    });
    return response.data; // Should return UserBasicDetail[]
};
