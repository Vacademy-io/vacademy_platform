import { BULK_SUBMIT_APPLICATION_WITH_LEAD } from '@/constants/urls';

export interface BulkSubmitApplicationRow {
    session_id: string;
    destination_package_session_id: string;

    father_name?: string;
    father_mobile?: string;
    father_email?: string;
    mother_name?: string;
    mother_mobile?: string;
    mother_email?: string;

    child_name: string;
    child_dob: string; // yyyy-MM-dd
    child_gender: 'MALE' | 'FEMALE' | 'OTHER';

    address_line?: string;
}

export interface BulkSubmitApplicationRequest {
    institute_id: string;
    rows: BulkSubmitApplicationRow[];
}

export interface BulkRowResult {
    row_index: number;
    status: string; // SUCCESS / FAILED
    success: boolean;
    message?: string;
}

export interface BulkSubmitApplicationResponse {
    summary: {
        successful: number;
        failed: number;
    };
    results?: BulkRowResult[];
    [key: string]: unknown;
}

export const submitApplicationBulkWithLead = async (
    payload: BulkSubmitApplicationRequest
): Promise<BulkSubmitApplicationResponse> => {
    const response = await fetch(BULK_SUBMIT_APPLICATION_WITH_LEAD, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({
            message: 'Failed to submit application bulk import',
        }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json().catch(() => ({} as BulkSubmitApplicationResponse));
};

