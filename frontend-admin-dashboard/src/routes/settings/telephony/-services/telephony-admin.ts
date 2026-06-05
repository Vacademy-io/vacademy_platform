import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    TELEPHONY_CONFIG,
    TELEPHONY_NUMBERS,
    TELEPHONY_NUMBER_BY_ID,
    TELEPHONY_NUMBER_ATTACH,
    TELEPHONY_EXOTEL_EXOPHONES,
    TELEPHONY_EXOTEL_BALANCE,
} from '@/constants/urls';

export interface TelephonyConfigView {
    id?: string;
    instituteId: string;
    providerType: string;
    apiAccountId: string;
    apiUsernameSet: boolean;
    apiPasswordSet: boolean;
    webhookTokenSet: boolean;
    recordCalls?: boolean | null;
    defaultSelectorKey: string;
    enabled?: boolean | null;
    /** Fallback number dialled when an inbound lead call has no agent — null
     *  means no fallback (call drops to provider default). */
    inboundVoicemailNumber?: string | null;
    /** App Bazaar flow id used to auto-attach every new ExoPhone via Exotel's
     *  IncomingPhoneNumbers API. Pasted once after creating the flow. */
    flowSid?: string | null;
    /** Server-side telephony.webhook.callback-base — renders into the Setup
     *  Guide so the admin sees the exact route URL to paste into App Bazaar. */
    webhookCallbackBase?: string | null;
    updatedAt?: string | null;
}

export interface TelephonyConfigInput {
    providerType: string;
    apiAccountId?: string;
    apiUsername?: string;
    apiPassword?: string;
    webhookToken?: string;
    recordCalls?: boolean;
    defaultSelectorKey?: string;
    enabled?: boolean;
    /** Empty string clears the saved value; null/undefined leaves it as-is. */
    inboundVoicemailNumber?: string | null;
    /** Empty string clears the saved value; null/undefined leaves it as-is. */
    flowSid?: string | null;
}

export interface TelephonyProviderNumber {
    id: string;
    instituteId: string;
    providerType: string;
    phoneNumber: string;
    providerResourceId?: string | null;
    label?: string | null;
    region?: string | null;
    priority?: number | null;
    enabled?: boolean | null;
    /** Inbound-flow attach status: ATTACHED | PENDING | FAILED | DETACHED | null. */
    flowAttachStatus?: string | null;
    /** Body/message of the most recent attach failure. */
    flowAttachError?: string | null;
    flowAttachedAt?: string | null;
}

/** One row from Exotel's GET /v2_beta/.../IncomingPhoneNumbers. */
export interface ExotelExoPhone {
    sid?: string;
    phone_number?: string;
    friendly_name?: string;
    voice_url?: string;
    capabilities?: Record<string, unknown>;
    date_created?: string;
}

export type SelectorKey = 'STICKY_PER_LEAD' | 'ROUND_ROBIN' | 'REGION_MATCH';

export const SELECTOR_OPTIONS: { value: SelectorKey; label: string; helper: string }[] = [
    {
        value: 'STICKY_PER_LEAD',
        label: 'Same number every time',
        helper: 'Each lead always sees the same number — helps them recognise your calls.',
    },
    {
        value: 'ROUND_ROBIN',
        label: 'Share calls across numbers',
        helper: 'Use each of your numbers in turn so the load is spread evenly.',
    },
    {
        value: 'REGION_MATCH',
        label: 'Match the lead’s region',
        helper: 'Prefer a number from the same region as the lead (based on the lead’s phone code).',
    },
];

export const fetchTelephonyConfig = async (
    instituteId: string
): Promise<TelephonyConfigView | null> => {
    const res = await authenticatedAxiosInstance.get<TelephonyConfigView | ''>(
        TELEPHONY_CONFIG(instituteId)
    );
    // Backend returns 204 + empty body when no config exists yet; axios surfaces
    // that as either an empty string or undefined data. Both are falsy, so a
    // single negation handles them. Don't add an explicit `=== ''` check —
    // TypeScript narrows `data` to TelephonyConfigView after the falsy guard
    // and TS2367 fires on a now-impossible comparison.
    if (res.status === 204 || !res.data) return null;
    return res.data as TelephonyConfigView;
};

export const upsertTelephonyConfig = async (
    instituteId: string,
    input: TelephonyConfigInput
): Promise<TelephonyConfigView> => {
    const { data } = await authenticatedAxiosInstance.put<TelephonyConfigView>(
        TELEPHONY_CONFIG(instituteId),
        input
    );
    return data;
};

export const fetchTelephonyNumbers = async (
    instituteId: string
): Promise<TelephonyProviderNumber[]> => {
    const { data } = await authenticatedAxiosInstance.get<TelephonyProviderNumber[]>(
        `${TELEPHONY_NUMBERS}?instituteId=${encodeURIComponent(instituteId)}`
    );
    return data;
};

export const createTelephonyNumber = async (
    input: Partial<TelephonyProviderNumber> & { instituteId: string; phoneNumber: string }
): Promise<TelephonyProviderNumber> => {
    const { data } = await authenticatedAxiosInstance.post<TelephonyProviderNumber>(
        TELEPHONY_NUMBERS,
        input
    );
    return data;
};

export const updateTelephonyNumber = async (
    id: string,
    patch: Partial<TelephonyProviderNumber>
): Promise<TelephonyProviderNumber> => {
    const { data } = await authenticatedAxiosInstance.put<TelephonyProviderNumber>(
        TELEPHONY_NUMBER_BY_ID(id),
        patch
    );
    return data;
};

export const deleteTelephonyNumber = async (id: string): Promise<void> => {
    await authenticatedAxiosInstance.delete(TELEPHONY_NUMBER_BY_ID(id));
};

/** Retry the Exotel flow-attach for a number whose last attempt was
 *  PENDING / FAILED. Returns the refreshed row with updated status. */
export const retryAttachTelephonyNumber = async (
    id: string
): Promise<TelephonyProviderNumber> => {
    const { data } = await authenticatedAxiosInstance.post<TelephonyProviderNumber>(
        TELEPHONY_NUMBER_ATTACH(id)
    );
    return data;
};

/** Pull every ExoPhone visible to the institute's Exotel account. */
export const fetchExotelExoPhones = async (
    instituteId: string
): Promise<ExotelExoPhone[]> => {
    const { data } = await authenticatedAxiosInstance.get<ExotelExoPhone[]>(
        TELEPHONY_EXOTEL_EXOPHONES(instituteId)
    );
    return data ?? [];
};

/** Slim view of Exotel's balance response — what the Calling settings page
 *  needs to show "₹X.XX credits left" without leaking the full envelope.
 *  {@link balance} is widened to {@code string | number} because Exotel's
 *  docs say string but their actual response uses numbers for some tiers. */
export interface ExotelBalance {
    balance?: string | number;
    currency?: string;
    pricingPlan?: string;
    dateUpdated?: string;
}

/** Fetch the institute's current Exotel credit balance. */
export const fetchExotelBalance = async (
    instituteId: string
): Promise<ExotelBalance> => {
    const { data } = await authenticatedAxiosInstance.get<ExotelBalance>(
        TELEPHONY_EXOTEL_BALANCE(instituteId)
    );
    return data ?? {};
};

