// src/services/engageApi.ts
import axios from 'axios';
import { type SessionDetailsResponse, type JoinSessionPayload } from '@/types';

const API_BASE_URL = 'https://backend-stage.vacademy.io/community-service/engage/learner';

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

// Placeholder for submitting quiz answers
export interface SubmitAnswerPayload {
    session_id: string;
    slide_id: string;
    question_id: string;
    username: string;
    selected_option_ids?: string[]; // For MCQs
    answer_text?: string; // For free text
    // ... other fields as required by backend
}

export const submitQuizAnswer = async (payload: SubmitAnswerPayload): Promise<any> => {
    console.log('Submitting quiz answer (mock):', payload);
    // Replace with actual API call
    // try {
    //     const response = await axios.post(`${API_BASE_URL}/submit-answer`, payload);
    //     return response.data;
    // } catch (error) {
    //     if (axios.isAxiosError(error) && error.response) {
    //         throw new Error(error.response.data?.message || `Failed to submit answer: ${error.response.status}`);
    //     }
    //     throw new Error('An unexpected error occurred while submitting the answer.');
    // }
    return new Promise(resolve => setTimeout(() => resolve({ success: true, message: "Answer submitted (mocked)" }), 500));
};

// You might need an API to fetch Excalidraw content if not embedded or directly available
// This is handled by fetchExcalidrawContent in lib/excalidrawUtils.ts for now (mocked)