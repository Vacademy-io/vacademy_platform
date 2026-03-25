// src/services/engageApi.ts
import axios from 'axios';
import { type SessionDetailsResponse, type JoinSessionPayload } from '@/types';
import { BASE_URL } from '@/config/baseUrl';

const API_BASE_URL = `${BASE_URL}/community-service/engage/learner`;

export const getSessionDetails = async (
    inviteCode: string,
    payload: JoinSessionPayload
): Promise<SessionDetailsResponse> => {
    try {
        const response = await axios.post<SessionDetailsResponse>(
            `${API_BASE_URL}/get-details/${inviteCode}`,
            payload,
            { headers: { 'Content-Type': 'application/json' } }
        );
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            throw new Error(error.response.data?.message || `Failed to join session: ${error.response.status}`);
        }
        throw new Error('An unexpected error occurred while joining the session.');
    }
};

// Note: Quiz answer submission is handled directly in QuizInteraction.tsx via fetch()
// using the endpoint: POST /community-service/engage/learner/{sessionId}/slide/{slideId}/respond