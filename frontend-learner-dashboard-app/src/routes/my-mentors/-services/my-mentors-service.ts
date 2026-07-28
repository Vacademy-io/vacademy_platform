import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { MENTORSHIP_MY_MENTORS } from "@/constants/urls";

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
