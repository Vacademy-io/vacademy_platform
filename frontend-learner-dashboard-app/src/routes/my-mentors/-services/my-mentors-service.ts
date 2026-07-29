import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { MEETINGS_BY_LEAD, MENTORSHIP_MY_MENTORS } from "@/constants/urls";

// snake_case — mirrors admin-core-service MentorDTO.
export interface MyMentor {
    id: string;
    user_id: string;
    display_name?: string | null;
    title?: string | null;
    profile_image_file_id?: string | null;
    bio?: string | null;
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
