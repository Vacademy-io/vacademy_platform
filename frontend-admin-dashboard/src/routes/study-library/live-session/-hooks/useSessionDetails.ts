import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { LIVE_SESSION_GET_SESSION_BY_SCHEDULE_ID } from '@/constants/urls';

export interface SessionDetailsResponse {
    sessionId: string;
    scheduleId: string;
    instituteId: string;
    sessionStartTime: string;
    lastEntryTime: string;
    accessLevel: string;
    meetingType: string | null;
    linkType: string;
    sessionStreamingServiceType: string | null;
    defaultMeetLink: string;
    waitingRoomLink: string | null;
    waitingRoomTime: number;
    registrationFormLinkForPublicSessions: string | null;
    createdByUserId: string;
    title: string;
    descriptionHtml: string | null;
    notificationEmailMessage: string | null;
    attendanceEmailMessage: string | null;
    coverFileId: string | null;
    subject: string;
    thumbnailFileId: string;
    backgroundScoreFileId: string;
    status: string;
    recurrenceType: string;
    recurrenceKey: string | null;
    meetingDate: string;
    scheduleStartTime: string;
    scheduleLastEntryTime: string;
    customMeetingLink: string;
    customWaitingRoomMediaId: string | null;
    // add playback control flags
    allowRewind?: boolean | string | null;
    allowPlayPause?: boolean | string | null;
}

export const fetchSessionDetails = async (scheduleId: string): Promise<SessionDetailsResponse> => {
    try {
        const response = await authenticatedAxiosInstance({
            method: 'GET',
            url: LIVE_SESSION_GET_SESSION_BY_SCHEDULE_ID,
            params: {
                scheduleId,
            },
        });

        return response.data;
    } catch (error) {
        console.error('Error fetching session details:', error);
        throw error;
    }
};

export const useSessionDetails = (scheduleId: string | null) => {
    return useQuery({
        queryKey: ['sessionDetails', scheduleId],
        queryFn: () => fetchSessionDetails(scheduleId!),
        enabled: !!scheduleId,
    });
};
