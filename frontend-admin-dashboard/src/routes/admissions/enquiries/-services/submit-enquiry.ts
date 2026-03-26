import { BULK_SUBMIT_ENQUIRY_WITH_LEAD, SUBMIT_ENQUIRY_WITH_LEAD } from '@/constants/urls';

// User DTO interface (simplified - excluding id, username, password, profile_pic)
interface UserDTO {
    full_name?: string;
    email?: string;
    mobile_number?: string;
    date_of_birth?: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    address_line?: string;
    city?: string;
    region?: string;
    pin_code?: string;
    is_parent?: boolean;
    root_user?: boolean;
}

// Type definitions for submit enquiry request
export interface SubmitEnquiryRequest {
    audience_id: string;
    source_type?: string;
    source_id?: string;
    custom_field_values?: Record<string, string>;
    parent_user_dto?: UserDTO;
    child_user_dto?: UserDTO;
    destination_package_session_id?: string;
    parent_name?: string;
    parent_email?: string;
    parent_mobile?: string;
    counsellor_id?: string;
    enquiry?: {
        checklist?: string;
        enquiry_status?: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST' | 'NOT_ELIGIBLE';
        convertion_status?: string;
        parent_relation_with_child?: 'FATHER' | 'MOTHER' | 'GUARDIAN';
        reference_source?: string;
        assigned_user_id?: boolean;
        assigned_visit_session_id?: boolean;
        fee_range_expectation?: string;
        transport_requirement?: string;
        mode?: 'ONLINE' | 'OFFLINE' | 'HYBRID';
        enquiry_tracking_id?: string;
        interest_score?: number;
        notes?: string;
    };
}

export interface SubmitEnquiryResponse {
    enquiry_id: string;
    audience_response_id: string;
    user_id: string;
    message: string;
}

export type EnquirySourceType =
    | 'WEBSITE'
    | 'GOOGLE_ADS'
    | 'FACEBOOK'
    | 'INSTAGRAM'
    | 'REFERRAL'
    | 'OTHER';

export interface BulkSubmitEnquiryRow {
    audience_id: string;
    source_type?: EnquirySourceType;
    destination_package_session_id?: string;
    parent_name: string;
    parent_email: string;
    parent_mobile: string;
    parent_user_dto: {
        full_name: string;
        email: string;
        mobile_number: string;
        is_parent: true;
        root_user: true;
    };
    child_user_dto: {
        full_name: string;
        date_of_birth: string;
        gender: 'MALE' | 'FEMALE' | 'OTHER';
        is_parent: false;
        root_user: false;
    };
    enquiry: {
        enquiry_status: string;
        parent_relation_with_child?: 'FATHER' | 'MOTHER' | 'GUARDIAN';
    };
}

export interface BulkSubmitEnquiryRequest {
    audience_id: string;
    rows: BulkSubmitEnquiryRow[];
}

export interface BulkSubmitEnquiryResponse {
    summary?: {
        successful?: number;
        failed?: number;
    };
    results?: Array<{
        status?: string;
        success?: boolean;
    }>;
    [key: string]: unknown;
}

/**
 * Submit a lead with enquiry details
 * This is a public endpoint and does not require authentication
 */
export const submitEnquiryWithLead = async (
    payload: SubmitEnquiryRequest
): Promise<SubmitEnquiryResponse> => {
    try {
        const response = await fetch(SUBMIT_ENQUIRY_WITH_LEAD, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({
                message: 'Failed to submit enquiry',
            }));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error submitting enquiry:', error);
        throw error;
    }
};

export const submitEnquiryBulkWithLead = async (
    payload: BulkSubmitEnquiryRequest
): Promise<BulkSubmitEnquiryResponse> => {
    const response = await fetch(BULK_SUBMIT_ENQUIRY_WITH_LEAD, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({
            message: 'Failed to submit enquiry bulk import',
        }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json().catch(() => ({}));
};

/**
 * React Query mutation handler for submitting enquiry
 */
export const useSubmitEnquiryMutation = () => {
    return {
        mutationFn: submitEnquiryWithLead,
        onSuccess: (data: SubmitEnquiryResponse) => {
            console.log('Enquiry submitted successfully:', data);
        },
        onError: (error: Error) => {
            console.error('Failed to submit enquiry:', error);
        },
    };
};
