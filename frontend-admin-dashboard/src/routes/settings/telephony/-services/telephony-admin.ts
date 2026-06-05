import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    TELEPHONY_CONFIG,
    TELEPHONY_NUMBERS,
    TELEPHONY_NUMBER_BY_ID,
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
    if (res.status === 204 || !res.data || res.data === '') return null;
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
