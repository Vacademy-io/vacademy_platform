import { DELETE_AUDIENCE_LEADS, RESTORE_AUDIENCE_LEADS } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

/**
 * What a delete acts on. A row in the leads list is one campaign response, but the same person
 * can hold several — so the caller has to say which they mean.
 *
 * - `RESPONSE`: just the given responses (what a row, or a bulk selection, represents).
 * - `USER`: every lead those people hold, across all campaigns ("remove them entirely").
 */
export type LeadDeleteScope = 'RESPONSE' | 'USER';

export interface LeadDeleteParams {
    responseIds: string[];
    instituteId: string;
    scope?: LeadDeleteScope;
}

const buildBody = ({ responseIds, instituteId, scope = 'RESPONSE' }: LeadDeleteParams) => ({
    response_ids: responseIds,
    institute_id: instituteId,
    scope,
});

/** Soft-delete leads. Returns how many rows actually flipped to deleted. */
export const deleteAudienceLeads = async (params: LeadDeleteParams): Promise<number> => {
    if (!params.responseIds?.length) {
        throw new Error('At least one lead is required to delete.');
    }
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: DELETE_AUDIENCE_LEADS,
        data: buildBody(params),
    });
    return response?.data?.deleted ?? 0;
};

/** Restore soft-deleted leads. Returns how many rows actually came back. */
export const restoreAudienceLeads = async (params: LeadDeleteParams): Promise<number> => {
    if (!params.responseIds?.length) {
        throw new Error('At least one lead is required to restore.');
    }
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: RESTORE_AUDIENCE_LEADS,
        data: buildBody(params),
    });
    return response?.data?.restored ?? 0;
};
