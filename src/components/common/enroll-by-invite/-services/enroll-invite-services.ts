import { ENROLL_OPEN_STUDENT_URL, GET_STRIPE_KEY_URL } from "@/constants/urls";
import axios from "axios";
export const getEnrollInviteData = async ({
    instituteId,
    inviteCode,
}: {
    instituteId: string;
    inviteCode: string;
}) => {
    const response = await axios({
        method: "GET",
        url: ENROLL_OPEN_STUDENT_URL,
        params: {
            instituteId,
            inviteCode,
        },
    });
    return response?.data;
};
export const handleGetEnrollInviteData = ({
    instituteId,
    inviteCode,
}: {
    instituteId: string;
    inviteCode: string;
}) => {
    return {
        queryKey: ["GET_ENROLL_INVITE_DETAILS", instituteId, inviteCode],
        queryFn: () => getEnrollInviteData({ instituteId, inviteCode }),
        staleTime: 60 * 60 * 1000,
    };
};

export const getStripeKeyData = async (instituteId: string) => {
    const response = await axios({
        method: "GET",
        url: GET_STRIPE_KEY_URL,
        params: {
            instituteId,
            vendor: "STRIPE",
        },
    });
    return response?.data;
};
export const handleGetStripeKeys = (instituteId: string) => {
    return {
        queryKey: ["GET_ENROLL_INVITE_DETAILS"],
        queryFn: () => getStripeKeyData(instituteId),
        staleTime: 60 * 60 * 1000,
    };
};
