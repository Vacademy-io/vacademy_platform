import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { LINK_COUNSELLOR } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

export interface LinkCounsellorRequest {
    counselor_id: string;
    source_type: 'ENQUIRY';
    source_id: string; // enquiry_id
    institute_id: string;
}

export const linkCounsellorToEnquiry = async (
    enquiryId: string,
    counsellorId: string
): Promise<void> => {
    const instituteId = getCurrentInstituteId();

    if (!instituteId) {
        throw new Error('Institute ID not found');
    }

    const payload: LinkCounsellorRequest = {
        counselor_id: counsellorId,
        source_type: 'ENQUIRY',
        source_id: enquiryId,
        institute_id: instituteId,
    };

    console.log('🔗 Linking counsellor:', {
        url: LINK_COUNSELLOR,
        payload,
    });

    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: LINK_COUNSELLOR,
        data: payload,
        headers: {
            'Content-Type': 'application/json',
        },
    });

    console.log('✅ Counsellor linked successfully:', response.data);

    return response.data;
};
