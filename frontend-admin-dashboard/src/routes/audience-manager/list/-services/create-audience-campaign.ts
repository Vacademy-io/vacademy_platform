import { AUDIENCE_CAMPAIGN } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

export interface AudienceCampaignCustomFieldPayload {
    institute_id: string;
    custom_field: {
        fieldName: string;
        fieldType: string;
        isMandatory: boolean;
        formOrder: number;
        config?: string;
    };
}

export interface AudienceCampaignPayload {
    id?: string;
    institute_id: string;
    campaign_name: string;
    campaign_type: string;
    description: string;
    campaign_objective: string;
    to_notify: string;
    send_respondent_email: boolean;
    json_web_metadata?: string;
    created_by_user_id?: string;
    start_date_local: string; // format: YYYY-MM-DDTHH:mm:ss
    end_date_local: string; // format: YYYY-MM-DDTHH:mm:ss
    status: string;
    institute_custom_fields: AudienceCampaignCustomFieldPayload[];
}

export const createAudienceCampaign = async (payload: AudienceCampaignPayload) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: AUDIENCE_CAMPAIGN,
        data: payload,
    });
    return response?.data;
};

export const updateAudienceCampaign = async (
    audienceId: string,
    payload: AudienceCampaignPayload
) => {
    const response = await authenticatedAxiosInstance({
        method: 'PUT',
        url: `${AUDIENCE_CAMPAIGN}/${audienceId}`,
        data: payload,
    });
    return response?.data;
};