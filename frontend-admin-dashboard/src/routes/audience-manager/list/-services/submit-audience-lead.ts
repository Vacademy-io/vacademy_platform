import { BASE_URL } from '@/constants/urls';

export const SUBMIT_AUDIENCE_LEAD_URL = `${BASE_URL}/admin-core-service/open/v1/audience/lead/submit`;

export interface SubmitLeadUserDto {
    id?: string;
    username: string;
    email: string;
    full_name: string;
    address_line?: string;
    city?: string;
    region?: string;
    pin_code?: string;
    mobile_number?: string;
    date_of_birth?: string | null;
    gender?: string;
    password?: string;
    profile_pic_file_id?: string;
    roles?: string[];
    last_login_time?: string | null;
    root_user?: boolean;
}

export interface SubmitLeadRequest {
    audience_id: string;
    source_type: string;
    source_id: string;
    custom_field_values: Record<string, string>;
    user_dto: SubmitLeadUserDto;
}

export interface SubmitLeadResponse {
    success?: boolean;
    message?: string;
    response_id?: string;
}

/**
 * Submit a lead/response to an audience campaign using the open endpoint.
 * This can be used by admins to submit on behalf of respondents.
 */
export const submitAudienceLead = async (payload: SubmitLeadRequest): Promise<SubmitLeadResponse> => {
    const response = await fetch(SUBMIT_AUDIENCE_LEAD_URL, {
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

    // Handle empty response body (204 No Content or empty 200)
    const text = await response.text();
    if (!text) {
        return { success: true };
    }

    try {
        return JSON.parse(text);
    } catch {
        return { success: true, message: text };
    }
};

/**
 * Generate a cURL command for API integration
 */
export const generateCurlCommand = (
    audienceId: string,
    customFields: Array<{ id: string; fieldName: string; fieldKey: string; isMandatory?: boolean }>
): string => {
    const samplePayload: SubmitLeadRequest = {
        audience_id: audienceId,
        source_type: 'AUDIENCE_CAMPAIGN',
        source_id: audienceId,
        custom_field_values: customFields.reduce(
            (acc, field) => {
                acc[field.id] = `<${field.fieldName || field.fieldKey}>`;
                return acc;
            },
            {} as Record<string, string>
        ),
        user_dto: {
            id: '',
            username: '<email>',
            email: '<email>',
            full_name: '<full_name>',
            address_line: '',
            city: '',
            region: '',
            pin_code: '',
            mobile_number: '<phone_number>',
            date_of_birth: null,
            gender: '',
            password: '',
            profile_pic_file_id: '',
            roles: [],
            last_login_time: null,
            root_user: false,
        },
    };

    const curlCommand = `curl '${SUBMIT_AUDIENCE_LEAD_URL}' \\
  -H 'Accept: application/json, text/plain, */*' \\
  -H 'Content-Type: application/json' \\
  --data-raw '${JSON.stringify(samplePayload, null, 2)}'`;

    return curlCommand;
};
