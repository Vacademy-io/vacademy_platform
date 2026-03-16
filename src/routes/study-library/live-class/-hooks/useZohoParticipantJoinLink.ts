import { useQuery } from "@tanstack/react-query";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { ZOHO_PARTICIPANT_JOIN_LINK } from "@/constants/urls";

interface ZohoParticipantJoinLinkParams {
    scheduleId: string;
    instituteId: string;
    participantName?: string;
    participantEmail?: string;
}

interface ZohoParticipantJoinLinkResponse {
    joinLink: string;
    participantName: string;
    participantEmail: string;
    providerMeetingId: string;
}

export const fetchZohoParticipantJoinLink = async (
    params: ZohoParticipantJoinLinkParams
): Promise<ZohoParticipantJoinLinkResponse> => {
    const response = await authenticatedAxiosInstance({
        method: "POST",
        url: ZOHO_PARTICIPANT_JOIN_LINK,
        params: {
            scheduleId: params.scheduleId,
            instituteId: params.instituteId,
            ...(params.participantName && { participantName: params.participantName }),
            ...(params.participantEmail && { participantEmail: params.participantEmail }),
        },
    });
    return response.data;
};

export const useZohoParticipantJoinLink = (
    params: ZohoParticipantJoinLinkParams | null
) => {
    return useQuery({
        queryKey: ["zohoParticipantJoinLink", params?.scheduleId, params?.instituteId],
        queryFn: () => fetchZohoParticipantJoinLink(params!),
        enabled: !!params?.scheduleId && !!params?.instituteId,
        // Don't cache — always fetch fresh to avoid stale links
        staleTime: 0,
        gcTime: 0,
    });
};
