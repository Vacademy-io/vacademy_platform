import { BULK_SUBMIT_ADMISSION_WITH_LEAD } from '@/constants/urls';

export interface BulkSubmitAdmissionRow {
    session_id: string;
    destination_package_session_id: string;

    parent_name: string;
    parent_email: string;
    parent_mobile: string;

    child_name: string;
    child_dob: string; // yyyy-MM-dd
    child_gender: 'MALE' | 'FEMALE' | 'OTHER';

    status?: string;
    source_type?: string;
}

export interface BulkSubmitAdmissionRequest {
    institute_id: string;
    rows: BulkSubmitAdmissionRow[];
}

export interface BulkAdmissionRowResult {
    row_index: number;
    status: string; // SUCCESS / FAILED
    success: boolean;
    message?: string;
}

export interface BulkSubmitAdmissionResponse {
    summary: {
        successful: number;
        failed: number;
    };
    results?: BulkAdmissionRowResult[];
    [key: string]: unknown;
}

export const submitAdmissionBulkWithLead = async (
    payload: BulkSubmitAdmissionRequest
): Promise<BulkSubmitAdmissionResponse> => {
    const response = await fetch(BULK_SUBMIT_ADMISSION_WITH_LEAD, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({
            message: 'Failed to submit admission bulk import',
        }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json().catch(() => ({} as BulkSubmitAdmissionResponse));
};

