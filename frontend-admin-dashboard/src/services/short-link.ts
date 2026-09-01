import axios from 'axios';
import { PUBLIC_GET_OR_CREATE_SHORT_LINK } from '@/constants/urls';

/**
 * `short_links.source` values understood by media_service.
 *
 * The pair (source, sourceId) *is* the identity of a short link: asking for the
 * same pair twice returns the code that already exists rather than minting a
 * second one. That is what makes a link stable once an admin has printed it on
 * a flyer or pasted it into a WhatsApp broadcast.
 */
export const SHORT_LINK_SOURCE = {
    /** An audience campaign's public `/audience-response` form. sourceId = campaign id. */
    AUDIENCE_CAMPAIGN: 'AUDIENCE_CAMPAIGN',
    /**
     * An enquiry campaign's `/enquiry-response` form. Kept distinct from
     * AUDIENCE_CAMPAIGN even though both are keyed on a campaign id, because the
     * two point at different learner-portal routes — sharing one source would let
     * whichever form was shortened first decide where the other one's code lands.
     */
    ENQUIRY_CAMPAIGN: 'ENQUIRY_CAMPAIGN',
} as const;

export interface GetOrCreateShortLinkRequest {
    source: string;
    sourceId: string;
    destinationUrl: string;
    /**
     * Selects the institute's own short domain when one is configured in
     * media_service's `backend_base_url` table (e.g. `u.shikshanation.com`);
     * everyone else lands on the platform default, `u.vacademy.io`.
     */
    instituteId?: string;
    /**
     * Readability hint, not a reservation. The server slugifies it
     * ("Open Day 2026" -> `open-day-2026`) and appends a random suffix if that
     * slug is taken, so the caller never has to check for collisions.
     */
    shortCode?: string;
}

export interface ShortLinkResponse {
    /** Just the code, e.g. `open-day-2026`. */
    shortName: string;
    /** The full shareable URL, e.g. `https://u.vacademy.io/s/open-day-2026`. */
    absoluteUrl: string;
}

/**
 * Get-or-create the short link for a source entity.
 *
 * Public endpoint (media_service permits `/media-service/public/**` without a
 * token), so this deliberately uses a bare axios rather than the authenticated
 * instance: there is no 401 to recover from here, and routing it through the
 * refresh/logout interceptor would let a shortening hiccup bounce an admin out
 * of the app.
 */
export const getOrCreateShortLink = async (
    request: GetOrCreateShortLinkRequest
): Promise<ShortLinkResponse> => {
    const { data } = await axios.post<ShortLinkResponse>(PUBLIC_GET_OR_CREATE_SHORT_LINK, {
        source: request.source,
        sourceId: request.sourceId,
        destinationUrl: request.destinationUrl,
        instituteId: request.instituteId,
        shortCode: request.shortCode,
    });

    if (!data?.absoluteUrl) {
        throw new Error('Short link service returned no URL');
    }

    return data;
};
