import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { UPDATE_ENQUIRY_STATUS } from '@/constants/urls';

export type EnquiryStatus =
    | 'NEW'
    | 'CONTACTED'
    | 'QUALIFIED'
    | 'NOT_ELIGIBLE'
    | 'FOLLOW_UP'
    | 'CLOSED'
    | 'CONVERTED'
    | 'ADMITTED';

export type ConversionStatus = 'HOT' | 'COLD';

export const ENQUIRY_STATUS_OPTIONS: { value: EnquiryStatus; label: string }[] = [
    { value: 'NEW', label: 'New' },
    { value: 'CONTACTED', label: 'Contacted' },
    { value: 'QUALIFIED', label: 'Qualified' },
    { value: 'NOT_ELIGIBLE', label: 'Not Eligible' },
    { value: 'FOLLOW_UP', label: 'Follow up' },
    { value: 'CLOSED', label: 'Closed' },
    { value: 'CONVERTED', label: 'Converted' },
    { value: 'ADMITTED', label: 'Admitted' },
];

export const CONVERSION_STATUS_OPTIONS: { value: ConversionStatus; label: string }[] = [
    { value: 'HOT', label: 'Hot' },
    { value: 'COLD', label: 'Cold' },
];

export interface UpdateEnquiryStatusPayload {
    enquiry_ids: string[];
    enquiry_status?: EnquiryStatus;
    conversion_status?: ConversionStatus;
}

export const updateEnquiryStatus = async (payload: UpdateEnquiryStatusPayload): Promise<void> => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const data = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];

    const response = await fetch(`${UPDATE_ENQUIRY_STATUS}?instituteId=${INSTITUTE_ID}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Failed to update enquiry status: ${response.statusText}`);
    }
};
