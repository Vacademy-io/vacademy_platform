import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { LEAD_LOOKUP } from '@/constants/urls';
import { isValidPhoneValue } from '@/lib/phone-validation';

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

/** What the person is searching by. The input adapts to the one they pick. */
export type LookupMode = 'phone' | 'email' | 'name';

export async function lookupLead(params: {
    instituteId: string;
    /** Exactly one of these. Phone matches the last 10 digits; email and name match exactly. */
    phone?: string;
    email?: string;
    name?: string;
}): Promise<LeadLookupResult> {
    const res = await authenticatedAxiosInstance.get(LEAD_LOOKUP, {
        params: {
            instituteId: params.instituteId,
            phone: params.phone || undefined,
            email: params.email || undefined,
            name: params.name || undefined,
        },
    });
    return res.data;
}

/** The term, under the key the chosen mode sends it as. */
export function lookupParamsFor(mode: LookupMode, term: string): Record<string, string> {
    const trimmed = term.trim();
    return trimmed ? { [mode]: trimmed } : {};
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Whether the term is complete enough to send.
 *
 * Phone and email have to be whole: a partial number matches whoever shares the
 * suffix, and the backend compares emails exactly. A name has to be whole too -
 * the match is exact, so a first name alone simply finds nothing - but there is
 * no format to check, only that something was typed.
 *
 * The phone check is country-aware rather than a digit count. The input carries
 * the dial code, so "91" plus eight digits is ten digits and would have passed a
 * length test while being an incomplete Indian number - sent, matched against
 * nobody, and reported back as "not in the system".
 */
export function isTermCompleteFor(mode: LookupMode, term: string): boolean {
    const trimmed = term.trim();
    if (!trimmed) return false;
    if (mode === 'email') return EMAIL_RE.test(trimmed);
    if (mode === 'phone') return isValidPhoneValue(trimmed);
    return trimmed.length >= 3;
}

/** Label, placeholder and the hint under the box, per mode. */
export const LOOKUP_MODE_COPY: Record<
    LookupMode,
    { label: string; placeholder: string; hint: string }
> = {
    phone: {
        label: 'Phone number',
        placeholder: '9876543210',
        hint: 'Pick the country and enter the full number — a partial one would match the wrong person.',
    },
    email: {
        label: 'Email address',
        placeholder: 'name@example.com',
        hint: 'The address has to match exactly.',
    },
    name: {
        label: 'Full name',
        placeholder: 'Asha Kulkarni',
        hint: 'The full name has to match exactly — a first name on its own will not find anyone.',
    },
};

/**
 * Guess the mode from what was typed — used to pre-select the dropdown when
 * someone pastes a value in before choosing. An @ means email, all-digits means
 * phone, anything else is a name.
 */
export function guessLookupMode(term: string): LookupMode | null {
    const trimmed = term.trim();
    if (!trimmed) return null;
    if (trimmed.includes('@')) return 'email';
    return /^[0-9+()\-\s]+$/.test(trimmed) ? 'phone' : 'name';
}
