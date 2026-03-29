import { BULK_SUBMIT_AUDIENCE_LEAD } from '@/constants/urls';
import { SubmitLeadRequest } from './submit-audience-lead';

export interface BulkSubmitLeadRequest {
    audience_id: string;
    rows: SubmitLeadRequest[];
}

export interface BulkSubmitLeadResultItem {
    index: number;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    message: string;
    audience_response_id?: string;
    user_id?: string;
}

export interface BulkSubmitLeadSummary {
    total_requested: number;
    successful: number;
    failed: number;
    skipped: number;
}

export interface BulkSubmitLeadResponse {
    summary: BulkSubmitLeadSummary;
    results: BulkSubmitLeadResultItem[];
}

export const submitBulkAudienceLead = async (
    payload: BulkSubmitLeadRequest
): Promise<BulkSubmitLeadResponse> => {
    const response = await fetch(BULK_SUBMIT_AUDIENCE_LEAD, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
    }

    return response.json();
};
