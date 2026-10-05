import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { LEAD_LOOKUP } from '@/constants/urls';

/**
 * "Is this phone / email already ours?"
 *
 * Every field is optional because the backend omits whatever the institute chose
 * not to share — a hidden field is absent from the JSON, not null, so there is
 * nothing to read out of the network tab.
 */
export interface LeadLookupResult {
    found: boolean;
    lead_name?: string;
    lead_email?: string;
    lead_mobile?: string;
    counsellor_name?: string;
    /** The institute's "Source". */
    campaign_type?: string;
    /** The institute's "Campaign" / "Label". */
    campaign_name?: string;
    status?: string;
    course?: string;
    /** Sent on every match regardless of the field config — it's a warning, not lead data. */
    opted_out?: boolean;
}

export async function lookupLead(params: {
    instituteId: string;
    /** One of these two. Phone matches on the last 10 digits, email exactly. */
    phone?: string;
    email?: string;
}): Promise<LeadLookupResult> {
    const res = await authenticatedAxiosInstance.get(LEAD_LOOKUP, {
        params: {
            instituteId: params.instituteId,
            phone: params.phone || undefined,
            email: params.email || undefined,
        },
    });
    return res.data;
}

/** Treat anything with an @ as an email; otherwise it's a number. */
export function splitLookupTerm(term: string): { phone?: string; email?: string } {
    const trimmed = term.trim();
    if (!trimmed) return {};
    return trimmed.includes('@') ? { email: trimmed } : { phone: trimmed };
}

/**
 * The backend needs a full number — a partial one would match whoever happens to
 * share the suffix. Saying so up front beats a round trip that returns an error.
 */
export function isLookupTermComplete(term: string): boolean {
    const { phone, email } = splitLookupTerm(term);
    if (email) return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    if (phone) return phone.replace(/[^0-9]/g, '').length >= 10;
    return false;
}
